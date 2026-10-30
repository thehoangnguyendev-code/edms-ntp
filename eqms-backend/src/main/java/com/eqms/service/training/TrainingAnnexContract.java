package com.eqms.service.training;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * What the system fixes for each APD (PLAN-TR-004 section 8): the tokens that exist, which of them a template must carry, the cases, the signature slots and the meaning of the electronic
 * signature that fills each slot. The users of Training Administration only place these tokens in the Word file; they cannot add a field, a case or a slot. A token that is not in the
 * contract is refused when the template is checked, so that a typing error never becomes an empty place in a record.
 */
public final class TrainingAnnexContract {
    /** A signature slot and the meanings of the electronic signature records that fill it, in the order of signing. */
    public record Slot(String name, String stage, List<String> meanings) {}

    private final String code;
    private final Set<String> scalars = new LinkedHashSet<>();
    private final Map<String, Set<String>> groups = new LinkedHashMap<>();
    private final Set<String> each = new LinkedHashSet<>();
    private final Set<String> cases = new LinkedHashSet<>();
    private final Set<String> checks = new LinkedHashSet<>();
    private final Set<String> blocks = new LinkedHashSet<>();
    private final Map<String, Slot> slots = new LinkedHashMap<>();
    private final Set<String> optional = new LinkedHashSet<>();
    private boolean tokens = true;

    private TrainingAnnexContract(String code) {
        this.code = code;
    }

    public String code() { return code; }
    public boolean checked() { return tokens; }
    public Map<String, Slot> slots() { return slots; }
    public Set<String> cases() { return cases; }
    public Set<String> scalars() { return scalars; }
    public Map<String, Set<String>> groups() { return groups; }
    public Set<String> each() { return each; }
    public Set<String> checks() { return checks; }
    public Set<String> blocks() { return blocks; }
    public Set<String> optionalTokens() { return optional; }

    /**
     * The code of the form as Document Control writes it: the document number and the two digits of the major number of the revision that is in force, for example APD.0024 with the revision
     * 2.0.0 is APD.0024.02. A revision that does not begin with a number leaves the code as it is.
     */
    public static String fullCode(String code, String revision) {
        java.util.regex.Matcher m = java.util.regex.Pattern.compile("^\\s*(\\d{1,3})(?:\\.\\d+){0,2}\\s*$").matcher(revision == null ? "" : revision);
        return m.matches() ? code + "." + String.format("%02d", Integer.parseInt(m.group(1))) : code;
    }

    /** A revision number as Document Control writes it: 1, 1.0 or 1.0.0. */
    public static boolean validRevision(String revision) {
        return revision != null && revision.trim().matches("\\d{1,3}(\\.\\d{1,3}){0,2}");
    }

    /** The title of the form, as the company names it. */
    public static String title(String code) {
        return switch (code) {
            case "APD.0009" -> "Training assessment";
            case "APD.0011" -> "Training matrix";
            case "APD.0014" -> "Personal training record";
            case "APD.0024" -> "Job assignment";
            case "APD.0108" -> "List of personnel for SOP self-reading";
            case "APD.0117" -> "Training attendance sheet";
            case "APD.0118" -> "Training requirement";
            default -> code;
        };
    }

    private TrainingAnnexContract scalar(String... names) { scalars.addAll(List.of(names)); return this; }
    private TrainingAnnexContract group(String name, String... fields) { groups.computeIfAbsent(name, k -> new LinkedHashSet<>()).addAll(List.of(fields)); return this; }
    private TrainingAnnexContract repeat(String name) { each.add(name); return this; }
    private TrainingAnnexContract caseOf(String... names) { cases.addAll(List.of(names)); return this; }
    private TrainingAnnexContract check(String... names) { checks.addAll(List.of(names)); return this; }
    private TrainingAnnexContract block(String... names) { blocks.addAll(List.of(names)); return this; }
    private TrainingAnnexContract slot(String name, String stage, String... meanings) { slots.put(name, new Slot(name, stage, List.of(meanings))); return this; }
    private TrainingAnnexContract optional(String... names) { optional.addAll(List.of(names)); return this; }

