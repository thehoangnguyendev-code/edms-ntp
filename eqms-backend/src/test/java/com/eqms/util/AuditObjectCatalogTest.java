package com.eqms.util;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import org.junit.jupiter.api.Test;

/** REPORT-AUDIT-DISPLAY-2026-11-17: the Object Type and the Object Code of an audit record; the values are the ones found in the DEV audit log. */
class AuditObjectCatalogTest {
    @Test
    void theObjectTypeIsTheDefaultNameOfTheMenuHoweverTheKindWasSpelled() {
        assertEquals("Controlled Copies", AuditObjectCatalog.typeLabel("CONTROLLED_COPY"));
        assertEquals("Controlled Copies", AuditObjectCatalog.typeLabel("Controlled Copy"));
        assertEquals("Controlled Copies", AuditObjectCatalog.typeLabel("ControlledCopyRecord"));
        assertEquals("Controlled Copies", AuditObjectCatalog.typeLabel("CONTROLLED_COPY_DISTRIBUTION_BATCH"), "a batch has the menu of its parent and is found by its own code");
        assertEquals("All Documents", AuditObjectCatalog.typeLabel("documents"));
        assertEquals("Document Revisions", AuditObjectCatalog.typeLabel("Revision"));
        assertEquals("Logged in Users", AuditObjectCatalog.typeLabel("SESSION"));
        assertEquals("Report Run History", AuditObjectCatalog.typeLabel("REPORT_ARTIFACT"));
        assertEquals("Training Activities", AuditObjectCatalog.typeLabel("TRAINING_ACTIVITY"));
        assertEquals("Segregation of Duties", AuditObjectCatalog.typeLabel("SOD_CONSTRAINT"));
        assertEquals("-", AuditObjectCatalog.typeLabel(null));
        assertEquals("Some New Kind", AuditObjectCatalog.typeLabel("SOME_NEW_KIND"), "an unregistered kind is written in words (the build fails for it)");
    }

    @Test
    void aDocumentIsKnownByItsNumberAndARevisionByItsNumberAndRevision() {
        assertEquals("APD.0002", AuditObjectCatalog.objectCode("DOCUMENT", "APD.0002", null, null, "APD.0002 - Baseline Cancel Test 4422d585-327a-48c6-a3e6-d82b4c1a9f00", null));
        assertEquals("SOP.0037 Rev.1.0.0", AuditObjectCatalog.objectCode("REVISION", "SOP.0037", "1.0.0", "SOP.0037 Rev.1.0.0", "1.0.0 - Test", null));
        assertEquals("SOP.0037", AuditObjectCatalog.objectCode("DOCUMENT", "SOP.0037", "1.0.0", null, null, null), "a document has no revision in its code");
    }

    @Test
    void anIdentifierIsNeverShown() {
        // the name is only an identifier: the record has no identity left
        assertNull(AuditObjectCatalog.objectCode("REPORT_SCHEDULE", null, null, "de4124c7-9296-41e9-b641-72aea77bdaf4", "de4124c7-9296-41e9-b641-72aea77bdaf4", "Scheduled report deleted"));
        // an identifier inside a name is cut out; an address keeps the name of its file
        assertEquals("Baseline Consistent SubType", AuditObjectCatalog.objectCode("SETTINGS", null, null, null, "Baseline Consistent SubType d361c4b2-5f49-43e7-a0a0-4144312e8a11", null));
        assertEquals("source.docx", AuditObjectCatalog.objectCode("STORAGE_OBJECT", null, null, null,
                "minio://eqms-gmp-revisions/templates/publishing/templates/a9e6c90b-4c86-4dee-80b6-86470d6e00bf/v1/header/portrait/source.docx?versionId=a972318f-21c3-49a3-b8f5-42406ddec557", null));
    }

    @Test
    void aNameThatOnlyRepeatsTheTypeOrIsGenericIsNotAnIdentity() {
        assertNull(AuditObjectCatalog.objectCode("SYSTEM_CONFIGURATION", null, null, "System Configuration", "System Configuration", null));
        assertNull(AuditObjectCatalog.objectCode("REPORT_PROPERTIES", null, null, "REPORT_PROPERTIES", "REPORT_PROPERTIES", null));
        assertNull(AuditObjectCatalog.objectCode("SESSION", null, null, "Authentication Session", "Authentication Session", "Login successful"));
        assertNull(AuditObjectCatalog.objectCode("PUBLISHED_PDF", null, null, null, "", null));
        assertNull(AuditObjectCatalog.objectCode("NOTIFICATION_INBOX", null, null, "Notification Inbox", "Notification Inbox", null));
    }

    @Test
    void aRealNameOrNumberIsKept() {
        assertEquals("TRN/QA/26-502", AuditObjectCatalog.objectCode("TRAINING_ACTIVITY", null, null, "TRN/QA/26-502", "TRN/QA/26-502", null));
        assertEquals("eqms_topic_doc_status-RUN-000176.csv", AuditObjectCatalog.objectCode("REPORT_ARTIFACT", null, null, null, "eqms_topic_doc_status-RUN-000176.csv", null));
        assertEquals("CC.SOP.0007.003", AuditObjectCatalog.objectCode("ControlledCopyRecord", null, null, "CC.SOP.0007.003", "CC.SOP.0007.003", null));
        assertEquals("Global Default", AuditObjectCatalog.objectCode("CONTROLLED_COPY_EXPIRY_LIMIT", null, null, "Global Default", "Global Default", null));
    }

    @Test
    void whereTheOnlyIdentityIsInTheTextOfTheRecordItIsTakenFromThere() {
        assertEquals("TAS-0063 1.0.0", AuditObjectCatalog.objectCode("TRAINING_ASSESSMENT", null, null, "TRAINING_ASSESSMENT", "TRAINING_ASSESSMENT", "TAS-0063 1.0.0: E2E-TEST Checklist lấy mẫu vô trùng (6 item(s))"));
        assertEquals("APD.0118 1.0.4", AuditObjectCatalog.objectCode("TRAINING_FORM_TEMPLATE", null, null, null, "TRAINING_FORM_TEMPLATE", "APD.0118 1.0.4 (SHA-256 12ae2fab64f6); Tokens agree with the contract"));
        // a notification is told by who it went to, not by its event
        assertEquals("Report Ready > DEV screenshot account (temporary)", AuditObjectCatalog.objectCode("NOTIFICATION", null, null, "report.ready", "report.ready", null == null
                ? "Email notification \"report.ready\" sent to DEV screenshot account (temporary) (evon.shots@example.invalid)" : null));
        assertNull(AuditObjectCatalog.objectCode("TRAINING_ASSESSMENT", null, null, "TRAINING_ASSESSMENT", "TRAINING_ASSESSMENT", "Updated"), "no number in the text: nothing is guessed");
    }
}
