package com.eqms.backup.agent.target;

import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.List;
import java.util.UUID;

/**
 * Proves a target works before it is trusted (SDS 23.4): a random probe is written, read back byte for byte, and, for an
 * immutable target, a delete is attempted and must be refused. The probe lives under {@code _probe/} and carries no data.
 */
@Component
public class TargetTester {

    public record Step(String name, boolean ok, String detail) {
    }

    public record Result(String target, boolean ok, List<Step> steps) {
    }

    public Result test(BackupTarget target) {
        List<Step> steps = new ArrayList<>();
        String key = "_probe/" + UUID.randomUUID() + ".bin";
        byte[] bytes = new byte[8192];
        new SecureRandom().nextBytes(bytes);
        Path source = null;
        Path back = null;
        try {
            source = Files.createTempFile("probe-", ".bin");
            back = Files.createTempFile("probe-back-", ".bin");
            Files.write(source, bytes);
            target.put(key, source);
            steps.add(new Step("write", true, target.describe(key)));
            target.get(key, back);
            boolean same = sha(Files.readAllBytes(back)).equals(sha(bytes));
            steps.add(new Step("read-back", same, same ? "same bytes" : "different bytes"));
            boolean deleted = target.tryDelete(key);
            if (target.immutable()) {
                steps.add(new Step("delete-refused", !deleted, deleted ? "The target allowed the delete, so it is not immutable" : "refused as required"));
            } else {
                steps.add(new Step("cleanup", deleted, deleted ? "probe removed" : "probe could not be removed"));
            }
        } catch (IOException | RuntimeException e) {
            steps.add(new Step(steps.isEmpty() ? "write" : "read-back", false, e.getMessage()));
        } finally {
            try {
                if (source != null) Files.deleteIfExists(source);
                if (back != null) Files.deleteIfExists(back);
            } catch (IOException ignored) {
                // temporary files only
            }
        }
        return new Result(target.code(), steps.stream().allMatch(Step::ok), steps);
    }

    private static String sha(byte[] data) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(data));
        } catch (java.security.NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
