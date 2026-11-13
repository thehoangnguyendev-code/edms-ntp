package com.eqms.service;

import com.eqms.dto.user.PageResponse;
import com.eqms.entity.UserAccount;
import com.eqms.entity.UserStatus;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * NOTIFICATION-ADMIN-2026-11-12, the notices raised as an e-mail message type are also registry events: the mapping is complete and unambiguous, the values kept
 * with an in-app notification hold no secret, and what a notification is about is found from the values the sender gave.
 */
class LegacyMessageEventsTest {

    @Test
    void everyTypeHasItsOwnEventCodeWhichIsNotOneTheRegistryAlreadyHas() {
        var all = LegacyMessageEvents.all();
        assertThat(all.stream().map(LegacyMessageEvents.Event::messageType)).doesNotHaveDuplicates();
        assertThat(all.stream().map(LegacyMessageEvents.Event::code)).doesNotHaveDuplicates();
        // codes the other lists already use (a clash would make two senders share one policy)
        var taken = new java.util.HashSet<String>();
        AuditNotificationEvents.all().forEach(e -> taken.add(e.code()));
        OperationalNotificationEvents.all().forEach(e -> taken.add(e.code()));
        com.eqms.service.training.TrainingNotificationEvents.all().forEach(e -> taken.add(e.registryCode()));
        taken.addAll(List.of("document.published", "document.approved", "document.review_rejected", "document.approval_rejected", "controlled_copy.recalled", "controlled_copy.distributed", "controlled_copy.expiring_soon"));
        assertThat(all).allSatisfy(e -> {
            assertThat(taken).doesNotContain(e.code());
            assertThat(e.name()).isNotBlank();
            assertThat(NotificationModule.of(e.module())).as(e.module()).isNotNull();
        });
        assertThat(LegacyMessageEvents.forMessageType(" Document-Review ")).get().extracting(LegacyMessageEvents.Event::code).isEqualTo("document.review_request");
        assertThat(LegacyMessageEvents.forMessageType("password-reset")).isEmpty();
        assertThat(LegacyMessageEvents.forMessageType(null)).isEmpty();
    }

    @Test
    void aPasswordATokenOrASecretIsNotKeptWithTheInAppNotification() {
        Map<String, String> values = new HashMap<>();
        values.put("documentNumber", "SOP.0001");
        values.put("previewPassword", "s3cret");
        values.put("resetToken", "abc");
        values.put("clientSecret", "x");
        assertThat(NotificationDispatcher.withoutSecrets(values)).containsOnlyKeys("documentNumber");
    }

    @Test
    void whatANotificationIsAboutIsFoundFromTheValuesTheSenderGave() {
        UUID revision = UUID.randomUUID();
        Map<String, String> document = Map.of("revisionId", revision.toString(), "documentNumber", "SOP.0001", "documentTitle", "Cleaning", "relatedEntityType", "revision");
        var related = NotificationDispatcher.relatedOf(document, "DOCUMENT_CONTROL");
        assertThat(related.type()).isEqualTo("revision");
        assertThat(related.id()).isEqualTo(revision);
        assertThat(related.number()).isEqualTo("SOP.0001");
        assertThat(related.title()).isEqualTo("Cleaning");
        var copy = NotificationDispatcher.relatedOf(Map.of("controlledCopyNumber", "CC-1", "relatedEntityId", "not-a-uuid"), "DOCUMENT_CONTROL");
        assertThat(copy.type()).isEqualTo("controlled-copy");
        assertThat(copy.id()).isNull();
        assertThat(copy.number()).isEqualTo("CC-1");
        assertThat(NotificationDispatcher.relatedOf(Map.of(), "SECURITY").type()).isEqualTo("SECURITY");
    }
}
