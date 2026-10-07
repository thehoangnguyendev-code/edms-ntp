package com.eqms.service;

import com.google.zxing.BarcodeFormat;
import com.google.zxing.BinaryBitmap;
import com.google.zxing.DecodeHintType;
import com.google.zxing.EncodeHintType;
import com.google.zxing.LuminanceSource;
import com.google.zxing.NotFoundException;
import com.google.zxing.RGBLuminanceSource;
import com.google.zxing.Result;
import com.google.zxing.common.BitMatrix;
import com.google.zxing.common.GlobalHistogramBinarizer;
import com.google.zxing.common.HybridBinarizer;
import com.google.zxing.multi.qrcode.QRCodeMultiReader;
import com.google.zxing.qrcode.QRCodeWriter;
import com.google.zxing.qrcode.decoder.ErrorCorrectionLevel;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.rendering.ImageType;
import org.apache.pdfbox.rendering.PDFRenderer;


import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.security.SecureRandom;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

/**
 * Creates and reads the QR code printed on paper Controlled Copies.
 *
 * <p>The code carries only an opaque, random, per-copy token ({@code EQMSCC1:<token>}). It is a lookup key and nothing
 * else: no document data, no status, no recipient. Everything the system acts on is read from the server when the DCO
 * confirms a recall, so a stale, copied or tampered code cannot carry false facts. A photocopy of a paper copy carries the
 * same code, so the code identifies WHICH copy a scan belongs to; it does not prove the paper is the original. That
 * remains the DCO's physical check, attested by the signature on the recall batch.
 */

public final class ControlledCopyScanCodeService {

    /** Prefix of a code that names only the copy (printed before page numbers were added). */
    public static final String PAYLOAD_PREFIX = "EQMSCC1:";
    /** Prefix of a per-page code: {@code EQMSCC2:<token>:<page>:<pages>}, so loose pages can be put back in order. */
    public static final String PAGE_PAYLOAD_PREFIX = "EQMSCC2:";
    /** Most pages read from one scan, so a hostile file cannot keep the server rendering. */
    public static final int MAX_SCAN_PAGES = 200;
    private static final String ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
    /** 26 characters of a 32-symbol alphabet = 130 bits of randomness. */
    static final int TOKEN_LENGTH = 26;
    /** Rendering resolutions tried in order when reading a scanned PDF page. */
    private static final int[] DECODE_DPI = {200, 300};
    /** Upper bound on the pixels rendered for one page, so a hostile huge page size cannot exhaust memory. */
    private static final long MAX_RENDER_PIXELS = 30_000_000L;

    public static final String STATUS_DECODED = "DECODED";
    public static final String STATUS_NOT_FOUND = "NOT_FOUND";
    public static final String STATUS_FOREIGN = "FOREIGN";
    public static final String STATUS_MULTIPLE = "MULTIPLE";
    public static final String STATUS_UNREADABLE_FILE = "UNREADABLE_FILE";

    /** What was found on a scan. {@code token} is set only when {@code status} is DECODED. */
    public record DecodeResult(String status, String rawValue, String token) {
        static DecodeResult of(String status) {
            return new DecodeResult(status, null, null);
        }
    }

    private static final SecureRandom RANDOM = new SecureRandom();

    private ControlledCopyScanCodeService() {
    }

    /** A fresh unguessable token. Uniqueness is enforced by the database; callers retry on the (negligible) collision. */
    public static String newToken() {
        StringBuilder token = new StringBuilder(TOKEN_LENGTH);
        for (int i = 0; i < TOKEN_LENGTH; i++) {
            token.append(ALPHABET.charAt(RANDOM.nextInt(ALPHABET.length())));
        }
        return token.toString();
    }

    public static String payload(String token) {
        return PAYLOAD_PREFIX + token;
    }

    /** The payload of one page of a copy: the copy token plus which page this is and how many the copy has. */
    public static String pagePayload(String token, int page, int pages) {
        return PAGE_PAYLOAD_PREFIX + token + ":" + page + ":" + pages;
    }

    /** What a decoded code says: the copy and, for per-page codes, the page and the page count (both null for the old per-copy code). */
    public record PageCode(String token, Integer page, Integer pages) {
    }

    public static Optional<PageCode> parsePageCode(String rawPayload) {
        if (rawPayload == null) {
            return Optional.empty();
        }
        String trimmed = rawPayload.trim();
        if (trimmed.startsWith(PAGE_PAYLOAD_PREFIX)) {
            String[] parts = trimmed.substring(PAGE_PAYLOAD_PREFIX.length()).split(":", -1);
            if (parts.length != 3 || !validToken(parts[0])) {
                return Optional.empty();
            }
            try {
                int page = Integer.parseInt(parts[1]);
                int pages = Integer.parseInt(parts[2]);
                return page >= 1 && pages >= page && pages <= 100_000 ? Optional.of(new PageCode(parts[0], page, pages)) : Optional.empty();
            } catch (NumberFormatException ex) {
                return Optional.empty();
            }
        }
        return tokenFrom(trimmed).map(token -> new PageCode(token, null, null));
    }

