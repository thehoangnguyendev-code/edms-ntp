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
        Integer maxLines,
        /**
         * Where this placeholder is shown: PUBLISH (only the published document), CONTROLLED_COPY (only a controlled
         * copy) or BOTH. Null means BOTH, so styles saved before this option keep their behaviour.
         */
        String visibility
) {

    public static final String VISIBILITY_BOTH = "BOTH";
    public static final String VISIBILITY_PUBLISH = "PUBLISH";
    public static final String VISIBILITY_CONTROLLED_COPY = "CONTROLLED_COPY";

    /** Whether the placeholder is shown in the given context (true = controlled copy, false = publication). */
    public boolean visibleIn(boolean controlledCopyContext) {
        if (VISIBILITY_PUBLISH.equalsIgnoreCase(visibility)) {
            return !controlledCopyContext;
        }
        if (VISIBILITY_CONTROLLED_COPY.equalsIgnoreCase(visibility)) {
            return controlledCopyContext;
        }
        return true;
    }
}
