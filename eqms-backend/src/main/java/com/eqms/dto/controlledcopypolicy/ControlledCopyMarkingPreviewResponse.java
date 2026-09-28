package com.eqms.dto.controlledcopypolicy;

import java.util.List;

/** One page of the template with the drafted marks on it, plus what the server noticed about their placement. */
public record ControlledCopyMarkingPreviewResponse(
        /** PNG of the page, base64. */
        String imageBase64,
        float pageWidthPt,
        float pageHeightPt,
        /** Where each mark was drawn on this page (points, origin bottom-left). */
        List<MarkBox> marks,
        List<Warning> warnings,
        /** A remark about the picture itself (for example: the template has no body page). */
        String note
) {
    /**
     * One mark as drawn: {@code layer} is "Issued stamp" / "Issued watermark" / "Status stamp" / "Status watermark", {@code kind} STAMP or
     * WATERMARK. For a watermark the box is its unrotated block centred on its centre, rotated by {@code angle} degrees.
     * {@code adjusted} means the server had to move it off another mark of the same kind.
     */
    public record MarkBox(String layer, String kind, float x, float y, float width, float height, float angle, boolean adjusted) {
    }

    public record Warning(String code, String message) {
    }
}
