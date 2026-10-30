package com.eqms.service.training;

import com.eqms.entity.UserAccount;
import com.eqms.service.AuditTrailService;
import com.eqms.service.SignatureDisplayStyle;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

/**
 * The Training Annex (owner decisions 2026-10-28, PLAN-TR-004): the forms of Training (the APD annexes), what the system fixes for each (its tokens, cases, signature slots), the templates that
 * Training Administration uploaded for it, how the electronic signature of each slot is shown, and the preview of a template with sample data. Uploading, enabling and disabling a template are
 * in {@link TrainingFormTemplateService}; this service reads and holds what is around them.
 */
@Service
public class TrainingAnnexService {
    public record StyleRequest(String style, String reason) {}

    private final JdbcTemplate jdbc;
    private final TrainingAccess access;
    private final TrainingFormTemplates templates;
    private final TrainingFileService files;
    private final TrainingPreviewMarking marking;
    private final AuditTrailService audit;

    public TrainingAnnexService(JdbcTemplate jdbc, TrainingAccess access, TrainingFormTemplates templates, TrainingFileService files, TrainingPreviewMarking marking, AuditTrailService audit) {
        this.jdbc = jdbc;
        this.access = access;
        this.templates = templates;
        this.files = files;
        this.marking = marking;
        this.audit = audit;
    }

    /** The list of the Training Annex: one line for each form, searched, filtered, sorted and paged here. */
    @Transactional(readOnly = true)
    public Map<String, Object> page(UserAccount actor, String search, String status, String sortBy, String sortDirection, int page, int limit) {
        access.require(actor, "training.annex.view");
        Map<String, Map<String, Object>> enabled = new LinkedHashMap<>();
        for (Map<String, Object> t : jdbc.queryForList("select id, code, version_label, token_mode, check_problems, activated_at from training_form_templates where status = 'ENABLED'")) enabled.put((String) t.get("code"), t);
        // a Disabled version can be put in force unless its tokens do not agree with the form
        Map<String, Long> candidates = new LinkedHashMap<>();
        for (Map<String, Object> n : jdbc.queryForList("select code, count(*) as n from training_form_templates where status = 'DISABLED' and not (token_mode = 'TOKENS' and coalesce(check_problems, '') <> '') group by code")) candidates.put((String) n.get("code"), ((Number) n.get("n")).longValue());
        boolean mayManage = access.has(actor, "training.annex.manage"), mayEnable = access.has(actor, "training.annex.enable");
        Map<String, Long> counts = new LinkedHashMap<>();
        for (Map<String, Object> c : jdbc.queryForList("select code, count(*) as n from training_form_templates group by code")) counts.put((String) c.get("code"), ((Number) c.get("n")).longValue());
        String needle = search == null ? "" : search.trim().toLowerCase(Locale.ROOT);
        List<Map<String, Object>> rows = new ArrayList<>();
        for (String code : TrainingAnnexContract.codes()) {
            String title = TrainingAnnexContract.title(code);
            if (!needle.isEmpty() && !code.toLowerCase(Locale.ROOT).contains(needle) && !title.toLowerCase(Locale.ROOT).contains(needle)) continue;
            Map<String, Object> e = enabled.get(code);
            if ("ACTIVE".equals(status) && e == null) continue;
            if ("INACTIVE".equals(status) && e != null) continue;
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("id", code);
            row.put("code", code);
            row.put("title", title);
            // Active: a template of the form is in force, so a form of this kind can be made. Inactive: none is.
            row.put("status", e == null ? "INACTIVE" : "ACTIVE");
            row.put("enabledVersion", e == null ? null : e.get("version_label"));
            row.put("tokenMode", e == null ? null : e.get("token_mode"));
            row.put("enabledAt", e == null ? null : e.get("activated_at"));
            row.put("templateCount", counts.getOrDefault(code, 0L));
            row.put("tokenChecked", TrainingAnnexContract.of(code).checked());
            Map<String, Object> actions = new LinkedHashMap<>();
            actions.put("view", true);
            actions.put("edit", mayManage);
            actions.put("enable", mayEnable && candidates.getOrDefault(code, 0L) > 0);
            actions.put("disable", mayManage && e != null);
            row.put("actions", actions);
            rows.add(row);
        }
        Comparator<Map<String, Object>> order = Comparator.comparing(r -> String.valueOf(r.get(sortBy == null || sortBy.isBlank() || !rows.isEmpty() && !rows.get(0).containsKey(sortBy) ? "code" : sortBy)), String.CASE_INSENSITIVE_ORDER);
        rows.sort("desc".equalsIgnoreCase(sortDirection) ? order.reversed() : order);
        int safeLimit = Math.min(Math.max(limit, 1), 100), safePage = Math.max(page, 1);
        int from = Math.min((safePage - 1) * safeLimit, rows.size());
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("data", rows.subList(from, Math.min(from + safeLimit, rows.size())));
        result.put("pagination", Map.of("page", safePage, "limit", safeLimit, "total", rows.size(), "totalPages", Math.max(1, (rows.size() + safeLimit - 1) / safeLimit)));
        return result;
    }

