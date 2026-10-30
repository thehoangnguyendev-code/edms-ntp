package com.eqms.service.training;

import com.eqms.entity.UserAccount;
import com.eqms.service.AuditTrailService;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Predicate;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * The codes of the Training Requirement, the Training Matrix and the Training Assessment. SOP.0003 only fixes the Training Number, so the rule of these codes is a setting of Training
 * Administration: a pattern with {YYYY}, {YY}, {DEPT} and {SEQ:n}. The number is taken from a counter that starts again for each year (a pattern with a year) and for each department (a pattern
 * with a department and a number); two people asking at the same moment never get the same number. A code is never changed after it is issued.
 */
@Service
public class TrainingCodeService {
    public static final String REQUIREMENT = "REQUIREMENT";
    public static final String MATRIX = "MATRIX";
    public static final String ASSESSMENT = "ASSESSMENT";
    private static final List<String> ENTITIES = List.of(REQUIREMENT, MATRIX, ASSESSMENT);
    private static final Pattern TOKEN = Pattern.compile("\\{(YYYY|YY|DEPT|SEQ(?::([1-8]))?)}");
    private static final Pattern ALLOWED = Pattern.compile("^(?:[A-Za-z0-9/._-]|\\{(?:YYYY|YY|DEPT|SEQ(?::[1-8])?)})+$");
    private static final int CODE_LIMIT = 40;

    public record RuleWrite(Integer version, String pattern, String reason) {}
    public record PreviewRequest(String entity, String pattern) {}

    private final JdbcTemplate jdbc;
    private final TrainingAccess access;
    private final AuditTrailService audit;

    public TrainingCodeService(JdbcTemplate jdbc, TrainingAccess access, AuditTrailService audit) {
        this.jdbc = jdbc;
        this.access = access;
        this.audit = audit;
    }

    // ------------------------------------------------------------------------------------------------------------------------------ the rules

    @Transactional(readOnly = true)
    public List<Map<String, Object>> rules(UserAccount actor) {
        access.require(actor, "training.settings.view", "training.settings.manage");
        List<Map<String, Object>> out = new ArrayList<>();
        for (Map<String, Object> r : jdbc.queryForList("select r.entity, r.pattern, r.version, r.updated_at, (select u.full_name from app_users u where u.id = r.updated_by) as updated_by_name from training_code_rules r order by r.entity")) {
            Map<String, Object> m = new LinkedHashMap<>(TrainingRows.camel(List.of(r)).getFirst());
            m.put("example", example(String.valueOf(r.get("entity")), String.valueOf(r.get("pattern"))));
            m.put("label", label(String.valueOf(r.get("entity"))));
            out.add(m);
        }
        return out;
    }

    @Transactional
    public Map<String, Object> update(UserAccount actor, String entity, RuleWrite request) {
        access.require(actor, "training.settings.manage");
        requireEntity(entity);
        if (request == null || request.version() == null) throw new IllegalArgumentException("TRAINING_CODE_RULE_INVALID");
        String pattern = request.pattern() == null ? "" : request.pattern().trim();
        validate(entity, pattern);
        if (request.reason() != null && request.reason().length() > 1000) throw new IllegalArgumentException("TRAINING_REASON_REQUIRED");
        Map<String, Object> current = jdbc.queryForList("select pattern, version from training_code_rules where entity = ? for update", entity).stream().findFirst().orElseThrow();
        if (((Number) current.get("version")).intValue() != request.version()) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_CODE_RULE_VERSION_CHANGED");
        if (!pattern.equals(current.get("pattern"))) {
            jdbc.update("update training_code_rules set pattern = ?, version = version + 1, updated_by = ?, updated_at = now() where entity = ?", pattern, actor.getId(), entity);
            String reason = request.reason() == null ? "" : request.reason().trim();
            audit.logAs(actor, "TRAINING_CODE_RULE", entity, UUID.nameUUIDFromBytes(("training-code-rule-" + entity).getBytes()), "TRAINING_CODE_RULE_UPDATED", String.valueOf(current.get("pattern")), pattern,
                    (reason.isEmpty() ? "" : reason + " | ") + label(entity) + ": " + current.get("pattern") + " -> " + pattern + " (the codes already issued are not changed)");
        }
        return rules(actor).stream().filter(r -> entity.equals(r.get("entity"))).findFirst().orElseThrow();
    }

    /** The code a pattern would give, to show before it is saved. A pattern the rules do not allow is refused with the same code as a save. */
    @Transactional(readOnly = true)
    public Map<String, Object> preview(UserAccount actor, PreviewRequest request) {
        access.require(actor, "training.settings.view", "training.settings.manage");
        if (request == null) throw new IllegalArgumentException("TRAINING_CODE_RULE_INVALID");
        requireEntity(request.entity());
        String pattern = request.pattern() == null ? "" : request.pattern().trim();
        validate(request.entity(), pattern);
        return Map.of("example", example(request.entity(), pattern));
    }

