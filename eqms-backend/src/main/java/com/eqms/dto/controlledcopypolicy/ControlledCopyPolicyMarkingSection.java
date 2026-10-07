package com.eqms.dto.controlledcopypolicy;

/**
 * Stamp and watermark burned into every issued Controlled Copy PDF. All fields are optional on a request (a null keeps the
 * stored value); the server validates every value.
 */
public record ControlledCopyPolicyMarkingSection(
        Boolean stampEnabled,
        String stampText,
        String stampColor,
        String stampPosition,
        @com.fasterxml.jackson.databind.annotation.JsonDeserialize(using = StrictIntegerDeserializer.class) Integer stampMarginMm,
        String stampSize,
        @com.fasterxml.jackson.databind.annotation.JsonDeserialize(using = StrictIntegerDeserializer.class) Integer stampOpacityPercent,
        String stampPages,
        Boolean stampShowCopyNumber,
        Boolean stampShowRecipient,
        Boolean stampShowDistributedDate,
        Boolean stampShowExpiryDate,
        /** One of {@link com.eqms.service.ControlledCopyPdfMarkingService}'s bundled font families. */
        String stampFontFamily,
        String watermarkText,
        String watermarkColor,
        @com.fasterxml.jackson.databind.annotation.JsonDeserialize(using = StrictIntegerDeserializer.class) Integer watermarkOpacityPercent,
        @com.fasterxml.jackson.databind.annotation.JsonDeserialize(using = StrictIntegerDeserializer.class) Integer watermarkAngleDegrees,
        String watermarkPages,
        String watermarkLayer,
        String watermarkFontFamily,
        /** Per-page placement rules; null keeps the stored ones, an empty list clears them. */
        java.util.List<MarkingPlacementRule> placements,
        /** Print a per-copy QR code on the first page of paper copies (used to recall returned paper by scan). */
        Boolean qrCodeEnabled,
        /** TOP_LEFT, TOP_RIGHT, BOTTOM_LEFT or BOTTOM_RIGHT. */
        String qrCodePosition,
        @com.fasterxml.jackson.databind.annotation.JsonDeserialize(using = StrictIntegerDeserializer.class) Integer qrCodeSizeMm,
        /** Free position of the QR code: fractions of the first page (0 = left / top), top-left of its frame. Both or neither. */
        Double qrCodeX,
        Double qrCodeY,
        /** True puts the QR code back in the corner named by {@code qrCodePosition}. */
        Boolean qrCodeResetPosition,
        /** ALL (every page, the default) or FIRST (first page only). */
        String qrCodePages
) {}
