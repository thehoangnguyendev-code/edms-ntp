package com.eqms;

import com.eqms.service.ControlledCopyMarkingPreviewService;
import com.eqms.service.ControlledCopyPdfMarkingService;
import com.eqms.service.ControlledCopyPolicyService;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

/**
 * The PDF markings are previewed on ONE sample paper page, the same for every document (owner decision 2026-10-07): no document and
 * no Publishing Template has to be chosen.
 */
class ControlledCopyMarkingPreviewBaseTest {

    private final ControlledCopyMarkingPreviewService service =
            new ControlledCopyMarkingPreviewService(mock(ControlledCopyPolicyService.class), mock(ControlledCopyPdfMarkingService.class));

    @Test
    void the_sample_paper_is_one_a4_page_with_something_on_it() throws Exception {
        var base = service.samplePaper();

        try (PDDocument document = Loader.loadPDF(base.pdf())) {
            assertThat(document.getNumberOfPages()).isEqualTo(1);
            assertThat(document.getPage(0).getMediaBox().getWidth()).isEqualTo(PDRectangle.A4.getWidth());
            assertThat(document.getPage(0).getMediaBox().getHeight()).isEqualTo(PDRectangle.A4.getHeight());
        }
        assertThat(base.note()).isNull();
    }

    @Test
    void it_is_built_once_and_reused() {
        assertThat(service.samplePaper()).isSameAs(service.samplePaper());
    }
}