    // ------------------------------------------------------------------------------------------------------------------------------ the pattern

    static String label(String entity) {
        return switch (entity) {
            case REQUIREMENT -> "Training Requirement";
            case MATRIX -> "Training Matrix";
            default -> "Training Assessment";
        };
    }

    private static void requireEntity(String entity) {
        if (entity == null || !ENTITIES.contains(entity)) throw new IllegalArgumentException("TRAINING_CODE_RULE_INVALID");
    }

    /** A pattern made of letters, digits and / . _ - and the parts; each part once; the requirement and the assessment need a number; the matrix needs the department; the assessment has no department. */
    static void validate(String entity, String pattern) {
        if (pattern.isEmpty() || pattern.length() > 60 || !ALLOWED.matcher(pattern).matches()) throw new IllegalArgumentException("TRAINING_CODE_RULE_INVALID");
        int years = 0, depts = 0, seqs = 0;
        Matcher m = TOKEN.matcher(pattern);
        while (m.find()) {
            String part = m.group(1);
            if (part.equals("YYYY") || part.equals("YY")) years++;
            else if (part.equals("DEPT")) depts++;
            else seqs++;
        }
        if (years > 1 || depts > 1 || seqs > 1) throw new IllegalArgumentException("TRAINING_CODE_RULE_INVALID");
        if (!MATRIX.equals(entity) && seqs != 1) throw new IllegalArgumentException("TRAINING_CODE_RULE_NUMBER_REQUIRED");
        if (MATRIX.equals(entity) && depts != 1) throw new IllegalArgumentException("TRAINING_CODE_RULE_DEPARTMENT_REQUIRED");
        if (ASSESSMENT.equals(entity) && depts > 0) throw new IllegalArgumentException("TRAINING_CODE_RULE_DEPARTMENT_NOT_ALLOWED");
        // the longest code the rule can give has to fit the column of the code
        if (format(pattern, "WWWWWWWWWW", 2099, 99999999L).length() > CODE_LIMIT) throw new IllegalArgumentException("TRAINING_CODE_RULE_TOO_LONG");
    }

    static String format(String pattern, String department, int year, long number) {
        Matcher m = TOKEN.matcher(pattern);
        StringBuilder out = new StringBuilder();
        while (m.find()) {
            String token = m.group(1);
            String value;
            if (token.equals("YYYY")) value = String.format("%04d", year);
            else if (token.equals("YY")) value = String.format("%02d", year % 100);
            else if (token.equals("DEPT")) value = department == null ? "" : department.toUpperCase(java.util.Locale.ROOT);
            else value = String.format("%0" + (m.group(2) == null ? 4 : Integer.parseInt(m.group(2))) + "d", number);
            m.appendReplacement(out, Matcher.quoteReplacement(value));
        }
        m.appendTail(out);
        return out.toString();
    }

    private static String example(String entity, String pattern) {
        try {
            validate(entity, pattern);
            return format(pattern, "QA", LocalDate.now().getYear(), 1);
        } catch (IllegalArgumentException e) {
            return "";
        }
    }

    // ------------------------------------------------------------------------------------------------------------------------------ the codes

    /**
     * The next code of a record. {@code department} is the code of the department (the matrix, the requirement); {@code year} the year of the record. The caller is in a transaction, so the number
     * taken here is lost with it if the record is not saved. {@code exists} says whether a code is already used (a code made by an older rule can be the same).
     */
    @Transactional
    public String next(String entity, String department, int year, Predicate<String> exists) {
        requireEntity(entity);
        String pattern = jdbc.queryForList("select pattern from training_code_rules where entity = ?", String.class, entity).stream().findFirst().orElseThrow();
        boolean withYear = pattern.contains("{YYYY}") || pattern.contains("{YY}");
        boolean withDept = pattern.contains("{DEPT}");
        boolean withSeq = pattern.contains("{SEQ");
        for (int attempt = 0; attempt < 200; attempt++) {
            long number = 0;
            if (withSeq) {
                String scope = (withYear ? "Y" + year : "") + (withDept ? "D" + department : "");
                Long taken = jdbc.queryForObject("""
                    insert into training_code_counters(entity, scope_key, last_value) values (?, ?, 1)
                    on conflict (entity, scope_key) do update set last_value = training_code_counters.last_value + 1 returning last_value
                    """, Long.class, entity, scope);
                number = taken == null ? 1 : taken;
            }
            String code = format(pattern, department, year, number);
            if (code.length() > CODE_LIMIT) throw new IllegalArgumentException("TRAINING_CODE_RULE_TOO_LONG");
            if (!exists.test(code)) return code;
            if (!withSeq) throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_CODE_ALREADY_USED");
        }
        throw new ResponseStatusException(HttpStatus.CONFLICT, "TRAINING_CODE_ALREADY_USED");
    }
}
