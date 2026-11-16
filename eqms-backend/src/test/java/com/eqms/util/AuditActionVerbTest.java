package com.eqms.util;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

/** REPORT-AUDIT-DISPLAY-2026-11-17: the Action of an audit record is one short verb; the codes below are the ones of the DEV audit log. */
class AuditActionVerbTest {
    private static final Map<String, String> CASES = Map.ofEntries(
            Map.entry("CREATE", "Create"), Map.entry("TRAINING_ACTIVITY_CREATED", "Create"), Map.entry("TRAINING_SESSION_ADDED", "Create"),
            Map.entry("REVIEW_PDF_GENERATED", "Create"), Map.entry("ISSUE_TRUSTED_DEVICE", "Create"),
            Map.entry("UPDATE", "Update"), Map.entry("TRAINING_PREPARATION_UPDATED", "Update"), Map.entry("ACCESS_PROFILE_PERMISSIONS_REPLACED", "Update"),
            Map.entry("DELETE", "Delete"), Map.entry("DEPARTMENT_DELETED", "Delete"),
            Map.entry("VIEW", "View"), Map.entry("OPEN_PREVIEW", "View"), Map.entry("CLOSE_PREVIEW", "View"), Map.entry("VIEW_PAGE", "View"),
            Map.entry("SUBMIT_FOR_REVIEW", "Submit"), Map.entry("REPORT_RUN_QUEUED", "Submit"),
            Map.entry("TRAINING_CONTENT_REVIEW", "Review"), Map.entry("TRAINING_CONTENT_APPROVE", "Approve"), Map.entry("APPROVE_REJECT", "Reject"),
            Map.entry("TRAINING_LIST_CONFIRMED", "Confirm"), Map.entry("ALERT_ACKNOWLEDGED", "Confirm"),
            Map.entry("OBSOLETE", "Obsolete"), Map.entry("CANCEL", "Cancel"), Map.entry("PUBLISH_TO_EFFECTIVE", "Publish"),
            Map.entry("ACTIVATE", "Enable"), Map.entry("REPORT_TEMPLATE_DISABLED", "Disable"), Map.entry("USER_TERMINATED", "Disable"),
            Map.entry("LOGIN", "Login"), Map.entry("FAILED_LOGIN", "Login Failed"), Map.entry("LOGOUT", "Logout"),
            Map.entry("SESSION_REAUTH_SUCCESS", "Re-authenticate"), Map.entry("SESSION_REAUTH_FAILED", "Re-authenticate Failed"),
            Map.entry("SEND_EMAIL", "Send"), Map.entry("SEND_EMAIL_FAILED", "Send Failed"),
            Map.entry("REVISION_SOURCE_FILE_UPLOADED", "Upload"), Map.entry("TRAINING_ATTENDANCE_LIST_EXPORTED", "Export"),
            Map.entry("REPORT_ARTIFACT_VERIFIED", "Verify"), Map.entry("REPORT_ARTIFACT_VERIFY_MISMATCH", "Verify Failed"),
            Map.entry("REPORT_RUN_COMPLETED", "Complete"), Map.entry("REPORT_RUN_FAILED", "Fail"), Map.entry("REPORT_RUN_RETRY_SCHEDULED", "Retry"),
            Map.entry("WORKFLOW_ACCESS_DENIED", "Access Denied"), Map.entry("DOCUMENT_ELECTRONICALLY_SIGNED", "Sign"),
            Map.entry("TRAINING_APPROVER_DESIGNATED", "Assign"), Map.entry("REVOKE_TRUSTED_DEVICES", "Revoke"), Map.entry("RECALL", "Recall"));

    @Test
    void aCodeIsReadAsItsVerb() {
        CASES.forEach((code, verb) -> assertEquals(verb, AuditActionVerb.of(code), code));
    }

    @Test
    void theSpellingOfTheCodeDoesNotMatter() {
        assertEquals("Create", AuditActionVerb.of("training activity created"));
        assertEquals("Login Failed", AuditActionVerb.of("Failed Login"));
        assertEquals("Update", AuditActionVerb.of(null));
        assertEquals("Update", AuditActionVerb.of("  "));
    }

    @Test
    void aCodeNoRuleNamesKeepsItsOwnWordsAndIsNeverGuessed() {
        assertFalse(AuditActionVerb.isNamed("FOO_BAR"));
        assertEquals("Foo Bar", AuditActionVerb.of("FOO_BAR"));
    }

    @Test
    void aFilterByAVerbSelectsEveryCodeItNames() {
        List<String> inUse = List.of("CREATE", "TRAINING_ACTIVITY_CREATED", "UPDATE", "SEND_EMAIL");
        assertEquals(List.of("CREATE", "TRAINING_ACTIVITY_CREATED"), AuditActionVerb.codesOf("Create", inUse));
        assertEquals(List.of("SEND_EMAIL"), AuditActionVerb.codesOf("send", inUse));
        assertTrue(AuditActionVerb.verbs().contains("Approve") && AuditActionVerb.verbs().size() < 45, "the vocabulary stays small");
    }

    @Test
    void theSqlFormComesFromTheSameRules() {
        String sql = AuditActionVerb.sqlCase("al.action_type");
        for (String verb : AuditActionVerb.verbs()) assertTrue(sql.contains("then '" + verb + "'"), verb);
        assertTrue(sql.contains("FAILED_LOGIN") && sql.endsWith("end)"));
        assertFalse(sql.contains(";"));
    }
    /** The Action filter of the screen lists the vocabulary: the list in the front end must be the one of the server. */
    @Test
    void theListOfTheScreenIsTheVocabularyOfTheServer() throws Exception {
        java.nio.file.Path file = java.nio.file.Path.of("../eqms/src/features/audit-trail/utils/auditActionVerbs.ts");
        org.junit.jupiter.api.Assumptions.assumeTrue(java.nio.file.Files.exists(file), "the front end is not beside the back end here");
        java.util.Set<String> onScreen = new java.util.TreeSet<>();
        java.util.regex.Matcher m = java.util.regex.Pattern.compile("^\s+\"([^\"]+)\",$", java.util.regex.Pattern.MULTILINE).matcher(java.nio.file.Files.readString(file));
        while (m.find()) onScreen.add(m.group(1));
        assertEquals(new java.util.TreeSet<>(AuditActionVerb.verbs()), onScreen);
    }
}
