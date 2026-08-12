package com.eqms.auth;

import org.springframework.stereotype.Service;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.ByteBuffer;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.Base64;

@Service
public class TotpService {

    private static final String BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
    private static final SecureRandom SECURE_RANDOM = new SecureRandom();

    public String generateSecret() {
        byte[] random = new byte[20];
        SECURE_RANDOM.nextBytes(random);
        return base32Encode(random);
    }

    public String createOtpAuthUri(String issuer, String accountName, String secret) {
        return "otpauth://totp/" + urlEncode(issuer + ":" + accountName)
                + "?secret=" + secret
                + "&issuer=" + urlEncode(issuer)
                + "&algorithm=SHA1&digits=6&period=30";
    }

    public boolean verify(String secret, String code) {
        if (secret == null || secret.isBlank() || code == null || !code.matches("\\d{6}")) {
            return false;
        }
        long currentWindow = Instant.now().getEpochSecond() / 30;
        return code.equals(generateCode(secret, currentWindow))
                || code.equals(generateCode(secret, currentWindow - 1))
                || code.equals(generateCode(secret, currentWindow + 1));
    }

    public String generateCode(String secret, long window) {
        try {
            byte[] keyBytes = base32Decode(secret);
            Mac mac = Mac.getInstance("HmacSHA1");
            mac.init(new SecretKeySpec(keyBytes, "HmacSHA1"));
            byte[] data = ByteBuffer.allocate(8).putLong(window).array();
            byte[] hash = mac.doFinal(data);
            int offset = hash[hash.length - 1] & 0x0F;
            int binary = ((hash[offset] & 0x7f) << 24)
                    | ((hash[offset + 1] & 0xff) << 16)
                    | ((hash[offset + 2] & 0xff) << 8)
                    | (hash[offset + 3] & 0xff);
            int otp = binary % 1_000_000;
            return String.format("%06d", otp);
        } catch (Exception ex) {
            throw new IllegalStateException("Unable to generate TOTP", ex);
        }
    }

    private String base32Encode(byte[] data) {
        StringBuilder bits = new StringBuilder();
        for (byte b : data) {
            bits.append(String.format("%8s", Integer.toBinaryString(b & 0xff)).replace(' ', '0'));
        }
        StringBuilder output = new StringBuilder();
        for (int i = 0; i < bits.length(); i += 5) {
            int end = Math.min(i + 5, bits.length());
            String chunk = bits.substring(i, end);
            if (chunk.length() < 5) {
                chunk = String.format("%-5s", chunk).replace(' ', '0');
            }
            output.append(BASE32_ALPHABET.charAt(Integer.parseInt(chunk, 2)));
        }
        return output.toString();
    }

    private byte[] base32Decode(String base32) {
        String normalized = base32.replace("=", "").toUpperCase();
        StringBuilder bits = new StringBuilder();
        for (char c : normalized.toCharArray()) {
            int index = BASE32_ALPHABET.indexOf(c);
            if (index < 0) {
                throw new IllegalArgumentException("Invalid base32 secret");
            }
            bits.append(String.format("%5s", Integer.toBinaryString(index)).replace(' ', '0'));
        }
        int byteCount = bits.length() / 8;
        byte[] result = new byte[byteCount];
        for (int i = 0; i < byteCount; i++) {
            result[i] = (byte) Integer.parseInt(bits.substring(i * 8, (i + 1) * 8), 2);
        }
        return result;
    }

    private String urlEncode(String value) {
        return value.replace(" ", "%20").replace(":", "%3A");
    }
}
