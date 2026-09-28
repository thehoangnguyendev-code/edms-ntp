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
        java.util.List<MarkingPlacementRule> placements
) {}
