package com.demo.upimesh.service;

import com.demo.upimesh.crypto.DigitalSignatureService;
import com.demo.upimesh.crypto.HybridCryptoService;
import com.demo.upimesh.model.Account;
import com.demo.upimesh.model.AccountRepository;
import com.demo.upimesh.model.MeshPacket;
import com.demo.upimesh.model.PaymentInstruction;
import com.demo.upimesh.model.Transaction;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.security.PublicKey;
import java.time.Instant;

/**
 * Orchestrates the full server-side pipeline for one inbound packet from a
 * bridge node:
 *
 *   1. Hash the ciphertext.
 *   2. Try to claim that hash via the idempotency cache.
 *      - If already claimed: this is a duplicate. Drop it.
 *   3. Decrypt the ciphertext with the server's private key.
 *      - If decryption fails: tampered or junk. Reject.
 *   4. Check freshness — reject if signedAt is too old (replay protection).
 *   5. Verify Sender Digital Signature (ECDSA) — proves authenticity & non-repudiation.
 *      - If signature missing, invalid, or forged: reject immediately.
 *   6. Hand off to SettlementService for the actual debit/credit.
 */
@Service
public class BridgeIngestionService {

    private static final Logger log = LoggerFactory.getLogger(BridgeIngestionService.class);

    @Autowired private HybridCryptoService crypto;
    @Autowired private IdempotencyService idempotency;
    @Autowired private SettlementService settlement;
    @Autowired private DigitalSignatureService signatureService;
    @Autowired private AccountRepository accounts;

    @Value("${upi.mesh.packet-max-age-seconds:86400}")
    private long maxAgeSeconds;

    public IngestResult ingest(MeshPacket packet, String bridgeNodeId, int hopCount) {
        try {
            String packetHash = crypto.hashCiphertext(packet.getCiphertext());

            // ---- Idempotency gate ----
            if (!idempotency.claim(packetHash)) {
                log.info("DUPLICATE packet {} from bridge {} — dropped",
                        packetHash.substring(0, 12) + "...", bridgeNodeId);
                return IngestResult.duplicate(packetHash);
            }

            // ---- Decrypt ----
            PaymentInstruction instruction;
            try {
                instruction = crypto.decrypt(packet.getCiphertext());
            } catch (Exception e) {
                log.warn("Decryption failed for packet {}: {}",
                        packetHash.substring(0, 12) + "...", e.getMessage());
                return IngestResult.invalid(packetHash, "decryption_failed");
            }

            // ---- Freshness check (replay protection) ----
            long ageSeconds = (Instant.now().toEpochMilli() - instruction.getSignedAt()) / 1000;
            if (ageSeconds > maxAgeSeconds) {
                log.warn("Packet {} too old ({}s), rejected",
                        packetHash.substring(0, 12) + "...", ageSeconds);
                return IngestResult.invalid(packetHash, "stale_packet");
            }
            if (ageSeconds < -300) { // small clock-skew tolerance
                return IngestResult.invalid(packetHash, "future_dated");
            }

            // ---- Digital Signature Verification (Authenticity & Non-Repudiation) ----
            if (instruction.getSenderSignature() == null || instruction.getSenderSignature().isBlank()) {
                log.warn("Packet {} missing sender signature", packetHash.substring(0, 12) + "...");
                return IngestResult.invalid(packetHash, "missing_sender_signature");
            }

            Account senderAccount = accounts.findById(instruction.getSenderVpa()).orElse(null);
            if (senderAccount == null) {
                log.warn("Sender {} not found for packet {}", instruction.getSenderVpa(), packetHash.substring(0, 12) + "...");
                return IngestResult.invalid(packetHash, "unknown_sender");
            }

            if (senderAccount.getPublicKey() == null || senderAccount.getPublicKey().isBlank()) {
                log.warn("Sender {} has no registered public key", instruction.getSenderVpa());
                return IngestResult.invalid(packetHash, "unregistered_sender_key");
            }

            try {
                PublicKey senderPublicKey = signatureService.decodePublicKey(senderAccount.getPublicKey());
                String canonical = signatureService.canonicalPayload(
                        instruction.getSenderVpa(),
                        instruction.getReceiverVpa(),
                        instruction.getAmount(),
                        instruction.getNonce(),
                        instruction.getSignedAt()
                );
                if (!signatureService.verify(canonical, instruction.getSenderSignature(), senderPublicKey)) {
                    log.warn("Digital signature verification failed for sender {}", instruction.getSenderVpa());
                    return IngestResult.invalid(packetHash, "invalid_sender_signature");
                }
            } catch (Exception e) {
                log.warn("Signature verification error for sender {}: {}", instruction.getSenderVpa(), e.getMessage());
                return IngestResult.invalid(packetHash, "signature_verification_error");
            }

            // ---- Settle ----
            Transaction tx = settlement.settle(instruction, packetHash, bridgeNodeId, hopCount);
            return IngestResult.settled(packetHash, tx);

        } catch (Exception e) {
            log.error("Ingestion error: {}", e.getMessage(), e);
            return IngestResult.invalid("?", "internal_error: " + e.getMessage());
        }
    }

    public record IngestResult(String outcome, String packetHash, String reason, Long transactionId) {
        public static IngestResult settled(String hash, Transaction tx) {
            return new IngestResult("SETTLED", hash, null, tx.getId());
        }
        public static IngestResult duplicate(String hash) {
            return new IngestResult("DUPLICATE_DROPPED", hash, null, null);
        }
        public static IngestResult invalid(String hash, String reason) {
            return new IngestResult("INVALID", hash, reason, null);
        }
    }
}
