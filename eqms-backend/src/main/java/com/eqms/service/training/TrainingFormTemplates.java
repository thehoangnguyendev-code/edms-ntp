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
import com.eqms.entity.UserAccount;
import java.util.Map;
import java.util.UUID;

/**
 * The Word templates of the forms of Training (APD.0011, APD.0014, APD.0024, APD.0108, APD.0117, APD.0118) that Training Administration uploaded and enabled with a
 * signature (Training Annex), and the PDF made from a file written in one of them. A new version of a form is used as soon as it is enabled.
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

    /** The enabled template of the form; a refusal when there is none. For a form that is a living list (the personal record, the specimen list, the number log): always the one in force. */
    public Template enabled(String code) {
        Map<String, Object> template = jdbc.queryForList("select * from training_form_templates where code = ? and status = 'ENABLED' order by activated_at desc limit 1", code).stream().findFirst()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_FORM_TEMPLATE_MISSING"));
        return load(code, template);
    }

    private Template load(String code, Map<String, Object> template) {
        byte[] source = files.readStored(String.valueOf(template.get("provider")), String.valueOf(template.get("stored_path")), String.valueOf(template.get("sha256")));
        return new Template(code, String.valueOf(template.get("version_label")), String.valueOf(template.get("sha256")), source);
    }

    /**
     * The template for a form made for one object (an activity, a session, a requirement, a job assignment, a matrix version). The first time a form is made for the object the template in
     * force is used and is remembered (V697); every later form for the same object comes out in that same template, even after another version was enabled or the template was disabled,
     * so the record of an activity is not redrawn in a new form. {@code record}: false for a preview, which neither remembers nor records a use.
     */
    public Template enabledFor(String code, String objectType, UUID objectId, UserAccount actor, String format, boolean record) {
        Map<String, Object> pinned = jdbc.queryForList("""
            select t.* from training_form_uses u join training_form_templates t on t.id = u.template_id
             where u.code = ? and u.object_type = ? and u.object_id = ? order by u.used_at, u.id limit 1
            """, code, objectType, objectId).stream().findFirst().orElse(null);
        Map<String, Object> template = pinned != null ? pinned : jdbc.queryForList("select * from training_form_templates where code = ? and status = 'ENABLED' order by activated_at desc limit 1", code).stream().findFirst()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_FORM_TEMPLATE_MISSING"));
        Template loaded = load(code, template);
        if (record) {
            jdbc.update("insert into training_form_uses(id, code, template_id, object_type, object_id, format, used_by) values (?,?,?,?,?,?,?)",
                    UUID.randomUUID(), code, template.get("id"), objectType, objectId, format == null ? null : format.toLowerCase(Locale.ROOT), actor == null ? null : actor.getId());
        }
        return loaded;
    }

    /** The format asked for: Word or PDF. */
    public static boolean isPdf(String format) {
        if (format == null || !List.of("docx", "pdf").contains(format.toLowerCase(Locale.ROOT))) throw new IllegalArgumentException("TRAINING_FORMAT_INVALID");
        return "pdf".equalsIgnoreCase(format);
    }

    /** The file to send: the Word file as it is, or the PDF made from it. */
    public Map<String, Object> file(byte[] docx, String format, String baseName) {
        boolean pdf = isPdf(format);
        byte[] forms = TrainingAnnexEngine.withFont(docx);
        return Map.of("bytes", pdf ? pdf(forms) : forms, "name", baseName + (pdf ? ".pdf" : ".docx"), "contentType", pdf ? "application/pdf" : DOCX);
    }

    public byte[] pdf(byte[] source) {
        byte[] docx = TrainingAnnexEngine.withFont(source);
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
