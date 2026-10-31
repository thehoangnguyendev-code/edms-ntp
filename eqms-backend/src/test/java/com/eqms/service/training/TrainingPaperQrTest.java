package com.eqms.service.training;

import com.eqms.service.ControlledCopyScanCodeService;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.junit.jupiter.api.Test;

import java.io.ByteArrayOutputStream;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/** The QR code of a numbered paper copy: written on every page, read back from the scan of the pages in any order. */
class TrainingPaperQrTest {
    private static byte[] blank(int pages) throws Exception {
        try (PDDocument d = new PDDocument(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            for (int i = 0; i < pages; i++) d.addPage(new PDPage(PDRectangle.A4));
            d.save(out);
            return out.toByteArray();
        }
    }

    @Test
    void everyPageSaysItsCopyItsPersonAndItsPlace() throws Exception {
        String person = TrainingPaperQr.personTag(UUID.fromString("0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d"));
        byte[] stamped = TrainingPaperQr.stamp(blank(3), "TRN/QA/26-911/S1/E3", person);
        List<ControlledCopyScanCodeService.PageScan> scans = ControlledCopyScanCodeService.decodePages(stamped);
        assertThat(scans).hasSize(3);
        for (int i = 0; i < 3; i++) {
            var code = TrainingPaperQr.parse(scans.get(i).rawValue()).orElseThrow();
            assertThat(code.packCode()).isEqualTo("TRN/QA/26-911/S1/E3");
            assertThat(code.person()).isEqualTo("0a1b2c3d4e5f");
            assertThat(code.page()).isEqualTo(i + 1);
            assertThat(code.pages()).isEqualTo(3);
        }
    }

    @Test
    void pagesScannedOutOfOrderCanBePutBackByTheirCodes() throws Exception {
        byte[] first = TrainingPaperQr.stamp(blank(2), "TRN/QA/26-1/S1/E1", "aaaaaaaaaaaa");
        byte[] second = TrainingPaperQr.stamp(blank(2), "TRN/QA/26-1/S1/E1", "bbbbbbbbbbbb");
        byte[] heap;
        try (PDDocument a = Loader.loadPDF(first); PDDocument b = Loader.loadPDF(second); PDDocument mixed = new PDDocument(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            mixed.importPage(b.getPage(1));
            mixed.importPage(a.getPage(0));
            mixed.importPage(b.getPage(0));
            mixed.importPage(a.getPage(1));
            mixed.save(out);
            heap = out.toByteArray();
        }
        var codes = ControlledCopyScanCodeService.decodePages(heap).stream().map(s -> TrainingPaperQr.parse(s.rawValue()).orElseThrow()).toList();
        assertThat(codes).extracting(c -> c.person() + ":" + c.page()).containsExactly("bbbbbbbbbbbb:2", "aaaaaaaaaaaa:1", "bbbbbbbbbbbb:1", "aaaaaaaaaaaa:2");
    }

    @Test
    void aCopyForTheWholeSessionHasNoPersonAndForeignOrBrokenCodesAreRefused() {
        var whole = TrainingPaperQr.parse(TrainingPaperQr.payload("TRN/QA/26-1/S1/P1", null, 1, 2)).orElseThrow();
        assertThat(whole.person()).isNull();
        assertThat(TrainingPaperQr.parse("EQMSCC2:ABC")).isEmpty();
        assertThat(TrainingPaperQr.parse("EQMSTR1|X||3/2")).isEmpty();
        assertThat(TrainingPaperQr.parse("EQMSTR1||a|1/2")).isEmpty();
        assertThat(TrainingPaperQr.parse(null)).isEmpty();
    }
}
