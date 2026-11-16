package com.eqms.service.export;

import com.eqms.auth.CurrentUserService;
import com.eqms.service.AuditTrailService;
import com.eqms.util.DateTimeFormatUtils;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.security.*;
import java.time.*;
import java.time.format.DateTimeFormatter;
import java.util.*;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;

@Service
public class TableExcelExportService {
    public static final String MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    private final CurrentUserService users;
    private final AuditTrailService audit;
    private final TransactionTemplate transaction;
    private final jakarta.persistence.EntityManager entityManager;
    private final java.util.concurrent.Semaphore generationSlots = new java.util.concurrent.Semaphore(2);
    public TableExcelExportService(CurrentUserService users, AuditTrailService audit, PlatformTransactionManager manager,
            jakarta.persistence.EntityManager entityManager) {
        this.users = users; this.audit = audit; this.transaction = new TransactionTemplate(manager);
        this.entityManager = entityManager;
        transaction.setIsolationLevel(org.springframework.transaction.TransactionDefinition.ISOLATION_REPEATABLE_READ);
    }
    @FunctionalInterface public interface Rows { void write(TableExcelWriter writer) throws IOException; }

    public ResponseEntity<StreamingResponseBody> generate(String name, Map<String,String> query, Rows source) throws IOException {
        var actor = users.requireCurrentUser();
        String filename = name + "_" + DateTimeFormatter.ofPattern("ddMMyyyy_HHmm")
                .withZone(DateTimeFormatUtils.ZONE).format(Instant.now()) + ".xlsx";
        Path file = Files.createTempFile("eqms-table-export-", ".xlsx");
        file.toFile().deleteOnExit();
        if (!generationSlots.tryAcquire()) {
            Files.deleteIfExists(file);
            throw new org.springframework.web.server.ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "Excel exports are busy; try again shortly");
        }
        try {
            transaction.executeWithoutResult(status -> {
                try (TableExcelWriter writer = new TableExcelWriter()) {
                    // Bulk audit export consumes a signature and must retain its normal write semantics.
                    if ("Audit_Trail".equals(name)) source.write(writer);
                    else try (var readScope = new TableExportReadScope(entityManager)) { source.write(writer); }
                    try (OutputStream output = Files.newOutputStream(file)) { writer.write(output); }
                    String checksum;
                    try (InputStream input = Files.newInputStream(file)) {
                        MessageDigest digest = MessageDigest.getInstance("SHA-256");
                        input.transferTo(new java.security.DigestOutputStream(OutputStream.nullOutputStream(), digest));
                        checksum = HexFormat.of().formatHex(digest.digest());
                    }
                    Map<String,String> criteria = new TreeMap<>(query);
                    // Never place authentication/e-signature material in the audit payload.
                    criteria.keySet().removeIf(k -> k.toLowerCase(Locale.ROOT).matches(".*(token|secret|password|signature).*"));
                    criteria.remove("page"); criteria.remove("limit"); criteria.remove("size");
                    UUID registerId = UUID.nameUUIDFromBytes(("table-export:" + name).getBytes(StandardCharsets.UTF_8));
                    audit.logAs(actor, "TABLE_EXPORT", name, registerId, "EXPORT", null, null,
                            "Generated Excel file=" + filename + "; records=" + writer.recordCount()
                            + "; SHA-256=" + checksum + "; criteria=" + criteria);
                } catch (IOException ex) { throw new UncheckedIOException(ex); }
                  catch (NoSuchAlgorithmException ex) { throw new IllegalStateException(ex); }
            });
            long length = Files.size(file);
            StreamingResponseBody body = output -> {
                try { Files.copy(file, output); } finally { Files.deleteIfExists(file); }
            };
            return ResponseEntity.ok().contentType(MediaType.parseMediaType(MIME)).contentLength(length)
                    .header(HttpHeaders.CACHE_CONTROL, "no-store")
                    .header("X-Content-Type-Options", "nosniff")
                    .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment().filename(filename).build().toString())
                    .body(body);
        } catch (RuntimeException | IOException ex) { Files.deleteIfExists(file); throw ex; }
        finally { generationSlots.release(); }
    }

}
