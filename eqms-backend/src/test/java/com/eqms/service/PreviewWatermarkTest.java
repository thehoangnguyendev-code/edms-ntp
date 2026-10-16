package com.eqms.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.junit.jupiter.api.Test;

import java.io.ByteArrayOutputStream;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/** What the preview watermark prints: the main text, the viewer's code and name on one line, the strength, colour and grid. */
class PreviewWatermarkTest {

    private static final ObjectMapper JSON = new ObjectMapper();
    private static final PreviewWatermark.Context CONTEXT = new PreviewWatermark.Context(
            "Nguyen The Hoang", "NTP.0005", Instant.parse("2026-10-16T03:00:00Z"));

    private static JsonNode policy(String json) throws Exception {
        return JSON.readTree(json);
    }

    @Test
    void theMainTextComesFirstAndNothingElseIsPrintedByDefault() throws Exception {
        assertThat(PreviewWatermark.linesFor(policy("{}"), CONTEXT)).containsExactly("FOR PREVIEW ONLY");
    }

    @Test
    void theEmployeeCodeAndNameShareOneLine() throws Exception {
        JsonNode both = policy("{\"watermarkShowEmployeeCode\":true,\"watermarkShowViewerName\":true}");
        assertThat(PreviewWatermark.linesFor(both, CONTEXT)).containsExactly("FOR PREVIEW ONLY", "NTP.0005 - Nguyen The Hoang");
    }

    @Test
    void whicheverOfTheTwoIsSwitchedOnIsPrintedAloneAndTheTimeFollows() throws Exception {
        assertThat(PreviewWatermark.linesFor(policy("{\"watermarkShowViewerName\":true}"), CONTEXT))
                .containsExactly("FOR PREVIEW ONLY", "Nguyen The Hoang");
        assertThat(PreviewWatermark.linesFor(policy("{\"watermarkShowEmployeeCode\":true,\"watermarkShowOpenedAt\":true}"), CONTEXT))
                .containsExactly("FOR PREVIEW ONLY", "NTP.0005",
                        DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm:ss").withZone(ZoneId.systemDefault()).format(CONTEXT.openedAt()));
    }

    @Test
    void aBlankValueIsLeftOffRatherThanPrintedAsAGap() throws Exception {
        PreviewWatermark.Context noCode = new PreviewWatermark.Context("  ", null, null);
        assertThat(PreviewWatermark.linesFor(policy("{\"watermarkShowViewerName\":true,\"watermarkShowEmployeeCode\":true,\"watermarkShowOpenedAt\":true}"), noCode))
                .containsExactly("FOR PREVIEW ONLY");
    }

    @Test
    void theMainTextIsCappedAtTheConfiguredLength() throws Exception {
        assertThat(PreviewWatermark.linesFor(policy("{\"watermarkText\":\"" + "X".repeat(200) + "\"}"), CONTEXT).get(0)).hasSize(120);
    }

    @Test
    void strengthSetsTheOpacityAndUnknownValuesFallBackToStandard() {
        assertThat(PreviewWatermark.alphaFor("light")).isEqualTo(0.10f);
        assertThat(PreviewWatermark.alphaFor("standard")).isEqualTo(0.18f);
        assertThat(PreviewWatermark.alphaFor("strong")).isEqualTo(0.30f);
        assertThat(PreviewWatermark.alphaFor(null)).isEqualTo(0.18f);
        assertThat(PreviewWatermark.alphaFor("loud")).isEqualTo(0.18f);
    }

    @Test
    void theColourIsReadAsHexAndAMalformedValueFallsBackToTheDefault() {
        float[] red = PreviewWatermark.rgbFor("#FF0000");
        assertThat(red[0]).isEqualTo(1f);
        assertThat(red[1]).isEqualTo(0f);
        assertThat(red[2]).isEqualTo(0f);
        float[] fallback = PreviewWatermark.rgbFor("not a colour");
        float[] standard = PreviewWatermark.rgbFor(PreviewWatermark.DEFAULT_COLOR);
        assertThat(fallback).containsExactly(standard);
    }

    @Test
    void theRepeatedGridAndTheSingleWatermarkBothProduceAValidPdfOfTheSamePageCount() throws Exception {
        byte[] blank = blankPdf(2);
        for (String json : List.of("{}", "{\"watermarkTiled\":true,\"watermarkColor\":\"#CC0000\",\"watermarkStrength\":\"strong\"}")) {
            byte[] marked = PreviewWatermark.apply(blank, policy(json), CONTEXT);
            try (PDDocument pdf = Loader.loadPDF(marked)) {
                assertThat(pdf.getNumberOfPages()).isEqualTo(2);
            }
        }
    }

    private static byte[] blankPdf(int pages) throws Exception {
        try (PDDocument pdf = new PDDocument(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            for (int i = 0; i < pages; i++) {
                pdf.addPage(new PDPage());
            }
            pdf.save(out);
            return out.toByteArray();
        }
    }
}
