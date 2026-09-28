package com.eqms.dto.controlledcopypolicy;

/**
 * Stamp and watermark drawn on the Document tab view of a controlled copy that is no longer valid (Obsoleted) or whose request was
 * cancelled (Closed - Cancelled). Configured per status on the Controlled Copies Policy screen; the server draws them on a copy of the
 * stored PDF when it is viewed, so the stored file never changes.
 *
 * <p>On a request every field is optional (null keeps the stored value). A blank {@code watermarkText} means "use the automatic text"
 * (for an obsoleted copy: the reason it was withdrawn, e.g. RECALLED BY DOCUMENT CONTROL).</p>
 *
 * <p>{@code ignoreUnknown = true}: the stored {@code status_marking} jsonb for existing rows may still carry fields retired
 * from this record (e.g. the old {@code stampShowReason}) -- those must be silently dropped on read, not fail the whole
 * policy load.</p>
 */
@com.fasterxml.jackson.annotation.JsonIgnoreProperties(ignoreUnknown = true)
public record ControlledCopyStatusMarking(
        Boolean watermarkEnabled,
        String watermarkLayer,
        String watermarkText,
        String watermarkColor,
        @com.fasterxml.jackson.databind.annotation.JsonDeserialize(using = StrictIntegerDeserializer.class) Integer watermarkOpacityPercent,
        @com.fasterxml.jackson.databind.annotation.JsonDeserialize(using = StrictIntegerDeserializer.class) Integer watermarkAngleDegrees,
        /** One of {@link com.eqms.service.ControlledCopyPdfMarkingService}'s bundled font families. */
        String watermarkFontFamily,
        Boolean watermarkShowDate,
        /** ALL (every page) or FIRST (cover page only). */
        String watermarkPages,
        Boolean stampEnabled,
        String stampText,
        String stampColor,
        String stampPosition,
        @com.fasterxml.jackson.databind.annotation.JsonDeserialize(using = StrictIntegerDeserializer.class) Integer stampMarginMm,
        String stampSize,
        @com.fasterxml.jackson.databind.annotation.JsonDeserialize(using = StrictIntegerDeserializer.class) Integer stampOpacityPercent,
        Boolean stampShowDate,
        String stampFontFamily,
        /** ALL (every page) or FIRST (cover page only). */
        String stampPages,
        /** Per-page placement rules (see MarkingPlacementRule); null / empty = the corner and centre settings above. */
        java.util.List<MarkingPlacementRule> placements
) {

    public static final String OBSOLETED = "OBSOLETED";
    public static final String CLOSED_CANCELLED = "CLOSED_CANCELLED";

    public static ControlledCopyStatusMarking defaults(String status) {
        boolean cancelled = CLOSED_CANCELLED.equals(status);
        return new ControlledCopyStatusMarking(
                true, "ABOVE", "", "#C00000", 35, 35, "NOTO_SANS", true, "ALL",
                true, cancelled ? "CANCELLED" : "WITHDRAWN", "#C00000", "TOP_RIGHT", 4, "SMALL", 100,
                true, "NOTO_SANS", "ALL", java.util.List.of());
    }

    /** This value with every null field taken from {@code base}. */
    public ControlledCopyStatusMarking mergedOver(ControlledCopyStatusMarking base) {
        return new ControlledCopyStatusMarking(
                pick(watermarkEnabled, base.watermarkEnabled), pick(watermarkLayer, base.watermarkLayer), pick(watermarkText, base.watermarkText),
                pick(watermarkColor, base.watermarkColor), pick(watermarkOpacityPercent, base.watermarkOpacityPercent),
                pick(watermarkAngleDegrees, base.watermarkAngleDegrees), pick(watermarkFontFamily, base.watermarkFontFamily),
                pick(watermarkShowDate, base.watermarkShowDate), pick(watermarkPages, base.watermarkPages),
                pick(stampEnabled, base.stampEnabled),
                pick(stampText, base.stampText), pick(stampColor, base.stampColor), pick(stampPosition, base.stampPosition),
                pick(stampMarginMm, base.stampMarginMm), pick(stampSize, base.stampSize),
                pick(stampOpacityPercent, base.stampOpacityPercent),
                pick(stampShowDate, base.stampShowDate), pick(stampFontFamily, base.stampFontFamily), pick(stampPages, base.stampPages),
                pick(placements, base.placements));
    }

    private static <T> T pick(T value, T fallback) {
        return value != null ? value : fallback;
    }
}
