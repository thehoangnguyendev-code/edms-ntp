package com.eqms.util;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** The server shows a machine value as words, in one wording, and never changes a value that already is words. */
class DisplayLabelsTest {

    @Test
    void aStatusBecomesWordsAndKeepsTheAbbreviationsInCapitals() {
        assertEquals("In Progress", DisplayLabels.status("IN_PROGRESS"));
        assertEquals("Pending QA Confirmation", DisplayLabels.status("PENDING_QA_CONFIRMATION"));
        assertEquals("Ready for Distribution", DisplayLabels.status("READY_FOR_DISTRIBUTION"));
        assertEquals("Planned", DisplayLabels.status("PLANNED"));
        assertEquals("Open", DisplayLabels.status("OPEN"));
        assertEquals("Not Verified", DisplayLabels.status("NOT_VERIFIED"));
    }

    @Test
    void theWordsOfTheStatusTablesAreKept() {
        assertEquals("Closed - Cancelled", DisplayLabels.status("CLOSED_CANCELLED"));
        assertEquals("Closed - Cancelled", DisplayLabels.status("CANCELLED"));
        assertEquals("Pending Document Approval", DisplayLabels.status("RESERVED"));
    }

    @Test
    void aValueThatAlreadyIsAWordOrAnAbbreviationIsReturnedAsItWas() {
        assertEquals("Pending Training", DisplayLabels.status("Pending Training"));
        assertEquals("Effective", DisplayLabels.status("Effective"));
        assertEquals("SOP", DisplayLabels.status("SOP"));
        assertEquals("DOCX", DisplayLabels.status("DOCX"));
        assertNull(DisplayLabels.status(null));
        assertFalse(DisplayLabels.isMachineValue("SOP.0032"));
        assertTrue(DisplayLabels.isMachineValue("PENDING"));
    }

    @Test
    void aModuleIsNamedAsItsMenuIsWhateverItsSpelling() {
        assertEquals("Document Control", DisplayLabels.module("documents"));
        assertEquals("Document Control", DisplayLabels.module("DOCUMENT_CONTROL"));
        assertEquals("Training Management", DisplayLabels.module("training"));
        assertEquals("Reports", DisplayLabels.module("report"));
        assertEquals("Audit Trail", DisplayLabels.module("audit-trail"));
        assertEquals("Backup & Restore", DisplayLabels.module("backup"));
        assertEquals("Some New Module", DisplayLabels.module("some_new-module"));
    }

    @Test
    void aCodeInsideASentenceIsWrittenAsWordsAndNothingElseIsTouched() {
        assertEquals("The test restore RH-20261116-0020 of BK-20261116-2000-0004 failed: Restore Database Failed",
                DisplayLabels.prose("The test restore RH-20261116-0020 of BK-20261116-2000-0004 failed: RESTORE_DATABASE_FAILED"));
        assertEquals("workflow roles: Document Author, Document Reviewer", "workflow roles: " + DisplayLabels.prose("DOCUMENT_AUTHOR, DOCUMENT_REVIEWER"));
        assertEquals("Legacy Batch Full Flow SOP_3.0.0", DisplayLabels.prose("Legacy Batch Full Flow SOP_3.0.0"));
        assertEquals("E2E_AUTHZ_PROFILE_POS_115645", DisplayLabels.prose("E2E_AUTHZ_PROFILE_POS_115645"));
        assertNull(DisplayLabels.prose(null));
    }

    @Test
    void aCodeWithADigitInItAndASeverityWordInASentenceAreWrittenAsWords() {
        assertEquals("Backup alert BAL-2026-00012: Backup V2 Overdue", DisplayLabels.prose("Backup alert BAL-2026-00012: BACKUP_V2_OVERDUE"));
        assertEquals("No V2 verification has passed in the last 8 days (Severity: High)", DisplayLabels.prose("No V2 verification has passed in the last 8 days (Severity: HIGH)"));
        assertEquals("Legacy Batch SOP_3.0.0", DisplayLabels.prose("Legacy Batch SOP_3.0.0"));
        assertEquals("Profile API_SUITE_PROFILE_115505 deleted", DisplayLabels.prose("Profile API_SUITE_PROFILE_115505 deleted"));
    }

    @Test
    void anOldPreparationCommentNamesItsItemInWords() {
        assertEquals("Session S1, Materials", DisplayLabels.prose("Session S1, MATERIALS"));
        assertEquals("Session S2, Venue. Room 4", DisplayLabels.prose("Session S2, VENUE. Room 4"));
    }
}
