package com.eqms.service;

import com.eqms.entity.ControlledCopyRecord;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Base64;

/** Stateless, short-lived grant for public controlled-copy preview sessions. */
@Service
public class ControlledCopyPreviewGrantService {
    private static final long TTL_SECONDS = 15 * 60;
    private final byte[] signingKey;

    public ControlledCopyPreviewGrantService(@Value("${app.auth.jwt-secret}") String signingSecret) {
        this.signingKey = signingSecret.getBytes(StandardCharsets.UTF_8);
    }

    public String issue(ControlledCopyRecord copy) {
        try {
            long expiresAt = Instant.now().plusSeconds(TTL_SECONDS).getEpochSecond();
            String payload = copy.getId() + ":" + expiresAt;
            return Base64.getUrlEncoder().withoutPadding().encodeToString(payload.getBytes(StandardCharsets.UTF_8))
                    + "." + sign(payload);
        } catch (Exception ex) {
            throw new IllegalStateException("Unable to issue controlled-copy preview session", ex);
        }
    }

    public void require(ControlledCopyRecord copy, String grant) {
        try {
            String[] parts = grant == null ? new String[0] : grant.split("\\.", 2);
            if (parts.length != 2) throw new IllegalArgumentException();
            String payload = new String(Base64.getUrlDecoder().decode(parts[0]), StandardCharsets.UTF_8);
            if (!constantTimeEquals(sign(payload), parts[1])) throw new IllegalArgumentException();
            String[] values = payload.split(":", 2);
            if (values.length != 2 || !copy.getId().toString().equals(values[0])
                    || Instant.now().getEpochSecond() > Long.parseLong(values[1])) throw new IllegalArgumentException();
        } catch (Exception ex) {
            throw new AccessDeniedException("Controlled copy preview session is invalid or expired");
        }
    }

    private String sign(String payload) throws Exception {
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(signingKey, "HmacSHA256"));
        return Base64.getUrlEncoder().withoutPadding().encodeToString(mac.doFinal(payload.getBytes(StandardCharsets.UTF_8)));
    }
    private boolean constantTimeEquals(String left, String right) {
        return java.security.MessageDigest.isEqual(left.getBytes(StandardCharsets.UTF_8), right.getBytes(StandardCharsets.UTF_8));
    }
}
