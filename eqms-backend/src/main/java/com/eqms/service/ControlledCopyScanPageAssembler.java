package com.eqms.service;

import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;

/**
 * Cuts and joins the pages of scanned PDFs when a recall scan holds loose pages of several controlled copies. Pure functions on
 * bytes: nothing here knows about copies, so the ordering rules stay in {@link ControlledCopyRecallBatchService}.
 */
final class ControlledCopyScanPageAssembler {

    /** One page to put in a new file: page {@code index} (zero-based) of {@code pdf}. */
    record PageRef(byte[] pdf, int index) {
    }

    private ControlledCopyScanPageAssembler() {
    }

    static int pageCount(byte[] pdf) throws IOException {
        try (PDDocument document = Loader.loadPDF(pdf)) {
            return document.getNumberOfPages();
        }
    }

    /** A new PDF made of the given pages, in the given order. */
    static byte[] assemble(List<PageRef> pages) throws IOException {
        List<PDDocument> sources = new ArrayList<>();
        try (PDDocument target = new PDDocument(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            java.util.IdentityHashMap<byte[], PDDocument> opened = new java.util.IdentityHashMap<>();
            for (PageRef ref : pages) {
                PDDocument source = opened.get(ref.pdf());
                if (source == null) {
                    source = Loader.loadPDF(ref.pdf());
                    opened.put(ref.pdf(), source);
                    sources.add(source);
                }
                target.importPage(source.getPage(ref.index()));
            }
            target.save(out);
            return out.toByteArray();
        } finally {
            for (PDDocument source : sources) {
                try {
                    source.close();
                } catch (IOException ignored) {
                    // Nothing more can be done for a source that cannot be closed.
                }
            }
        }
    }
}