    private static boolean validToken(String token) {
        if (token == null || token.length() != TOKEN_LENGTH) {
            return false;
        }
        for (int i = 0; i < token.length(); i++) {
            if (ALPHABET.indexOf(token.charAt(i)) < 0) {
                return false;
            }
        }
        return true;
    }

    /** The token inside a decoded payload, or empty when the text is not an EQMS Controlled Copy code. */
    public static Optional<String> tokenFrom(String rawPayload) {
        if (rawPayload == null) {
            return Optional.empty();
        }
        String trimmed = rawPayload.trim();
        if (!trimmed.startsWith(PAYLOAD_PREFIX) || trimmed.length() != PAYLOAD_PREFIX.length() + TOKEN_LENGTH) {
            return Optional.empty();
        }
        String token = trimmed.substring(PAYLOAD_PREFIX.length());
        for (int i = 0; i < token.length(); i++) {
            if (ALPHABET.indexOf(token.charAt(i)) < 0) {
                return Optional.empty();
            }
        }
        return Optional.of(token);
    }

    /** The QR symbol for a payload with no quiet zone (the caller draws its own white border). */
    public static BitMatrix encode(String payload) {
        try {
            Map<EncodeHintType, Object> hints = new EnumMap<>(EncodeHintType.class);
            // Q survives a photocopy/scan cycle far better than the default M, at a small size cost.
            hints.put(EncodeHintType.ERROR_CORRECTION, ErrorCorrectionLevel.Q);
            hints.put(EncodeHintType.MARGIN, 0);
            return new QRCodeWriter().encode(payload, BarcodeFormat.QR_CODE, 0, 0, hints);
        } catch (com.google.zxing.WriterException ex) {
            throw new IllegalStateException("Unable to generate the Controlled Copy QR code", ex);
        }
    }

    public static boolean isPdf(byte[] content) {
        return content != null && content.length > 5
                && content[0] == '%' && content[1] == 'P' && content[2] == 'D' && content[3] == 'F' && content[4] == '-';
    }

    public static boolean isPng(byte[] content) {
        return content != null && content.length > 8 && (content[0] & 0xFF) == 0x89
                && content[1] == 'P' && content[2] == 'N' && content[3] == 'G';
    }

    public static boolean isJpeg(byte[] content) {
        return content != null && content.length > 3 && (content[0] & 0xFF) == 0xFF
                && (content[1] & 0xFF) == 0xD8 && (content[2] & 0xFF) == 0xFF;
    }


    /**
     * Why these bytes cannot be filed as a scan, or null when they can: the scan must open as a PDF that is not
     * password-protected and has at least one page, because the Obsoleted stamp and watermark are drawn on it when it is
     * viewed or downloaded.
     */
    public static String pdfProblem(byte[] pdf) {
        try (PDDocument document = Loader.loadPDF(pdf)) {
            if (document.isEncrypted()) {
                return "The PDF is password-protected. Scan again without a password.";
            }
            if (document.getNumberOfPages() < 1) {
                return "The PDF has no pages.";
            }
            return null;
        } catch (IOException | RuntimeException ex) {
            return "The file is not a valid PDF. Scan it again.";
        }
    }
    /** MIME type from the file's own bytes (never from the client's claim), or null when it is not PDF/PNG/JPEG. */
    public static String sniffContentType(byte[] content) {
        if (isPdf(content)) {
            return "application/pdf";
        }
        if (isPng(content)) {
            return "image/png";
        }
        if (isJpeg(content)) {
            return "image/jpeg";
        }
        return null;
    }

    /**
     * Reads the QR code on a scanned PDF (first page) or PNG/JPEG image. The file's own bytes decide how it is
     * opened. Never throws for a bad file: that is reported as {@code UNREADABLE_FILE}.
     */
    public static DecodeResult decode(byte[] content) {
        try {
            List<String> found;
            if (isPdf(content)) {
                found = decodePdfFirstPage(content);
            } else if (isPng(content) || isJpeg(content)) {
                BufferedImage image = ImageIO.read(new ByteArrayInputStream(content));
                if (image == null) {
                    return DecodeResult.of(STATUS_UNREADABLE_FILE);
                }
                found = readAll(image);
            } else {
                return DecodeResult.of(STATUS_UNREADABLE_FILE);
            }
            return classify(found);
        } catch (IOException | RuntimeException ex) {
            return DecodeResult.of(STATUS_UNREADABLE_FILE);
        }
    }

