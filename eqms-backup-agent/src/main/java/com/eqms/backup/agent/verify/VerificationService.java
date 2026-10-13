package com.eqms.backup.agent.verify;

import com.eqms.backup.agent.backup.BackupRepository;
import com.eqms.backup.agent.backup.GpgKeyring;
import com.eqms.backup.agent.exec.CommandRunner;
import com.eqms.backup.agent.ledger.CanonicalJson;
import com.eqms.backup.agent.ledger.LedgerService;
import com.eqms.backup.agent.manifest.ManifestService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * V1: the check run straight after every backup, and again on request (SDS section 14.1). It proves the stored set is complete,
 * unchanged since it was written and properly signed and encrypted. It does <b>not</b> decrypt: the agent has no private key by
 * design. Decrypting and restoring are checked at V2 and V3 by people who hold the key.
 */
@Service
public class VerificationService {

    public record Check(String code, boolean ok, String detail) {
    }

    public record Outcome(String backupNumber, String result, List<Check> checks) {
        public boolean verified() {
            return "VERIFIED".equals(result);
        }
    }

    private static final ObjectMapper JSON = new ObjectMapper();

    private final JdbcTemplate jdbc;
    private final BackupRepository repository;
    private final ManifestService manifests;
    private final LedgerService ledger;
    private final GpgKeyring keyring;
    private final CommandRunner runner;

    public VerificationService(JdbcTemplate jdbc, BackupRepository repository, ManifestService manifests, LedgerService ledger,
                               GpgKeyring keyring, CommandRunner runner) {
        this.jdbc = jdbc;
        this.repository = repository;
        this.manifests = manifests;
        this.ledger = ledger;
        this.keyring = keyring;
        this.runner = runner;
    }

    public Outcome verifyV1(String backupNumber, String actor) {
        List<Check> checks = new ArrayList<>();
        Map<String, Object> run = repository.runByBackupNumber(backupNumber).orElseThrow(() -> new IllegalArgumentException("Unknown backup " + backupNumber));
        java.util.UUID runId = (java.util.UUID) run.get("id");
        checks.add(new Check("RUN_COMPLETED", "COMPLETED".equals(run.get("status")), "status " + run.get("status")));
        if ("COMPLETED".equals(run.get("status"))) {
            runChecks(backupNumber, runId, checks);
        }
        boolean ok = checks.stream().allMatch(Check::ok);
        String result = ok ? "VERIFIED" : "FAILED";
        Instant now = Instant.now();
        List<Map<String, Object>> detail = new ArrayList<>();
        for (Check c : checks) detail.add(Map.of("code", c.code(), "ok", c.ok(), "detail", c.detail() == null ? "" : c.detail()));
        repository.insertVerification(runId, "V1", result, CanonicalJson.of(Map.of("checks", detail)), now, actor);
        ledger.append(actor, ok ? "BACKUP_VERIFIED" : "BACKUP_VERIFY_FAILED", backupNumber, Map.of("tier", "V1", "result", result,
                "failedChecks", checks.stream().filter(c -> !c.ok()).map(Check::code).toList()));
        if (!ok) {
            repository.insertAlert("HIGH", "BACKUP_VERIFY_FAILED", "Verification failed for " + backupNumber + ": "
                    + checks.stream().filter(c -> !c.ok()).map(Check::code).toList(), backupNumber);
        }
        return new Outcome(backupNumber, result, checks);
    }

