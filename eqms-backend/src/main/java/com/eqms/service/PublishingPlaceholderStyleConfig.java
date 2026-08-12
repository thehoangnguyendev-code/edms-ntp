package com.eqms.service;

import java.util.List;

public record PublishingPlaceholderStyleConfig(
        List<String> transforms,
        String fontFamily,
        Double fontSizePt,
        Boolean bold,
        Boolean italic,
        Boolean underline,
        String color,
        String alignment,
        String dateFormat,
        String numberFormat,
        Boolean preserveLineBreaks,
        Integer maxLines
) {}
