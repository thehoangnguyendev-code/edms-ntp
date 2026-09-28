package com.eqms;

import com.eqms.entity.PublishingTemplate;
import com.eqms.entity.RevisionPublishingMetadata;
import com.eqms.exception.RevisionLifecycleConflictException;
import com.eqms.service.PublishingTemplateService;
import com.eqms.service.PublishingWorkspaceService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotSame;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.when;

/** A published Publishing Template is the reference documents and controlled copies were composed with. */
@ExtendWith(MockitoExtension.class)
class PublishingTemplateIntegrityTest {

    @Mock com.eqms.repository.PublishingTemplateRepository templateRepository;
    @Mock com.eqms.repository.PublishingTemplateComponentRepository componentRepository;
    @Mock com.eqms.repository.PublishingTemplateVersionRepository versionRepository;
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

    private PublishingTemplate template(Instant publishedAt) {
        PublishingTemplate template = new PublishingTemplate();
        template.setId(UUID.randomUUID());
        template.setPublishedAt(publishedAt);
        template.setHeaderPageFrom(2);
        template.setFooterPageFrom(2);
        return template;
    }

    @Test
    void publishedTemplate_cannotBeEdited() {
        PublishingTemplate published = template(Instant.now());
        when(templateRepository.findById(published.getId())).thenReturn(Optional.of(published));

        RevisionLifecycleConflictException ex = assertThrows(RevisionLifecycleConflictException.class,
                () -> service.requireEditable(published.getId()));
        assertEquals("PUBLISHING_TEMPLATE_PUBLISHED_IMMUTABLE", ex.getCode());
    }

    @Test
    void unpublishedTemplate_canBeEdited() {
        PublishingTemplate draft = template(null);
        when(templateRepository.findById(draft.getId())).thenReturn(Optional.of(draft));

        service.requireEditable(draft.getId());
    }

    @Test
    void effectiveTemplate_appliesTheRevisionsRangesToADetachedCopyOnly() {
        PublishingTemplate stored = template(Instant.now());
        RevisionPublishingMetadata metadata = new RevisionPublishingMetadata();
        metadata.setPublishingTemplate(stored);
        metadata.setPageRanges(3, 5, 4, null, null, null);

        PublishingTemplate effective = PublishingWorkspaceService.effectiveTemplate(metadata);

        assertNotSame(stored, effective);
        assertEquals(stored.getId(), effective.getId());
        assertEquals(3, effective.getHeaderPageFrom());
        assertEquals(5, effective.getHeaderPageTo());
        assertEquals(4, effective.getFooterPageFrom());
        // the shared template is untouched
        assertEquals(2, stored.getHeaderPageFrom());
        assertEquals(2, stored.getFooterPageFrom());
    }

    @Test
    void effectiveTemplate_withoutRecordedRanges_usesTheStoredTemplateAsIs() {
        PublishingTemplate stored = template(Instant.now());
        RevisionPublishingMetadata metadata = new RevisionPublishingMetadata();
        metadata.setPublishingTemplate(stored);

        assertSame(stored, PublishingWorkspaceService.effectiveTemplate(metadata));
    }
}
