package com.eqms;

import com.eqms.dto.publishing.PublishingTemplateRequest;
import com.eqms.entity.PublishingTemplate;
import com.eqms.entity.UserAccount;
import com.eqms.service.PublishingTemplateService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Publishing Templates have no versions and no publish step: a template is created, edited and saved in place, and any number of them may be
 * Active at the same time (the person publishing a document chooses one). Every change goes to the Audit Trail.
 */
@ExtendWith(MockitoExtension.class)
class PublishingTemplateFreeEditingTest {

    @Mock com.eqms.repository.PublishingTemplateRepository templateRepository;
    @Mock com.eqms.repository.PublishingTemplateComponentRepository componentRepository;
    @Mock com.eqms.service.FileStorageService fileStorageService;
    @Mock com.eqms.auth.CurrentUserService currentUserService;
    @Mock com.eqms.service.AuditTrailService auditTrailService;
    @Mock com.eqms.service.PublishingTemplateInspectionService inspectionService;
    @Mock com.eqms.service.PublishingTemplatePreviewService previewService;
    @Mock com.eqms.service.PublishingPlaceholderStyleService placeholderStyleService;
    @Mock com.fasterxml.jackson.databind.ObjectMapper objectMapper;
    @Mock com.eqms.service.ClamAvScanService clamAvScanService;
    @Mock com.eqms.repository.RevisionPublishingMetadataRepository publishingMetadataRepository;
    @Mock com.eqms.service.RevisionUploadFileValidator revisionUploadFileValidator;
    @InjectMocks PublishingTemplateService service;

    @BeforeEach
    void user() {
        UserAccount user = new UserAccount();
        user.setId(UUID.randomUUID());
        user.setFullName("DCO Test 1");
        lenient().when(currentUserService.requireCurrentUser()).thenReturn(user);
        lenient().when(templateRepository.save(any(PublishingTemplate.class))).thenAnswer(call -> call.getArgument(0));
    }

    private PublishingTemplate template(String name, String status, boolean withCover) {
        PublishingTemplate template = new PublishingTemplate();
        template.setId(UUID.randomUUID());
        template.setTemplateName(name);
        template.setStatus(status);
        template.setPublishingMode("COVER_ONLY");
        template.setVersionNumber(1);
        if (withCover) {
            template.setCoverTemplatePath("minio://bucket/cover.docx");
        }
        lenient().when(templateRepository.findById(template.getId())).thenReturn(Optional.of(template));
        return template;
    }

    private PublishingTemplateRequest request(String name, String status) {
        return new PublishingTemplateRequest(name, null, "edited", status, "COVER_ONLY", "PORTRAIT", "PORTRAIT",
                true, true, true, false, false, true, true, "NONE", null, null, null, null, null, null, null, null, null, null, null);
    }

    @Test
    void severalTemplatesCanBeActiveAtTheSameTime() {
        PublishingTemplate first = template("Page Template A", "INACTIVE", true);
        PublishingTemplate second = template("Page Template B", "INACTIVE", true);

        service.toggleStatus(first.getId());
        service.toggleStatus(second.getId());

        assertEquals("ACTIVE", first.getStatus());
        assertEquals("ACTIVE", second.getStatus());
    }

    @Test
    void aTemplateWithoutTheFilesItsModeNeedsCannotBeMadeActive() {
        PublishingTemplate empty = template("Empty", "INACTIVE", false);

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () -> service.toggleStatus(empty.getId()));

        assertTrue(ex.getMessage().contains("cover"));
        assertEquals("INACTIVE", empty.getStatus());
    }

    @Test
    void anActiveTemplateCanBeDeactivatedAndTheChangeIsAudited() {
        PublishingTemplate active = template("Page Template A", "ACTIVE", true);

        service.toggleStatus(active.getId());

        assertEquals("INACTIVE", active.getStatus());
        verify(auditTrailService).logAs(any(UserAccount.class), eq("PUBLISHING_TEMPLATE"), anyString(), eq(active.getId()),
                eq("PUBLISHING_TEMPLATE_DEACTIVATED"), eq("ACTIVE"), eq("INACTIVE"), anyString(), any());
    }

    @Test
    void aTemplateThatWasPublishedBeforeCanBeEditedInPlaceAndTheSaveIsAudited() {
        PublishingTemplate used = template("Page Template A", "ACTIVE", true);
        used.setPublishedAt(Instant.now());

        service.updateTemplate(used.getId(), request("Page Template A", "ACTIVE"));

        assertEquals("edited", used.getDescription());
        verify(auditTrailService).logAs(any(UserAccount.class), eq("PUBLISHING_TEMPLATE"), anyString(), eq(used.getId()),
                eq("PUBLISHING_TEMPLATE_UPDATED"), eq("ACTIVE"), eq("ACTIVE"), anyString(), any());
    }

    @Test
    void aSaveCannotActivateATemplateThatLacksItsFiles() {
        PublishingTemplate empty = template("Empty", "INACTIVE", false);

        assertThrows(IllegalArgumentException.class, () -> service.updateTemplate(empty.getId(), request("Empty", "ACTIVE")));
    }

    @Test
    void aNewTemplateStartsInactiveWhateverStatusIsSent() {
        when(templateRepository.findByTemplateNameIgnoreCase(anyString())).thenReturn(Optional.empty());

        var created = service.createTemplate(request("Brand New", "ACTIVE"));

        assertEquals("INACTIVE", created.status());
    }

    @Test
    void touchMovesTheUpdatedTimeEvenWhenNothingElseChanged() throws Exception {
        PublishingTemplate template = template("Page Template A", "ACTIVE", true);
        java.lang.reflect.Field field = PublishingTemplate.class.getDeclaredField("updatedAt");
        field.setAccessible(true);
        field.set(template, Instant.parse("2020-01-01T00:00:00Z"));

        template.touch();

        assertTrue(template.getUpdatedAt().isAfter(Instant.parse("2025-01-01T00:00:00Z")));
    }
}
