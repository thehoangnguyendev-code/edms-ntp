package com.eqms;

import com.eqms.entity.PublishingTemplate;
import com.eqms.repository.PublishingTemplateComponentRepository;
import com.eqms.repository.PublishingTemplateRepository;
import com.eqms.service.FileStorageService;
import com.eqms.service.OnlyOfficeDocumentEditService;
import com.eqms.service.PublishingOpenXmlTemplateRenderService;
import com.eqms.service.PublishingPlaceholderStyleService;
import com.eqms.service.PublishingTemplatePreviewService;
import com.eqms.service.RevisionService;
import com.eqms.service.StoragePathBuilder;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PublishingTemplatePreviewLayoutTest {

    @Mock PublishingTemplateRepository templateRepository;
    @Mock PublishingTemplateComponentRepository componentRepository;
    @Mock PublishingPlaceholderStyleService placeholderStyleService;
    @Mock FileStorageService fileStorageService;
    @Mock OnlyOfficeDocumentEditService onlyOfficeDocumentEditService;
    @Mock PublishingOpenXmlTemplateRenderService openXmlTemplateRenderService;
    @Mock RevisionService revisionService;
    @Mock StoragePathBuilder storagePathBuilder;

    private PublishingTemplatePreviewService service;

    @BeforeEach
    void setUp() {
        service = new PublishingTemplatePreviewService(
                templateRepository,
                componentRepository,
                placeholderStyleService,
                fileStorageService,
                onlyOfficeDocumentEditService,
                openXmlTemplateRenderService,
                revisionService,
                storagePathBuilder
        );
    }

    @Test
    void landscapePreviewDoesNotFallBackToLegacyPortraitFile() {
        UUID templateId = UUID.randomUUID();
        PublishingTemplate template = new PublishingTemplate();
        template.setId(templateId);
        template.setCoverTemplatePath("publishing/template/legacy-cover.docx");
        template.setCoverFileName("legacy-cover.docx");

        when(templateRepository.findById(templateId)).thenReturn(Optional.of(template));
        when(componentRepository.findByTemplate_IdAndComponentTypeIgnoreCaseAndLayoutIgnoreCase(
                templateId, "cover", "landscape"
        )).thenReturn(Optional.empty());

        IllegalStateException error = assertThrows(
                IllegalStateException.class,
                () -> service.getComponentPreviewPdf(templateId, "cover", "landscape", null)
        );

        assertEquals("Component file has not been uploaded yet", error.getMessage());
    }
}