    /** What was read on one page of a scan. {@code index} is the zero-based position in the scanned file. */
    public record PageScan(int index, String status, String rawValue, PageCode code) {
    }

    /** Reads the code on EVERY page of a scanned PDF. A page never throws: a page that cannot be read is NOT_FOUND. */
    public static List<PageScan> decodePages(byte[] content) throws IOException {
        List<PageScan> scans = new ArrayList<>();
        try (PDDocument document = Loader.loadPDF(content)) {
            int count = Math.min(document.getNumberOfPages(), MAX_SCAN_PAGES);
            PDFRenderer renderer = new PDFRenderer(document);
            for (int index = 0; index < count; index++) {
                List<String> values;
                try {
                    values = decodePdfPage(document, renderer, index);
                } catch (IOException | RuntimeException ex) {
                    values = List.of();
                }
                if (values.isEmpty()) {
                    scans.add(new PageScan(index, STATUS_NOT_FOUND, null, null));
                    continue;
                }
                Set<String> distinct = new LinkedHashSet<>(values);
                if (distinct.size() > 1) {
                    scans.add(new PageScan(index, STATUS_MULTIPLE, String.join(" | ", distinct), null));
                    continue;
                }
                String raw = distinct.iterator().next();
                Optional<PageCode> code = parsePageCode(raw);
                scans.add(code.isPresent()
                        ? new PageScan(index, STATUS_DECODED, raw, code.get())
                        : new PageScan(index, STATUS_FOREIGN, raw, null));
            }
        }
        return scans;
    }

    private static DecodeResult classify(List<String> values) {
        if (values.isEmpty()) {
            return DecodeResult.of(STATUS_NOT_FOUND);
        }
        Set<String> distinct = new LinkedHashSet<>(values);
        if (distinct.size() > 1) {
            return new DecodeResult(STATUS_MULTIPLE, String.join(" | ", distinct), null);
        }
        String raw = distinct.iterator().next();
        return parsePageCode(raw)
                .map(code -> new DecodeResult(STATUS_DECODED, raw, code.token()))
                .orElseGet(() -> new DecodeResult(STATUS_FOREIGN, raw, null));
    }

    private static List<String> decodePdfFirstPage(byte[] content) throws IOException {
        try (PDDocument document = Loader.loadPDF(content)) {
            if (document.getNumberOfPages() == 0) {
                throw new IOException("The PDF has no pages");
            }
            return decodePdfPage(document, new PDFRenderer(document), 0);
        }
    }

    private static List<String> decodePdfPage(PDDocument document, PDFRenderer renderer, int pageIndex) throws IOException {
        {
            PDPage page = document.getPage(pageIndex);
            PDRectangle box = page.getCropBox();
            for (int dpi : DECODE_DPI) {
                double scale = dpi / 72.0;
                double pixels = (double) box.getWidth() * scale * box.getHeight() * scale;
                float effectiveScale = pixels > MAX_RENDER_PIXELS ? (float) (scale * Math.sqrt(MAX_RENDER_PIXELS / pixels)) : (float) scale;
                BufferedImage image = renderer.renderImage(pageIndex, effectiveScale, ImageType.GRAY);
                List<String> values = readAll(image);
                if (!values.isEmpty()) {
                    return values;
                }
            }
            return List.of();
        }
    }

    private static List<String> readAll(BufferedImage image) {
        int width = image.getWidth();
        int height = image.getHeight();
        int[] pixels = image.getRGB(0, 0, width, height, null, 0, width);
        LuminanceSource source = new RGBLuminanceSource(width, height, pixels);
        Map<DecodeHintType, Object> hints = new EnumMap<>(DecodeHintType.class);
        hints.put(DecodeHintType.TRY_HARDER, Boolean.TRUE);
        hints.put(DecodeHintType.POSSIBLE_FORMATS, List.of(BarcodeFormat.QR_CODE));
        QRCodeMultiReader reader = new QRCodeMultiReader();
        for (BinaryBitmap bitmap : List.of(
                new BinaryBitmap(new HybridBinarizer(source)),
                new BinaryBitmap(new GlobalHistogramBinarizer(source)))) {
            try {
                Result[] results = reader.decodeMultiple(bitmap, hints);
                List<String> values = new ArrayList<>();
                for (Result result : results) {
                    values.add(result.getText());
                }
                if (!values.isEmpty()) {
                    return values;
                }
            } catch (NotFoundException ex) {
                // Try the next binarizer.
            }
        }
        return List.of();
    }
}
