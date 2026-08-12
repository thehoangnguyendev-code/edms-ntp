package com.eqms.service;

import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.apache.poi.xwpf.usermodel.XWPFParagraph;
import org.apache.poi.xwpf.usermodel.XWPFRun;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.io.OutputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Map;

@Service
public class ElectronicSignaturePdfPreviewService {

    private static final String PREVIEW_FILE_NAME = "electronic-signature-preview.docx";

    private final ElectronicSignatureService electronicSignatureService;
    private final PublishingOpenXmlTemplateRenderService openXmlTemplateRenderService;
    private final MicrosoftGraphOfficeOnlineService microsoftGraphOfficeOnlineService;

    public ElectronicSignaturePdfPreviewService(
            ElectronicSignatureService electronicSignatureService,
            PublishingOpenXmlTemplateRenderService openXmlTemplateRenderService,
            MicrosoftGraphOfficeOnlineService microsoftGraphOfficeOnlineService
    ) {
        this.electronicSignatureService = electronicSignatureService;
        this.openXmlTemplateRenderService = openXmlTemplateRenderService;
        this.microsoftGraphOfficeOnlineService = microsoftGraphOfficeOnlineService;
    }

    public byte[] generatePdfPreview() throws IOException {
        Path sampleDocx = createSampleDocx();
        String previewBlock = electronicSignatureService.renderPreviewSignatureBlock();
        Path rendered = openXmlTemplateRenderService.renderDocxTemplate(
                sampleDocx,
                PREVIEW_FILE_NAME,
                null,
                Map.of("approvedsignature", previewBlock),
                true
        );
        return microsoftGraphOfficeOnlineService.convertSourceFileToPdf(rendered, PREVIEW_FILE_NAME);
    }

    private Path createSampleDocx() throws IOException {
        Path temp = Files.createTempFile("electronic-signature-preview-", ".docx");
        temp.toFile().deleteOnExit();
        try (XWPFDocument document = new XWPFDocument();
             OutputStream output = Files.newOutputStream(temp)) {
            XWPFParagraph title = document.createParagraph();
            XWPFRun titleRun = title.createRun();
            titleRun.setFontFamily("Arial");
            titleRun.setFontSize(12);
            titleRun.setBold(true);
            titleRun.setText("Electronic Signature PDF Preview");

            XWPFParagraph hint = document.createParagraph();
            XWPFRun hintRun = hint.createRun();
            hintRun.setFontFamily("Arial");
            hintRun.setFontSize(9);
            hintRun.setColor("64748B");
            hintRun.setText("This PDF is generated from a DOCX signature placeholder and converted through Microsoft Graph.");

            XWPFParagraph placeholder = document.createParagraph();
            XWPFRun placeholderRun = placeholder.createRun();
            placeholderRun.setFontFamily("Arial");
            placeholderRun.setFontSize(8.5);
            placeholderRun.setText("{{APPROVED_SIGNATURE}}");

            document.write(output);
        }
        return temp;
    }
}
