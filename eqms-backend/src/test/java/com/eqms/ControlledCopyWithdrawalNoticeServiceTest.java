package com.eqms;

import com.eqms.entity.ControlledCopyRecord;
import com.eqms.entity.UserAccount;
import com.eqms.service.ControlledCopyWithdrawalNoticeService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.junit.jupiter.api.Test;

import java.io.IOException;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** The notice handed to a recipient when a controlled copy is withdrawn. */
class ControlledCopyWithdrawalNoticeServiceTest {

    private final ControlledCopyWithdrawalNoticeService service = new ControlledCopyWithdrawalNoticeService();
    private final ObjectMapper mapper = new ObjectMapper();

    private ControlledCopyRecord copy(String reason) {
        ControlledCopyRecord copy = new ControlledCopyRecord();
        copy.setControlledCopyNumber("CC.SOP.0001.003");
        copy.setDocumentNumber("SOP.0001");
        copy.setDocumentTitle("Cleaning of Line 3");
        copy.setRevisionNumber("2.0.0");
        copy.setCopyNumber(3);
        copy.setTotalCopies(20);
        copy.setLocation("QC Lab");
        copy.setObsoleteReason(reason);
        copy.setRecallReason("Superseded by an urgent change");
        return copy;
    }

    private String text(byte[] pdf) throws IOException {
        try (PDDocument document = Loader.loadPDF(pdf)) {
            assertEquals(1, document.getNumberOfPages());
            return new PDFTextStripper().getText(document);
        }
    }

    private UserAccount user(String name) {
        UserAccount user = new UserAccount();
        user.setFullName(name);
        return user;
    }

    @Test
    void recalledCopy_getsARecallNoticeWithReasonRecipientAndReturnBlock() throws IOException {
        var recipient = mapper.createObjectNode().put("name", "Nguyễn Thị Hồng").put("email", "hong@example.com")
                .put("jobTitle", "QC Analyst").put("department", "Quality Control");

        String text = text(service.build(copy("RECALLED"), recipient, user("Trần Văn Ánh")));

        assertTrue(text.contains("CONTROLLED COPY RECALL NOTICE"));
        assertTrue(text.contains("CC.SOP.0001.003"));
        assertTrue(text.contains("SOP.0001 - Cleaning of Line 3"));
        assertTrue(text.contains("3 of 20"));
        assertTrue(text.contains("Nguyễn Thị Hồng"));
        assertTrue(text.contains("hong@example.com"));
        assertTrue(text.contains("QC Analyst / Quality Control"));
        assertTrue(text.contains("Recalled by Document Control"));
        assertTrue(text.contains("Superseded by an urgent change"));
        assertTrue(text.contains("Returned by (recipient)"));
        assertTrue(text.contains("Received by (Document Control)"));
        assertTrue(text.contains("Trần Văn Ánh"));
    }

    @Test
    void otherWithdrawals_useTheWithdrawalWording() throws IOException {
        var recipient = mapper.createObjectNode().put("name", "auditor@partner.com").put("email", "auditor@partner.com");

        String expired = text(service.build(copy("EXPIRED"), recipient, user("A")));
        String replaced = text(service.build(copy("NEW_REVISION_PUBLISHED"), recipient, user("A")));

        assertTrue(expired.contains("CONTROLLED COPY WITHDRAWAL NOTICE"));
        assertFalse(expired.contains("RECALL NOTICE"));
        assertTrue(expired.contains("Expiry date passed"));
        assertTrue(replaced.contains("Replaced by a newer revision"));
        // an external recipient has no job title / department line
        assertFalse(expired.contains("Job title / department"));
    }

    @Test
    void unusualCharacters_neverBreakTheNotice() throws IOException {
        var recipient = mapper.createObjectNode().put("name", "山田 太郎 😀");

        assertTrue(text(service.build(copy("RECALLED"), recipient, user("山田"))).contains("CONTROLLED COPY RECALL NOTICE"));
    }

    @Test
    void reasonLabels_coverEveryWithdrawalReason() {
        for (String reason : new String[] {"RECALLED", "EXPIRED", "NEW_REVISION_PUBLISHED", "REVISION_OBSOLETED",
                "DOCUMENT_OBSOLETED", "LOST", "DAMAGED", "DESTROYED"}) {
            assertFalse("Withdrawn".equals(ControlledCopyWithdrawalNoticeService.reasonLabel(reason)), reason);
        }
    }
}
