package com.eqms.backup.agent.manifest;

import com.eqms.backup.agent.ledger.CanonicalJson;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.Map;

/** Builds the manifest of a backup set in its single canonical form and signs it (SDS section 7.1). */
@Service
public class ManifestService {

    public record SignedManifest(String text, String sha256, String signatureBase64, String keyId) {
    }

    private final SigningKeys keys;

    public ManifestService(SigningKeys keys) {
        this.keys = keys;
    }

    public SignedManifest sign(Map<String, Object> manifest) {
        String text = CanonicalJson.of(manifest);
        byte[] bytes = text.getBytes(StandardCharsets.UTF_8);
        return new SignedManifest(text, sha256(bytes), keys.sign(bytes), keys.keyId());
    }

    public boolean signatureValid(String manifestText, String signatureBase64) {
        return keys.verify(manifestText.getBytes(StandardCharsets.UTF_8), signatureBase64);
    }

    public String keyId() {
        return keys.keyId();
    }

    public static String sha256(byte[] bytes) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    public static String sha256(String text) {
        return sha256(text.getBytes(StandardCharsets.UTF_8));
    }
}
