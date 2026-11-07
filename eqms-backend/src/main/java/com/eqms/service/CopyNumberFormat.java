package com.eqms.service;

import org.springframework.util.StringUtils;

import java.util.Arrays;
import java.util.List;
import java.util.Locale;

/**
 * The shape of the number of a copy of a document, one place for both kinds so they cannot drift apart (owner decision 2026-11-02).
 * A Controlled Copy is {@code CC.<document number>.<serial>}, for example CC.SOP.0007.001; an Uncontrolled Copy is the same with a U in front,
 * UCC.SOP.0007.001. The document number is cut at every dot, dash, underscore or space and joined again with dots; the serial has three digits.
 */
public final class CopyNumberFormat {
    public static final String CONTROLLED_PREFIX = "CC";
    public static final String UNCONTROLLED_PREFIX = "UCC";

    private CopyNumberFormat() {
    }

    /** SOP.0007, SOP-0007, SOP_0007 and "SOP 0007" are all SOP.0007; an "EXT" part is left out. Blank when nothing is left. */
    public static String baseCode(String documentNumber) {
        if (!StringUtils.hasText(documentNumber)) {
            return "";
        }
        List<String> segments = Arrays.stream(documentNumber.trim().split("[.\\-_\\s]+"))
                .filter(StringUtils::hasText)
                .map(String::trim)
                .filter(segment -> !"EXT".equalsIgnoreCase(segment))
                .toList();
        return String.join(".", segments);
    }

    public static String controlled(String baseCode, long serial) {
        return CONTROLLED_PREFIX + "." + baseCode + "." + String.format(Locale.ROOT, "%03d", serial);
    }

    public static String uncontrolled(String baseCode, long serial) {
        return UNCONTROLLED_PREFIX + "." + baseCode + "." + String.format(Locale.ROOT, "%03d", serial);
    }
}
