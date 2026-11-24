package com.demo.upimesh.crypto;

import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.*;
import java.security.spec.ECGenParameterSpec;
import java.security.spec.PKCS8EncodedKeySpec;
import java.security.spec.X509EncodedKeySpec;
import java.util.Base64;

/**
 * Handles ECDSA digital signatures (Elliptic Curve Digital Signature Algorithm)
 * using the standard NIST P-256 (secp256r1) curve and SHA-256.
 *
 * Why ECDSA?
 * 1. Industry standard for mobile secure hardware (Android Keystore, Apple Secure Enclave, WebAuthn).
 * 2. Much shorter keys and signatures than RSA (256-bit EC provides ~128 bits of security, equivalent
 *    to 3072-bit RSA), keeping packet sizes minimal for Bluetooth mesh transport.
 *
 * This provides Non-Repudiation and Authenticity:
 * Intermediaries only have the bank's RSA public key (for encryption), but CANNOT forge a valid
 * transaction from Alice because only Alice possesses Alice's EC Private Key.
 */
@Service
public class DigitalSignatureService {

    private static final String EC_ALGORITHM = "EC";
    private static final String SIGNATURE_ALGORITHM = "SHA256withECDSA";
    private static final String EC_CURVE = "secp256r1";

    /**
     * Generate a new NIST P-256 EC KeyPair for an account/device.
     */
    public KeyPair generateKeyPair() throws Exception {
        KeyPairGenerator kpg = KeyPairGenerator.getInstance(EC_ALGORITHM);
        ECGenParameterSpec ecSpec = new ECGenParameterSpec(EC_CURVE);
        kpg.initialize(ecSpec, new SecureRandom());
        return kpg.generateKeyPair();
    }

    /**
     * Build the canonical representation of a payment to sign.
     * Prevents ambiguity across platforms.
     */
    public String canonicalPayload(String senderVpa, String receiverVpa, BigDecimal amount,
                                   String nonce, Long signedAt) {
        return String.join("|",
                senderVpa == null ? "" : senderVpa,
                receiverVpa == null ? "" : receiverVpa,
                amount == null ? "0.00" : amount.toPlainString(),
                nonce == null ? "" : nonce,
                signedAt == null ? "0" : String.valueOf(signedAt)
        );
    }

    /**
     * Sign the canonical payload with the sender's private key.
     */
    public String sign(String canonicalData, PrivateKey privateKey) throws Exception {
        Signature ecdsa = Signature.getInstance(SIGNATURE_ALGORITHM);
        ecdsa.initSign(privateKey);
        ecdsa.update(canonicalData.getBytes(StandardCharsets.UTF_8));
        byte[] sigBytes = ecdsa.sign();
        return Base64.getEncoder().encodeToString(sigBytes);
    }

    /**
     * Verify the signature against the canonical payload using the sender's public key.
     */
    public boolean verify(String canonicalData, String base64Signature, PublicKey publicKey) {
        try {
            byte[] sigBytes = Base64.getDecoder().decode(base64Signature);
            Signature ecdsa = Signature.getInstance(SIGNATURE_ALGORITHM);
            ecdsa.initVerify(publicKey);
            ecdsa.update(canonicalData.getBytes(StandardCharsets.UTF_8));
            return ecdsa.verify(sigBytes);
        } catch (Exception e) {
            return false;
        }
    }

    /**
     * Decode an X.509 Base64-encoded string back into an EC PublicKey.
     */
    public PublicKey decodePublicKey(String base64PublicKey) throws Exception {
        byte[] keyBytes = Base64.getDecoder().decode(base64PublicKey);
        X509EncodedKeySpec spec = new X509EncodedKeySpec(keyBytes);
        KeyFactory kf = KeyFactory.getInstance(EC_ALGORITHM);
        return kf.generatePublic(spec);
    }

    /**
     * Encode an EC PublicKey to X.509 Base64 string for storage in database.
     */
    public String encodePublicKey(PublicKey publicKey) {
        return Base64.getEncoder().encodeToString(publicKey.getEncoded());
    }

    /**
     * Decode a PKCS#8 Base64-encoded string back into an EC PrivateKey.
     */
    public PrivateKey decodePrivateKey(String base64PrivateKey) throws Exception {
        byte[] keyBytes = Base64.getDecoder().decode(base64PrivateKey);
        PKCS8EncodedKeySpec spec = new PKCS8EncodedKeySpec(keyBytes);
        KeyFactory kf = KeyFactory.getInstance(EC_ALGORITHM);
        return kf.generatePrivate(spec);
    }

    /**
     * Encode an EC PrivateKey to PKCS#8 Base64 string.
     */
    public String encodePrivateKey(PrivateKey privateKey) {
        return Base64.getEncoder().encodeToString(privateKey.getEncoded());
    }
}
