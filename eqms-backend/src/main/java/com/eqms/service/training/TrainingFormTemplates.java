package com.eqms.service.training;

import com.eqms.service.OnlyOfficeDocumentEditService;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * The Word templates of the forms of Training (APD.0011, APD.0014, APD.0024, APD.0108, APD.0117, APD.0118, FRM.0007, FRM.0044) that Training Administration uploaded and enabled with a
 * signature (Training Properties, form templates), and the PDF made from a file written in one of them. A new version of a form is used as soon as it is enabled.
 */
@Service
public class TrainingFormTemplates {
    public static final String DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

    /** The enabled template of a form: its code, the label of its version, the SHA-256 and the file. */
    public record Template(String code, String versionLabel, String sha256, byte[] bytes) {
        /** For the Audit Trail: which form was used. */
        public String describe() {
            return code + " " + versionLabel + ", template SHA-256 " + sha256;
        }
    }

    private final JdbcTemplate jdbc;
    private final TrainingFileService files;
    private final OnlyOfficeDocumentEditService onlyOffice;

    public TrainingFormTemplates(JdbcTemplate jdbc, TrainingFileService files, OnlyOfficeDocumentEditService onlyOffice) {
        this.jdbc = jdbc;
        this.files = files;
        this.onlyOffice = onlyOffice;
    }

    /** The enabled template of the form; a refusal when there is none. */
    public Template enabled(String code) {
        Map<String, Object> template = jdbc.queryForList("select * from training_form_templates where code = ? and status = 'ENABLED' order by activated_at desc limit 1", code).stream().findFirst()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_FORM_TEMPLATE_MISSING"));
        byte[] source = files.readStored(String.valueOf(template.get("provider")), String.valueOf(template.get("stored_path")), String.valueOf(template.get("sha256")));
        return new Template(code, String.valueOf(template.get("version_label")), String.valueOf(template.get("sha256")), source);
    }

    /** The format asked for: Word or PDF. */
    public static boolean isPdf(String format) {
        if (format == null || !List.of("docx", "pdf").contains(format.toLowerCase(Locale.ROOT))) throw new IllegalArgumentException("TRAINING_FORMAT_INVALID");
        return "pdf".equalsIgnoreCase(format);
    }

    /** The file to send: the Word file as it is, or the PDF made from it. */
    public Map<String, Object> file(byte[] docx, String format, String baseName) {
        boolean pdf = isPdf(format);
        return Map.of("bytes", pdf ? pdf(docx) : docx, "name", baseName + (pdf ? ".pdf" : ".docx"), "contentType", pdf ? "application/pdf" : DOCX);
    }

    public byte[] pdf(byte[] docx) {
        Path temp = null;
        try {
            temp = Files.createTempFile("training-form-", ".docx");
            Files.write(temp, docx);
            return onlyOffice.convertLocalFileToPdf(temp, temp.getFileName().toString());
        } catch (IllegalStateException e) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "TRAINING_PREVIEW_UNAVAILABLE");
        } catch (IOException e) {
            throw new IllegalStateException("TRAINING_PRINT_FAILED", e);
        } finally {
            if (temp != null) {
                try { Files.deleteIfExists(temp); } catch (IOException ignored) { /* a temporary file */ }
            }
        }
    }
}
