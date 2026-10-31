package com.eqms.service.training;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.jdbc.core.JdbcTemplate;

import java.text.Normalizer;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * The name of the file a person downloads from Training Management (an APD form made as Word or PDF). The name comes from a pattern that the administrator sets for each form in Training
 * Properties; a form without a pattern uses the default below. The pattern is plain text with variables in braces, for example {@code {FILE_CODE}_{EMPLOYEE_CODE}_{EMPLOYEE_NAME}_{DATE}}.
 * {@code FILE_CODE} is the code of the form with the revision in force as Document Control writes it (APD.0014.02). The result never holds a character that a file system refuses, never has
 * accents, and is at most 120 characters; a pattern with an unknown variable is refused when it is saved.
 */
public class TrainingFileNames {
    /** One form: its label on the screen, the default pattern and the variables the pattern may use. */
    public record Form(String key, String label, String defaultPattern, List<String> variables) {}

    private static final Map<String, String> VARIABLE_HELP = new LinkedHashMap<>();
    static {
        VARIABLE_HELP.put("FILE_CODE", "Code of the form with the revision in force, for example APD.0014.02");
        VARIABLE_HELP.put("EMPLOYEE_CODE", "Employee ID");
        VARIABLE_HELP.put("EMPLOYEE_NAME", "Full name of the employee");
        VARIABLE_HELP.put("DEPARTMENT", "Department");
        VARIABLE_HELP.put("TRAINING_NUMBER", "Training Number");
        VARIABLE_HELP.put("SESSION_NO", "Session number (01, 02...)");
        VARIABLE_HELP.put("MATRIX_CODE", "Code of the training matrix");
        VARIABLE_HELP.put("VERSION", "Version of the matrix");
        VARIABLE_HELP.put("ISSUE_NO", "Issuance number of the job assignment");
        VARIABLE_HELP.put("REQUEST_NO", "Number of the training requirement");
        VARIABLE_HELP.put("YEAR", "Year");
        VARIABLE_HELP.put("DATE", "Day the file is made (yyyyMMdd)");
    }

    public static final List<Form> FORMS = List.of(
            new Form("APD.0011", "APD.0011 Training matrix", "{FILE_CODE}_{MATRIX_CODE}_v{VERSION}", List.of("FILE_CODE", "MATRIX_CODE", "VERSION", "DEPARTMENT", "DATE")),
            new Form("APD.0014", "APD.0014 Personal training record (one person)", "{FILE_CODE}_{EMPLOYEE_CODE}_{EMPLOYEE_NAME}_{DATE}", List.of("FILE_CODE", "EMPLOYEE_CODE", "EMPLOYEE_NAME", "DEPARTMENT", "DATE")),
            new Form("APD.0014.BATCH", "APD.0014 Personal training records (a department and a year)", "{FILE_CODE}_{DEPARTMENT}_{YEAR}", List.of("FILE_CODE", "DEPARTMENT", "YEAR", "DATE")),
            new Form("APD.0024", "APD.0024 Job assignment", "{FILE_CODE}_{EMPLOYEE_CODE}_{EMPLOYEE_NAME}_{ISSUE_NO}", List.of("FILE_CODE", "EMPLOYEE_CODE", "EMPLOYEE_NAME", "DEPARTMENT", "ISSUE_NO", "DATE")),
            new Form("APD.0108", "APD.0108 List of personnel for SOP self-reading", "{FILE_CODE}_{TRAINING_NUMBER}_S{SESSION_NO}_{DEPARTMENT}", List.of("FILE_CODE", "TRAINING_NUMBER", "SESSION_NO", "DEPARTMENT", "DATE")),
            new Form("APD.0117", "APD.0117 Training attendance list", "{FILE_CODE}_{TRAINING_NUMBER}", List.of("FILE_CODE", "TRAINING_NUMBER", "YEAR", "DATE")),
            new Form("APD.0118", "APD.0118 Training requirement", "{FILE_CODE}_{REQUEST_NO}", List.of("FILE_CODE", "REQUEST_NO", "YEAR", "DATE")));

    private static final Pattern TOKEN = Pattern.compile("\\{([A-Z_]+)}");
    private static final int MAX = 120;
    private static final ObjectMapper JSON = new ObjectMapper();

    private final JdbcTemplate jdbc;

