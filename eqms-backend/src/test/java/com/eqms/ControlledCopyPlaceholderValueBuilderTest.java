package com.eqms;

import com.eqms.entity.ControlledCopyRecord;
import com.eqms.entity.UserAccount;
import com.eqms.service.ControlledCopyPlaceholderValueBuilder;
import com.eqms.service.PublishingPlaceholderStyleConfig;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ControlledCopyPlaceholderValueBuilderTest {

    private final ControlledCopyPlaceholderValueBuilder builder = new ControlledCopyPlaceholderValueBuilder(new ObjectMapper());

    private static UserAccount user(String name, String email, String position, String department) {
        UserAccount user = new UserAccount();
        user.setId(UUID.randomUUID());
        user.setFullName(name);
        user.setEmail(email);
        user.setPosition(position);
        user.setDepartment(department);
        return user;
    }

    @Test
    void internalRecipient_isCapturedFromTheUsersProfile() {
        ControlledCopyRecord copy = new ControlledCopyRecord();
        copy.setRecipientUser(user("Tran Van A", "a@example.com", "QC Analyst", "Quality Control"));

        JsonNode snapshot = builder.captureRecipientSnapshotIfAbsent(copy);

        assertEquals("INTERNAL", snapshot.path("source").asText());
        assertEquals("Tran Van A", snapshot.path("name").asText());
        assertEquals("a@example.com", snapshot.path("email").asText());
        assertEquals("QC Analyst", snapshot.path("jobTitle").asText());
        assertEquals("Quality Control", snapshot.path("department").asText());
    }

    @Test
    void previewSnapshot_doesNotStoreAnything() {
        ControlledCopyRecord copy = new ControlledCopyRecord();
        copy.setRecipientUser(user("Tran Van A", "a@example.com", "QC Analyst", "Quality Control"));

        JsonNode preview = builder.recipientSnapshotForPreview(copy);

        assertEquals("Tran Van A", preview.path("name").asText());
        assertEquals(null, copy.getRecipientSnapshot());
    }

    @Test
    void snapshot_isNotRecapturedAfterTheProfileChanges() {
        UserAccount recipient = user("Tran Van A", "a@example.com", "QC Analyst", "Quality Control");
        ControlledCopyRecord copy = new ControlledCopyRecord();
        copy.setRecipientUser(recipient);
        JsonNode first = builder.captureRecipientSnapshotIfAbsent(copy);

        recipient.setPosition("QC Manager");
        recipient.setDepartment("Quality Assurance");
        JsonNode second = builder.captureRecipientSnapshotIfAbsent(copy);

        assertSame(first, second);
        assertEquals("QC Analyst", second.path("jobTitle").asText());
        assertEquals("Quality Control", second.path("department").asText());
    }

    @Test
    void externalRecipient_isIdentifiedByEmailOnly() {
        ControlledCopyRecord copy = new ControlledCopyRecord();
        copy.setExternalRecipients("auditor@partner.com");

        JsonNode snapshot = builder.captureRecipientSnapshotIfAbsent(copy);
        Map<String, String> values = builder.build(copy, snapshot, "003");

        assertEquals("EXTERNAL", snapshot.path("source").asText());
        assertEquals("auditor@partner.com", values.get("recipientName"));
        assertEquals("auditor@partner.com", values.get("recipientEmail"));
        assertEquals("auditor@partner.com", values.get("distributionList"));
        assertEquals("", values.get("recipientJobTitle"));
        assertEquals("003", values.get("copyNo"));
        assertEquals(ControlledCopyPlaceholderValueBuilder.CONTEXT_CONTROLLED_COPY, values.get(ControlledCopyPlaceholderValueBuilder.CONTEXT_KEY));
    }

    @Test
    void systemKeys_areReservedRegardlessOfCase() {
        assertTrue(ControlledCopyPlaceholderValueBuilder.isReserved("RecipientName"));
        assertTrue(ControlledCopyPlaceholderValueBuilder.isReserved("copyNo"));
        assertTrue(ControlledCopyPlaceholderValueBuilder.isReserved("distributionList"));
        assertFalse(ControlledCopyPlaceholderValueBuilder.isReserved("storageRoom"));
    }

    @Test
    void placeholderVisibility_followsTheContext() {
        PublishingPlaceholderStyleConfig publishOnly = new PublishingPlaceholderStyleConfig(List.of(), null, null, null, null, null, null, null, null, null, true, null, "PUBLISH");
        PublishingPlaceholderStyleConfig copyOnly = new PublishingPlaceholderStyleConfig(List.of(), null, null, null, null, null, null, null, null, null, true, null, "CONTROLLED_COPY");
        PublishingPlaceholderStyleConfig both = new PublishingPlaceholderStyleConfig(List.of(), null, null, null, null, null, null, null, null, null, true, null, null);

        assertTrue(publishOnly.visibleIn(false));
        assertFalse(publishOnly.visibleIn(true));
        assertFalse(copyOnly.visibleIn(false));
        assertTrue(copyOnly.visibleIn(true));
        assertTrue(both.visibleIn(false));
        assertTrue(both.visibleIn(true));
    }
}
