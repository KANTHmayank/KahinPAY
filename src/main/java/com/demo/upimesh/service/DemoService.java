package com.demo.upimesh.service;

import com.demo.upimesh.crypto.DigitalSignatureService;
import com.demo.upimesh.crypto.HybridCryptoService;
import com.demo.upimesh.crypto.ServerKeyHolder;
import com.demo.upimesh.model.Account;
import com.demo.upimesh.model.AccountRepository;
import com.demo.upimesh.model.MeshPacket;
import com.demo.upimesh.model.PaymentInstruction;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.security.KeyPair;
import java.security.MessageDigest;
import java.security.PrivateKey;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Helper service that:
 *   - seeds demo accounts on startup with ECDSA keypairs
 *   - simulates "sender phone creates an encrypted & signed packet" flow
 *   - holds simulated client-side device keystores (representing Android Keystore)
 */
@Service
public class DemoService {

    private static final Logger log = LoggerFactory.getLogger(DemoService.class);

    @Autowired private AccountRepository accounts;
    @Autowired private HybridCryptoService crypto;
    @Autowired private ServerKeyHolder serverKey;
    @Autowired private DigitalSignatureService signatureService;

    // Simulates secure hardware storage on the user's phone (e.g. Android Keystore / Apple Secure Enclave)
    private final Map<String, PrivateKey> clientKeystore = new ConcurrentHashMap<>();

    @PostConstruct
    public void seedAccounts() throws Exception {
        if (accounts.count() == 0) {
            seedAccount("alice@demo", "Alice", new BigDecimal("5000.00"));
            seedAccount("bob@demo", "Bob", new BigDecimal("1000.00"));
            seedAccount("carol@demo", "Carol", new BigDecimal("2500.00"));
            seedAccount("dave@demo", "Dave", new BigDecimal("500.00"));
            log.info("Seeded 4 demo accounts with ECDSA (secp256r1) keypairs");
        }
    }

    private void seedAccount(String vpa, String name, BigDecimal balance) throws Exception {
        KeyPair kp = signatureService.generateKeyPair();
        clientKeystore.put(vpa, kp.getPrivate());
        String encodedPub = signatureService.encodePublicKey(kp.getPublic());
        accounts.save(new Account(vpa, name, balance, encodedPub));
    }

    public PrivateKey getSenderPrivateKey(String vpa) {
        return clientKeystore.get(vpa);
    }

    public void registerClientPrivateKey(String vpa, PrivateKey privateKey) {
        clientKeystore.put(vpa, privateKey);
    }

    /**
     * Simulates the sender's phone:
     *   1. Build a PaymentInstruction with a fresh nonce + signedAt timestamp.
     *   2. Sign the canonical payload using the sender's EC Private Key (ECDSA).
     *   3. Encrypt the signed instruction with the server's public key (hybrid RSA+AES).
     *   4. Wrap in a MeshPacket with TTL.
     */
    public MeshPacket createPacket(String senderVpa, String receiverVpa,
                                   BigDecimal amount, String pin, int ttl) throws Exception {
        String nonce = UUID.randomUUID().toString();
        long signedAt = Instant.now().toEpochMilli();

        // 1. Digital Signature: Authenticate the transaction using sender's private key
        PrivateKey privateKey = clientKeystore.get(senderVpa);
        if (privateKey == null) {
            // If account was created dynamically without a private key, generate one on the fly
            KeyPair kp = signatureService.generateKeyPair();
            privateKey = kp.getPrivate();
            clientKeystore.put(senderVpa, privateKey);
            Account acc = accounts.findById(senderVpa).orElse(null);
            if (acc != null && (acc.getPublicKey() == null || acc.getPublicKey().isBlank())) {
                acc.setPublicKey(signatureService.encodePublicKey(kp.getPublic()));
                accounts.save(acc);
            }
        }

        String canonical = signatureService.canonicalPayload(senderVpa, receiverVpa, amount, nonce, signedAt);
        String signature = signatureService.sign(canonical, privateKey);

        PaymentInstruction instruction = new PaymentInstruction(
                senderVpa,
                receiverVpa,
                amount,
                sha256Hex(pin),
                nonce,
                signedAt,
                signature
        );

        String ciphertext = crypto.encrypt(instruction, serverKey.getPublicKey());

        MeshPacket packet = new MeshPacket();
        packet.setPacketId(UUID.randomUUID().toString());
        packet.setTtl(ttl);
        packet.setCreatedAt(Instant.now().toEpochMilli());
        packet.setCiphertext(ciphertext);
        return packet;
    }

    private String sha256Hex(String input) throws Exception {
        MessageDigest md = MessageDigest.getInstance("SHA-256");
        byte[] hash = md.digest(input.getBytes());
        StringBuilder hex = new StringBuilder();
        for (byte b : hash) hex.append(String.format("%02x", b));
        return hex.toString();
    }
}