    public TrainingFileNames(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public static Form form(String key) {
        return FORMS.stream().filter(f -> f.key().equals(key)).findFirst().orElseThrow(() -> new IllegalArgumentException("TRAINING_FILE_NAME_FORM_UNKNOWN"));
    }

    /** The patterns the administrator saved (form key to pattern). */
    public Map<String, String> saved() {
        List<String> rows = jdbc.queryForList("select download_file_names::text from training_settings where id = 1", String.class);
        if (rows.isEmpty() || rows.getFirst() == null) return Map.of();
        try {
            return JSON.readValue(rows.getFirst(), new TypeReference<Map<String, String>>() {});
        } catch (JsonProcessingException e) {
            return Map.of();
        }
    }

    public static String toJson(Map<String, String> patterns) {
        try {
            return JSON.writeValueAsString(patterns);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException(e);
        }
    }

    /** The pattern in force for a form: the saved one, or the default. */
    public String pattern(String key) {
        String saved = saved().get(key);
        return saved == null || saved.isBlank() ? form(key).defaultPattern() : saved;
    }

    /** The file name (without the extension) of the form, made from the pattern in force. */
    public String name(String key, String fileCode, Map<String, String> values) {
        Map<String, String> all = new LinkedHashMap<>(values);
        all.put("FILE_CODE", fileCode);
        all.putIfAbsent("DATE", LocalDate.now(ZoneId.of("Asia/Ho_Chi_Minh")).format(DateTimeFormatter.BASIC_ISO_DATE));
        all.putIfAbsent("YEAR", String.valueOf(LocalDate.now(ZoneId.of("Asia/Ho_Chi_Minh")).getYear()));
        String result = render(pattern(key), all);
        if (result.isBlank()) result = render(form(key).defaultPattern(), all);
        return result.isBlank() ? sanitize(fileCode) : result;
    }

    /** A pattern with its variables replaced; each value is made safe by itself, so a "/" in a Training Number becomes "-" and the separators of the pattern stay as typed. */
    static String render(String pattern, Map<String, String> values) {
        Matcher m = TOKEN.matcher(pattern);
        StringBuilder out = new StringBuilder();
        while (m.find()) m.appendReplacement(out, Matcher.quoteReplacement(sanitize(values.getOrDefault(m.group(1), ""))));
        m.appendTail(out);
        return cut(out.toString().replaceAll("[\\\\/:*?\"<>|\\p{Cntrl}]+", "-").replaceAll("\\s+", "-").replaceAll("-{2,}", "-").replaceAll("^[-_.]+|[-_.]+$", ""));
    }

    /** Without accents, the characters a file system refuses and the blanks become "-"; a name never starts or ends with a separator. */
    static String sanitize(String text) {
        if (text == null) return "";
        String plain = Normalizer.normalize(text.replace('đ', 'd').replace('Đ', 'D'), Normalizer.Form.NFD).replaceAll("\\p{M}+", "");
        return plain.replaceAll("[\\\\/:*?\"<>|\\p{Cntrl}]+", "-").replaceAll("\\s+", "-").replaceAll("-{2,}", "-").replaceAll("^-+|-+$", "");
    }

    private static String cut(String text) {
        return text.length() <= MAX ? text : text.substring(0, MAX).replaceAll("[-_.]+$", "");
    }

    /** Refuses a pattern with a variable the form does not know or with characters of a path; returns the problems (empty when it is good). */
    public static List<String> problems(String key, String pattern) {
        List<String> out = new ArrayList<>();
        if (pattern == null || pattern.isBlank()) return out;
        if (pattern.length() > 200) out.add("The pattern is longer than 200 characters");
        if (pattern.matches(".*[\\\\/:*?\"<>|].*")) out.add("A file name cannot hold \\ / : * ? \" < > |");
        Form form = form(key);
        Matcher m = TOKEN.matcher(pattern);
        boolean any = false;
        while (m.find()) {
            any = true;
            if (!form.variables().contains(m.group(1))) out.add("{" + m.group(1) + "} is not a variable of this form");
        }
        String rest = pattern.replaceAll("\\{[A-Z_]+}", "");
        if (rest.contains("{") || rest.contains("}")) out.add("A brace is not closed");
        if (!any) out.add("The pattern needs at least one variable, otherwise every file has the same name");
        return out;
    }

    /** What the screen shows for each form: the label, the pattern in force, the default, the variables with their meaning, and an example. */
    public List<Map<String, Object>> describe() {
        Map<String, String> saved = saved();
        List<Map<String, Object>> list = new ArrayList<>();
        for (Form f : FORMS) {
            Map<String, Object> row = new LinkedHashMap<>();
            String pattern = saved.get(f.key()) == null || saved.get(f.key()).isBlank() ? f.defaultPattern() : saved.get(f.key());
            row.put("form", f.key());
            row.put("label", f.label());
            row.put("pattern", pattern);
            row.put("defaultPattern", f.defaultPattern());
            List<Map<String, String>> vars = new ArrayList<>();
            for (String v : f.variables()) vars.add(Map.of("name", v, "meaning", VARIABLE_HELP.get(v)));
            row.put("variables", vars);
            row.put("example", example(f, pattern));
            list.add(row);
        }
        return list;
    }

    public static String example(Form f, String pattern) {
        Map<String, String> v = new LinkedHashMap<>();
        v.put("FILE_CODE", f.key().startsWith("APD.0014") ? "APD.0014.02" : f.key() + ".02");
        v.put("EMPLOYEE_CODE", "NT-0123");
        v.put("EMPLOYEE_NAME", "Nguyễn Văn An");
        v.put("DEPARTMENT", "Quality Control");
        v.put("TRAINING_NUMBER", "TRN/QC/26-045");
        v.put("SESSION_NO", "01");
        v.put("MATRIX_CODE", "TM-QC");
        v.put("VERSION", "3");
        v.put("ISSUE_NO", "2");
        v.put("REQUEST_NO", "TR/QC/26-001");
        v.put("YEAR", "2026");
        v.put("DATE", "20261101");
        String name = render(pattern, v);
        return (name.isBlank() ? render(f.defaultPattern(), v) : name) + (f.key().endsWith("BATCH") ? ".zip" : ".pdf");
    }
}