    /** The tokens that every template of the code must carry, by their written name. */
    public Set<String> required() {
        Set<String> out = new LinkedHashSet<>();
        scalars.forEach(s -> { if (!optional.contains(s)) out.add(s); });
        groups.forEach((g, fields) -> fields.forEach(f -> { if (!optional.contains(g + "." + f)) out.add(g + "." + f); }));
        each.forEach(g -> out.add("EACH:" + g));
        checks.forEach(c -> out.add("CHECK:" + c));
        blocks.forEach(b -> out.add("BLOCK:" + b));
        slots.keySet().forEach(s -> { if (!optional.contains("SIGNATURE:" + s)) out.add("SIGNATURE:" + s); });
        return out;
    }

    /** The tokens a template may carry (required or optional). */
    Set<String> allowed() {
        Set<String> out = new LinkedHashSet<>(required());
        out.addAll(scalars);
        groups.forEach((g, fields) -> fields.forEach(f -> out.add(g + "." + f)));
        slots.keySet().forEach(s -> out.add("SIGNATURE:" + s));
        cases.forEach(c -> out.add("CASE:" + c));
        out.addAll(List.of("FORM_CODE", "FORM_REVISION", "GENERATED_AT"));
        return out;
    }

    /** The problems of a template against the contract: markers, a missing token, a token that the system does not know. Empty when the template can be enabled. */
    public List<String> check(TrainingAnnexEngine.Scan scan) {
        List<String> problems = new ArrayList<>(scan.errors());
        Set<String> found = new LinkedHashSet<>();
        found.addAll(scan.scalars());
        scan.groupFields().forEach((g, fields) -> fields.forEach(f -> found.add(g + "." + f)));
        scan.eachGroups().forEach(g -> found.add("EACH:" + g));
        scan.cases().forEach(c -> found.add("CASE:" + c));
        scan.checks().forEach(c -> found.add("CHECK:" + c));
        scan.blocks().forEach(b -> found.add("BLOCK:" + b));
        scan.signatures().forEach(s -> found.add("SIGNATURE:" + s));
        Set<String> allowed = allowed();
        for (String f : found) if (!allowed.contains(f)) problems.add("unknown token: " + f);
        for (String r : required()) if (!found.contains(r)) problems.add("missing token: " + r);
        return problems;
    }

    // ------------------------------------------------------------------------------------------------------------------------------ the forms

