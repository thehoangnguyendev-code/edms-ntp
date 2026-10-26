package com.eqms.service.training;

import com.eqms.entity.UserAccount;
import com.eqms.service.PreviewWatermark;
import com.eqms.service.SystemConfigurationService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.MissingNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.Instant;

/**
 * The watermark of the preview settings (Settings, Configuration, Preview File) on a PDF that the system makes for a person to look at and sends as it is: the same {@link PreviewWatermark} and the
 * same options as the preview of a document. Only a PDF made to be looked at gets it; a file made to be printed or handed out (the test copies, the paper packs, a file that is downloaded) never does.
 * When the watermark is switched off in the settings, or it cannot be drawn, the PDF goes out as it is.
 */
@Service
public class TrainingPreviewMarking {
    private static final Logger log = LoggerFactory.getLogger(TrainingPreviewMarking.class);

    private final SystemConfigurationService configuration;

    public TrainingPreviewMarking(SystemConfigurationService configuration) {
        this.configuration = configuration;
    }

    /** The PDF with the watermark of the settings for this viewer, or as it is. */
    public byte[] mark(byte[] pdf, UserAccount viewer) {
        if (pdf == null || !configuration.isDocumentWatermarkEnabled()) return pdf;
        try {
            JsonNode documents = configuration.requireConfiguration().getDocumentsConfig();
            JsonNode policy = documents == null ? MissingNode.getInstance() : documents.path("pdfPreview");
            String name = viewer.getFullName() == null || viewer.getFullName().isBlank() ? viewer.getUsername() : viewer.getFullName();
            return PreviewWatermark.apply(pdf, policy, new PreviewWatermark.Context(name, viewer.getEmployeeCode(), Instant.now()));
        } catch (Exception e) {
            log.warn("The watermark could not be drawn on a training preview: {}", e.getMessage());
            return pdf;
        }
    }
}