    /** One form: what the system fixes (the contract), how each signature slot is shown, and every template version. */
    @Transactional(readOnly = true)
    public Map<String, Object> detail(UserAccount actor, String code) {
        access.require(actor, "training.annex.view");
        TrainingAnnexContract contract = TrainingAnnexContract.of(code);
        if (contract == null) throw new SecurityException(TrainingAccess.DENIED);
        Map<String, String> styles = new LinkedHashMap<>();
        for (Map<String, Object> s : jdbc.queryForList("select slot, style from training_annex_slot_styles where code = ?", code)) styles.put((String) s.get("slot"), (String) s.get("style"));
        List<Map<String, Object>> slots = new ArrayList<>();
        for (TrainingAnnexContract.Slot slot : contract.slots().values()) {
            Map<String, Object> s = new LinkedHashMap<>();
            s.put("name", slot.name());
            s.put("stage", slot.stage());
            s.put("meanings", slot.meanings());
            s.put("style", styles.get(slot.name()));
            slots.add(s);
        }
        List<Map<String, Object>> groups = new ArrayList<>();
        contract.groups().forEach((name, fields) -> groups.add(Map.of("name", name, "fields", List.copyOf(fields), "repeatsBlock", contract.each().contains(name))));
        Map<String, Object> c = new LinkedHashMap<>();
        c.put("checked", contract.checked());
        c.put("scalars", List.copyOf(contract.scalars()));
        c.put("groups", groups);
        c.put("cases", List.copyOf(contract.cases()));
        c.put("checks", List.copyOf(contract.checks()));
        c.put("blocks", List.copyOf(contract.blocks()));
        c.put("required", List.copyOf(contract.required()));
        c.put("slots", slots);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("code", code);
        out.put("title", TrainingAnnexContract.title(code));
        out.put("contract", c);
        out.put("starterAvailable", contract.checked() && getClass().getResource("/training-annex/" + code + ".docx") != null);
        out.put("templates", TrainingRows.camel(jdbc.queryForList("""
            select t.id, t.code, t.title, t.version_label, t.original_name, t.size_bytes, t.sha256, t.remark, t.status, t.uploaded_at, u.full_name as uploaded_by_name,
                   t.activated_at as enabled_at, a.full_name as enabled_by_name, t.disabled_at, d.full_name as disabled_by_name, t.disable_reason, t.token_mode, t.check_problems, t.checked_at
              from training_form_templates t join app_users u on u.id = t.uploaded_by left join app_users a on a.id = t.activated_by left join app_users d on d.id = t.disabled_by
             where t.code = ? order by t.uploaded_at desc
            """, code)));
        return out;
    }

