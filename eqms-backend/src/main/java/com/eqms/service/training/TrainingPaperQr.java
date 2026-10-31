package com.eqms.service.training;

import com.eqms.service.ControlledCopyScanCodeService;
import com.google.zxing.common.BitMatrix;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.common.PDRectangle;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.Optional;
import java.util.UUID;

/**
 * The QR code on every page of a numbered paper copy (owner decision 2026-10-30), so that a heap of scanned pages in any order can be sorted back by the system: it names the copy (the pack code),
 * the trainee of an individual copy (the first 12 characters of the participant id) and the page ("2/3"). The code is small (about 14 mm), in the top right margin, on a white square, so it covers no text.
 * It only says where a page belongs: the server checks the copy and the person against the activity, and a second person still checks every scan against the paper.
 */
public final class TrainingPaperQr {
    public static final String PREFIX = "EQMSTR1|";
    private static final float SIZE_PT = 14f / 25.4f * 72f;
    private static final float QUIET_PT = 3f;
    private static final float MARGIN_PT = 6f;

    /** What a page says: the copy it belongs to, the person (null on a copy for the whole session), and its place in that copy. */
    public record Code(String packCode, String person, int page, int pages) {
    }

    private TrainingPaperQr() {
    }

    public static String personTag(UUID participantId) {
        return participantId.toString().replace("-", "").substring(0, 12);
    }

    public static String payload(String packCode, String person, int page, int pages) {
        return PREFIX + packCode + "|" + (person == null ? "" : person) + "|" + page + "/" + pages;
    }

    public static Optional<Code> parse(String raw) {
        if (raw == null || !raw.startsWith(PREFIX)) return Optional.empty();
        String[] parts = raw.substring(PREFIX.length()).split("\\|", -1);
        if (parts.length != 3 || parts[0].isBlank()) return Optional.empty();
        String[] place = parts[2].split("/");
        if (place.length != 2) return Optional.empty();
        try {
            int page = Integer.parseInt(place[0]);
            int pages = Integer.parseInt(place[1]);
            if (page < 1 || pages < page) return Optional.empty();
            return Optional.of(new Code(parts[0], parts[1].isBlank() ? null : parts[1], page, pages));
        } catch (NumberFormatException e) {
            return Optional.empty();
        }
    }

    /** The PDF with the code on every page. `person` is null for a copy that is for the whole session. */
    public static byte[] stamp(byte[] pdf, String packCode, String person) {
        try (PDDocument document = Loader.loadPDF(pdf); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            int pages = document.getNumberOfPages();
            for (int i = 0; i < pages; i++) {
                PDPage page = document.getPage(i);
                PDRectangle box = page.getCropBox();
                BitMatrix matrix = ControlledCopyScanCodeService.encode(payload(packCode, person, i + 1, pages));
                float module = SIZE_PT / matrix.getWidth();
                float side = module * matrix.getWidth();
                float left = box.getUpperRightX() - MARGIN_PT - QUIET_PT - side;
                float top = box.getUpperRightY() - MARGIN_PT - QUIET_PT;
                try (PDPageContentStream s = new PDPageContentStream(document, page, PDPageContentStream.AppendMode.APPEND, true, true)) {
                    s.setNonStrokingColor(1f, 1f, 1f);
                    s.addRect(left - QUIET_PT, top - side - QUIET_PT, side + 2 * QUIET_PT, side + 2 * QUIET_PT);
                    s.fill();
                    s.setNonStrokingColor(0f, 0f, 0f);
                    for (int y = 0; y < matrix.getHeight(); y++) {
                        int x = 0;
                        while (x < matrix.getWidth()) {
                            if (!matrix.get(x, y)) {
                                x++;
                                continue;
                            }
                            int run = x;
                            while (run < matrix.getWidth() && matrix.get(run, y)) run++;
                            s.addRect(left + x * module, top - (y + 1) * module, (run - x) * module, module);
                            x = run;
                        }
                    }
                    s.fill();
                }
            }
            document.save(out);
            return out.toByteArray();
        } catch (IOException e) {
            throw new IllegalStateException("TRAINING_PRINT_FAILED", e);
        }
    }
}
