package com.eqms.backup.agent.manifest;

import com.eqms.backup.agent.config.AgentProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.GeneralSecurityException;
import java.security.KeyFactory;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.MessageDigest;
import java.security.PrivateKey;
import java.security.PublicKey;
import java.security.Signature;
import java.security.spec.PKCS8EncodedKeySpec;
import java.security.spec.X509EncodedKeySpec;
import java.util.Base64;
import java.util.HexFormat;

/**
 * Ed25519 key that signs every manifest. In DEV the key is created on first start; TEST and PROD must provision it (it is
 * never silently created there). The public half is written next to the private one so anyone can verify a manifest with
 * standard tools.
 */
@Component
public class SigningKeys {

    private static final Logger log = LoggerFactory.getLogger(SigningKeys.class);

    private final PrivateKey privateKey;
    private final PublicKey publicKey;
    private final String keyId;

    public SigningKeys(AgentProperties properties) throws IOException, GeneralSecurityException {
        Path keyFile = properties.getCrypto().getSigningKeyFile();
        Path publicFile = keyFile.resolveSibling(keyFile.getFileName() + ".pub");
        KeyFactory factory = KeyFactory.getInstance("Ed25519");
        if (Files.exists(keyFile)) {
            this.privateKey = factory.generatePrivate(new PKCS8EncodedKeySpec(Base64.getMimeDecoder().decode(Files.readString(keyFile, StandardCharsets.US_ASCII))));
            this.publicKey = factory.generatePublic(new X509EncodedKeySpec(Base64.getMimeDecoder().decode(Files.readString(publicFile, StandardCharsets.US_ASCII))));
        } else if ("DEV".equalsIgnoreCase(properties.getEnvironment())) {
            KeyPair pair = KeyPairGenerator.getInstance("Ed25519").generateKeyPair();
            Files.createDirectories(keyFile.getParent());
            Files.writeString(keyFile, Base64.getMimeEncoder(64, "\n".getBytes(StandardCharsets.US_ASCII)).encodeToString(pair.getPrivate().getEncoded()) + "\n", StandardCharsets.US_ASCII);
            Files.writeString(publicFile, Base64.getMimeEncoder(64, "\n".getBytes(StandardCharsets.US_ASCII)).encodeToString(pair.getPublic().getEncoded()) + "\n", StandardCharsets.US_ASCII);
            this.privateKey = pair.getPrivate();
            this.publicKey = pair.getPublic();
            log.warn("DEV only: a new manifest signing key was created. TEST and PROD must provision their own key.");
        } else {
            throw new IllegalStateException("The manifest signing key is missing; " + properties.getEnvironment() + " must provision it");
        }
        this.keyId = HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(publicKey.getEncoded())).substring(0, 16);
    }

    public String sign(byte[] data) {
        try {
            Signature signature = Signature.getInstance("Ed25519");
            signature.initSign(privateKey);
            signature.update(data);
            return Base64.getEncoder().encodeToString(signature.sign());
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("Signing failed", e);
        }
    }

    public boolean verify(byte[] data, String signatureBase64) {
        try {
            Signature signature = Signature.getInstance("Ed25519");
            signature.initVerify(publicKey);
            signature.update(data);
            return signature.verify(Base64.getDecoder().decode(signatureBase64.trim()));
        } catch (GeneralSecurityException | IllegalArgumentException e) {
            return false;
        }
    }

    /** The public key as base64 of its X.509 encoding (what the .pub file holds, without PEM lines). */
    public String publicKeyBase64() {
        return Base64.getMimeEncoder(64, "\n".getBytes(StandardCharsets.US_ASCII)).encodeToString(publicKey.getEncoded());
    }

    public String keyId() {
        return keyId;
    }
}