    /** The tokenized starter of a form: the file the company's APD with the tokens written in it. */
    @Transactional(readOnly = true)
    public Map<String, Object> starter(UserAccount actor, String code) {
        access.require(actor, "training.annex.view");
        TrainingAnnexContract contract = TrainingAnnexContract.of(code);
        if (contract == null || !contract.checked()) throw new SecurityException(TrainingAccess.DENIED);
        try (InputStream in = getClass().getResourceAsStream("/training-annex/" + code + ".docx")) {
            if (in == null) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "TRAINING_ANNEX_STARTER_MISSING");
            return Map.of("bytes", in.readAllBytes(), "contentType", TrainingFormTemplates.DOCX, "name", code + "-tokenized-starter.docx");
        } catch (IOException e) {
            throw new IllegalStateException("TRAINING_PRINT_FAILED", e);
        }
    }

    /** Chooses how the electronic signature of a slot is shown. A reason is recorded in the Audit Trail. */
    @Transactional
    public Map<String, Object> setStyle(UserAccount actor, String code, String slot, StyleRequest request) {
        access.require(actor, "training.annex.manage");
        TrainingAnnexContract contract = TrainingAnnexContract.of(code);
        if (contract == null || !contract.slots().containsKey(slot)) throw new IllegalArgumentException("TRAINING_TEMPLATE_INVALID");
        if (request == null || request.reason() == null || request.reason().isBlank()) throw new IllegalArgumentException("TRAINING_REASON_REQUIRED");
        SignatureDisplayStyle style;
        try {
            style = SignatureDisplayStyle.valueOf(String.valueOf(request.style()).toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("TRAINING_TEMPLATE_INVALID");
        }
        String before = jdbc.queryForList("select style from training_annex_slot_styles where code = ? and slot = ?", String.class, code, slot).stream().findFirst().orElse(null);
        jdbc.update("""
            insert into training_annex_slot_styles(code, slot, style, updated_by, updated_at) values (?,?,?,?, now())
            on conflict (code, slot) do update set style = excluded.style, updated_by = excluded.updated_by, updated_at = now()
            """, code, slot, style.name(), actor.getId());
        audit.logAs(actor, "TRAINING_ANNEX", code, UUID.nameUUIDFromBytes(("TRAINING_ANNEX/" + code).getBytes(java.nio.charset.StandardCharsets.UTF_8)), "TRAINING_ANNEX_SIGNATURE_STYLE_CHANGED",
                before, style.name(), code + " slot " + slot + ": " + request.reason().trim());
        return Map.of("code", code, "slot", slot, "style", style.name());
    }

    /**
     * The preview of a template with the sample data of its form: a PDF that carries the watermark of the preview settings and says on its face that it is sample data and not a record.
     * Never stored, never recorded as a use of the template.
     */
    @Transactional(readOnly = true)
    public Map<String, Object> preview(UserAccount actor, UUID templateId) {
        access.require(actor, "training.annex.view");
        Map<String, Object> t = jdbc.queryForList("select * from training_form_templates where id = ?", templateId).stream().findFirst().orElseThrow(() -> new SecurityException(TrainingAccess.DENIED));
        String code = String.valueOf(t.get("code"));
        if (!"TOKENS".equals(t.get("token_mode"))) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_ANNEX_PREVIEW_NEEDS_TOKENS");
        byte[] source = files.readStored(String.valueOf(t.get("provider")), String.valueOf(t.get("stored_path")), String.valueOf(t.get("sha256")));
        byte[] docx;
        try {
            docx = TrainingAnnexEngine.render(source, TrainingAnnexSamples.of(code));
        } catch (IOException e) {
            throw new IllegalStateException("TRAINING_PRINT_FAILED", e);
        }
        byte[] pdf = marking.mark(templates.pdf(docx), actor);
        return Map.of("bytes", pdf, "contentType", "application/pdf", "name", code + "-preview.pdf");
    }
}