    public static TrainingAnnexContract of(String code) {
        return switch (code) {
            case "APD.0117" -> new TrainingAnnexContract(code)
                    .scalar("TRAINING_NUMBER", "ACTIVITY_CONTENT", "DEPARTMENT", "TRAINING_TYPE", "LIST_PREPARER_NAME", "QA_CONFIRMER_NAME")
                    .group("TOPIC", "SESSION_NO", "DOCUMENT_NUMBER", "TITLE", "MODE", "TRAINER", "EXECUTION_DATE")
                    .repeat("SESSION").group("SESSION", "LABEL")
                    .group("ATTENDEE", "NO", "CODE", "NAME", "DEPARTMENT", "RESULT", "RETRAINING_RESULT")
                    .group("TRAINER", "SESSION_NO", "NAME")
                    .caseOf("EXTERNAL")
                    .slot("LIST_PREPARED", "M1 the list is prepared", "TRAINING_LIST_VERIFIED")
                    .slot("ATTENDEE.ATTENDANCE", "M2 the session takes place", "TRAINING_ATTENDED", "TRAINING_ATTENDANCE_CONFIRMED")
                    .slot("TRAINER.SENT", "M2b the trainer sends the list", "TRAINING_ATTENDANCE_SENT")
                    .slot("QA_COMPLETION", "M4 QA completes", "TRAINING_COMPLETED")
                    .optional("ATTENDEE.RETRAINING_RESULT", "ATTENDEE.RESULT", "QA_CONFIRMER_NAME");
            case "APD.0108" -> new TrainingAnnexContract(code)
                    .scalar("DEPARTMENT", "DOCUMENT_NAME_VERSION", "HEAD_NAME", "HEAD_POSITION", "HEAD_DATE", "HEAD_REMARKS")
                    .group("READER", "NO", "CODE", "NAME", "TRAINING_NUMBER", "DATE")
                    .slot("READER.CONFIRMED", "M2 the employee confirms the reading", "TRAINING_READ_CONFIRMED")
                    .slot("HEAD", "M3 the head of department verifies", "TRAINING_READ_VERIFIED")
                    .optional("HEAD_POSITION", "HEAD_DATE", "HEAD_REMARKS");
            case "APD.0118" -> new TrainingAnnexContract(code)
                    .scalar("YEAR", "REQUEST_NO")
                    .check("KIND_PERIODIC_SOP", "KIND_ANNUAL")
                    .group("LINE", "NO", "MONTH", "TOPIC", "CODE", "EXECUTION_DATE", "QA_COMMENT")
                    .slot("PREPARED", "M1 the requirement is prepared", "TRAINING_REQUIREMENT_PREPARED")
                    .slot("REVIEWED", "M1 QA manager reviews", "TRAINING_REQUIREMENT_REVIEWED")
                    .slot("APPROVED", "M1 QM approves", "TRAINING_REQUIREMENT_APPROVED")
                    .slot("LINE.QA", "M2 QA records a line after the training", "TRAINING_COMPLETED")
                    .optional("LINE.CODE", "LINE.EXECUTION_DATE", "LINE.QA_COMMENT", "SIGNATURE:LINE.QA");
            case "APD.0011" -> new TrainingAnnexContract(code)
                    .scalar("DEPARTMENT", "MATRIX_CODE", "MATRIX_VERSION")
                    .block("MATRIX")
                    .slot("MATRIX", "M1 the matrix is prepared and approved", "TRAINING_MATRIX_PREPARED", "TRAINING_MATRIX_APPROVED");
            case "APD.0024" -> new TrainingAnnexContract(code)
                    .scalar("EMPLOYEE_CODE", "EMPLOYEE_NAME", "ISSUANCE_NO", "MATRIX_CODE_VERSION", "JURISDICTION", "ASSIGNOR_TITLE",
                            "DEPARTMENT", "POSITION", "SUPERIOR", "SUBORDINATES", "SUBSTITUTE", "CURRENT_POSITION", "CHANGE_REASON", "NEW_POSITION")
                    .check("CASE_INITIAL", "CASE_CHANGE")
                    .caseOf("INITIAL", "CHANGE")
                    .group("DUTY", "RESPONSIBILITY", "DESCRIPTION")
                    .slot("ASSIGNOR", "M1 the head of department assigns", "TRAINING_JOB_ASSIGNED")
                    .slot("RECEIVER", "M2 the employee accepts", "TRAINING_JOB_ACCEPTED")
                    .optional("JURISDICTION", "ASSIGNOR_TITLE", "MATRIX_CODE_VERSION");
            case "APD.0014" -> new TrainingAnnexContract(code)
                    .scalar("EMPLOYEE_CODE", "EMPLOYEE_NAME", "QUALIFICATION", "JOIN_DATE", "PREPARED_DATE", "APPROVED_DATE")
                    .group("RECORD", "CONTENT", "DATE", "NUMBER")
                    .slot("PREPARED", "the record is prepared for print", "TRAINING_RECORD_PREPARED")
                    .slot("APPROVED", "the QA manager approves", "TRAINING_RECORD_APPROVED");
            case "APD.0009" -> {
                TrainingAnnexContract c = new TrainingAnnexContract(code);
                c.tokens = false;
                yield c;
            }
            default -> null;
        };
    }

    public static List<String> codes() {
        return List.of("APD.0009", "APD.0011", "APD.0014", "APD.0024", "APD.0108", "APD.0117", "APD.0118");
    }
}
