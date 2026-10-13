package com.eqms.maintenance;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.Optional;

/**
 * The Maintenance Pass (SDS 11.5.3): a short-lived token for the Super Administrator, signed with a key that is not the eQMS
 * session key and does not depend on the eQMS user or session tables. It stays valid across the database replacement.
 */
@Service
public class MaintenancePassService {

    private static final int MIN_SECRET_LENGTH = 32;
    private final byte[] secret;
    private final Duration lifetime;

    public MaintenancePassService(@Value("${app.maintenance.pass-secret:}") String secret,
                                  @Value("${app.maintenance.pass-minutes:30}") long minutes) {
        this.secret = secret == null ? new byte[0] : secret.getBytes(StandardCharsets.UTF_8);
        this.lifetime = Duration.ofMinutes(minutes);
    }

    public boolean configured() {
        return secret.length >= MIN_SECRET_LENGTH;
    }

    public Issued issue(String username) {
        Instant expires = Instant.now().plus(lifetime);
        String payload = username + "|" + expires.getEpochSecond();
        return new Issued(encode(payload) + "." + sign(payload), expires);
    }

    /** The Super Administrator's name if the pass is genuine and not expired. */
    public Optional<String> verify(String token) {
        if (!configured() || token == null || token.length() > 512) return Optional.empty();
        int dot = token.lastIndexOf('.');
        if (dot < 1) return Optional.empty();
        String payload;
        try {
            payload = new String(Base64.getUrlDecoder().decode(token.substring(0, dot)), StandardCharsets.UTF_8);
        } catch (IllegalArgumentException e) {
            return Optional.empty();
        }
        if (!MessageDigest.isEqual(sign(payload).getBytes(StandardCharsets.US_ASCII), token.substring(dot + 1).getBytes(StandardCharsets.US_ASCII))) {
            return Optional.empty();
        }
        int bar = payload.lastIndexOf('|');
        if (bar < 1) return Optional.empty();
        long expires;
        try {
            expires = Long.parseLong(payload.substring(bar + 1));
        } catch (NumberFormatException e) {
            return Optional.empty();
        }
        if (Instant.now().getEpochSecond() >= expires) return Optional.empty();
        return Optional.of(payload.substring(0, bar));
    }

    private String sign(String payload) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret, "HmacSHA256"));
            return Base64.getUrlEncoder().withoutPadding().encodeToString(mac.doFinal(payload.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) {
            throw new IllegalStateException("The maintenance pass cannot be signed", e);
        }
    }

    private static String encode(String payload) {
        return Base64.getUrlEncoder().withoutPadding().encodeToString(payload.getBytes(StandardCharsets.UTF_8));
    }

    public record Issued(String token, Instant expiresAt) {
    }
}