    private void runChecks(String backupNumber, java.util.UUID runId, List<Check> checks) {
        Optional<Map<String, Object>> location = jdbc.queryForList("select path from backup_set_location where run_id = ? order by target_code limit 1", runId).stream().findFirst();
        Optional<Map<String, Object>> manifestRow = jdbc.queryForList(
                "select manifest_text, manifest_sha256, signature_base64, previous_manifest_sha256 from backup_manifest where run_id = ?", runId).stream().findFirst();
        if (location.isEmpty() || manifestRow.isEmpty()) {
            checks.add(new Check("SET_RECORDED", false, "the location or the manifest is not recorded"));
            return;
        }
        Path dir = Path.of((String) location.get().get("path"));
        String manifestText = (String) manifestRow.get().get("manifest_text");
        String manifestSha = (String) manifestRow.get().get("manifest_sha256");
        String signature = (String) manifestRow.get().get("signature_base64");
        String previous = (String) manifestRow.get().get("previous_manifest_sha256");

        boolean present = Files.isDirectory(dir);
        checks.add(new Check("SET_PRESENT", present, present ? "found" : "the backup folder is missing"));
        if (!present) return;

        // 1. the manifest on disk is the one that was signed and recorded
        try {
            String onDisk = Files.readString(dir.resolve("manifest.json"), StandardCharsets.UTF_8);
            checks.add(new Check("MANIFEST_UNCHANGED", onDisk.equals(manifestText) && ManifestService.sha256(manifestText).equals(manifestSha),
                    onDisk.equals(manifestText) ? "matches the record" : "manifest.json differs from the recorded manifest"));
        } catch (IOException e) {
            checks.add(new Check("MANIFEST_UNCHANGED", false, "manifest.json cannot be read"));
        }
        // 2. signature
        boolean signatureOk = manifests.signatureValid(manifestText, signature);
        String sigOnDisk = readOrNull(dir.resolve("manifest.sig"));
        checks.add(new Check("MANIFEST_SIGNATURE", signatureOk && signature.trim().equals(sigOnDisk == null ? null : sigOnDisk.trim()),
                signatureOk ? "valid" : "the signature does not verify"));

        // 3. files listed in the manifest
        JsonNode manifest;
        try {
            manifest = JSON.readTree(manifestText);
        } catch (IOException e) {
            checks.add(new Check("MANIFEST_READABLE", false, "the manifest is not valid JSON"));
            return;
        }
        List<String> sums = new ArrayList<>();
        boolean filesOk = true;
        String firstProblem = null;
        for (JsonNode component : manifest.path("components")) {
            String file = component.path("file").asText(null);
            if (file == null) continue;
            Path path = dir.resolve(file);
            try {
                if (!Files.isRegularFile(path)) throw new IOException("missing");
                long size = Files.size(path);
                String sha = sha256(path);
                sums.add(sha + "  " + file);
                if (size != component.path("sizeBytes").asLong() || !sha.equals(component.path("sha256").asText())) {
                    filesOk = false;
                    firstProblem = firstProblem == null ? file + " does not match the manifest" : firstProblem;
                }
            } catch (IOException e) {
                filesOk = false;
                firstProblem = firstProblem == null ? file + " cannot be read" : firstProblem;
            }
        }
        checks.add(new Check("FILES_MATCH_MANIFEST", filesOk, filesOk ? sums.size() + " file(s) match" : firstProblem));

        // 3b. every stored document version this backup depends on is still in the pool
        boolean hasObjects = false;
        for (JsonNode component : manifest.path("components")) {
            if ("OBJECT_STORE".equals(component.path("key").asText())) hasObjects = true;
        }
        if (hasObjects) {
            // <T1>/<ENV>/<yyyy>/<MM>/<backupNumber>: the document pool sits beside the year folders
            Path envRoot = dir.getParent().getParent().getParent();
            int checked = 0;
            String problem = null;
            for (BackupRepository.Blob blob : repository.blobsUpTo(runId)) {
                Path file = envRoot.resolve(blob.path());
                try {
                    if (!Files.isRegularFile(file) || Files.size(file) != blob.cipherSize()) {
                        problem = problem == null ? blob.path() + " is missing or has a different size" : problem;
                    } else if (runId.equals(blob.firstRunId()) && !sha256(file).equals(blob.cipherSha256())) {
                        // content is read in full only for what this backup added; older documents were read by the backup that added them
                        problem = problem == null ? blob.path() + " does not match its recorded SHA-256" : problem;
                    }
                } catch (IOException e) {
                    problem = problem == null ? blob.path() + " cannot be read" : problem;
                }
                checked++;
            }
            checks.add(new Check("OBJECTS_PRESENT", problem == null, problem == null ? checked + " stored document version(s) present" : problem));
        }

        // 4. SHA256SUMS agrees
        String sumsFile = readOrNull(dir.resolve("SHA256SUMS"));
        boolean sumsOk = sumsFile != null && sums.stream().allMatch(line -> sumsFile.contains(line)) && sumsFile.contains(manifestSha + "  manifest.json");
        checks.add(new Check("CHECKSUM_FILE", sumsOk, sumsOk ? "consistent" : "SHA256SUMS differs from the files or the manifest"));

        // 5. chain to the previous backup
        String expectedPrevious = jdbc.queryForList("select m.manifest_sha256 from backup_manifest m join backup_run r on r.id = m.run_id "
                        + "where r.status = 'COMPLETED' and r.started_at < (select started_at from backup_run where id = ?) order by r.started_at desc limit 1",
                String.class, runId).stream().findFirst().orElse(null);
        boolean chainOk = java.util.Objects.equals(expectedPrevious, previous);
        checks.add(new Check("CHAIN_TO_PREVIOUS", chainOk, chainOk ? (previous == null ? "first backup" : "follows the previous backup") : "does not follow the previous backup"));

        // 6. encrypted to the expected key, without decrypting
        List<String> keyIds = new ArrayList<>();
        manifest.path("encryption").path("encryptionKeyIds").forEach(n -> keyIds.add(n.asText().toUpperCase()));
        String keyId = String.join(",", keyIds);
        boolean encrypted = false;
        String encDetail = "no encrypted file to inspect";
        for (JsonNode component : manifest.path("components")) {
            String file = component.path("file").asText(null);
            if (file == null || !file.endsWith(".gpg")) continue;
            try {
                CommandRunner.Result packets = runner.run(keyring.listPacketsCommand(dir.resolve(file)), 120);
                String out = packets.stdout() + "\n" + packets.stderrTail();
                String upper = out.toUpperCase();
                // gpg exits with an error here because it cannot decrypt (the agent has no private key). That is the point; the packets are read anyway.
                encrypted = out.contains("pubkey enc packet") && (out.contains("encrypted data packet") || out.contains("aead encrypted packet"))
                        && keyIds.stream().anyMatch(upper::contains);
                encDetail = encrypted ? "encrypted to key " + keyId : "not encrypted to the expected key";
            } catch (IOException | InterruptedException e) {
                if (e instanceof InterruptedException) Thread.currentThread().interrupt();
                encDetail = "the encryption could not be inspected";
            }
            break;
        }
        checks.add(new Check("ENCRYPTED_FOR_KEY", encrypted, encDetail));

        // 7. the ledger recorded this exact manifest
        boolean ledgerOk = ledger.all().stream().anyMatch(e -> "BACKUP_COMPLETED".equals(e.event()) && backupNumber.equals(e.ref())
                && e.dataJson().contains("\"manifestSha256\":\"" + manifestSha + "\""));
        checks.add(new Check("LEDGER_RECORDS_MANIFEST", ledgerOk, ledgerOk ? "recorded" : "the ledger has no matching completion event"));
    }

    static String sha256(Path path) throws IOException {
        try (InputStream in = Files.newInputStream(path)) {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] buffer = new byte[1 << 16];
            int read;
            while ((read = in.read(buffer)) >= 0) digest.update(buffer, 0, read);
            return HexFormat.of().formatHex(digest.digest());
        } catch (java.security.NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    private static String readOrNull(Path path) {
        try {
            return Files.readString(path, StandardCharsets.UTF_8);
        } catch (IOException e) {
            return null;
        }
    }

    /** Used by the API to show the latest result per backup. */
    public Map<String, Object> toMap(Outcome outcome) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("backupNumber", outcome.backupNumber());
        map.put("result", outcome.result());
        map.put("checks", outcome.checks());
        return map;
    }
}
