package com.eqms.dto.controlledcopypolicy;

import com.fasterxml.jackson.databind.annotation.JsonDeserialize;

import java.util.Locale;
import java.util.regex.Pattern;

/**
 * Where the stamp and watermark go on some pages, as fractions of the page so the same rule works for any paper size and for
 * portrait and landscape pages alike. Every position field is optional: a missing one falls back to the marking's ordinary
 * corner / centre setting.
 *
 * <p>{@code pages} says which pages the rule is for: {@code ALL}, {@code FIRST} (the cover page), {@code OTHERS} (page 2
 * onwards), or an explicit list such as {@code "3,5-7,LAST"}. When several rules match a page, an explicit list wins over
 * FIRST / OTHERS, which win over ALL.</p>
 *
 * <p>The stamp is placed by the top-left corner of its frame ({@code stampX}, {@code stampY}: 0 = left / top edge, 1 = right /
 * bottom edge) and sized by its width as a percentage of the page width. The watermark is placed by its centre
 * ({@code watermarkX}, {@code watermarkY}, same origin), scaled as a percentage of its automatic size and rotated.</p>
 */
public record MarkingPlacementRule(
        String pages,
        Double stampX,
        Double stampY,
        @JsonDeserialize(using = StrictIntegerDeserializer.class) Integer stampWidthPercent,
        Double watermarkX,
        Double watermarkY,
        @JsonDeserialize(using = StrictIntegerDeserializer.class) Integer watermarkScalePercent,
        @JsonDeserialize(using = StrictIntegerDeserializer.class) Integer watermarkAngleDegrees
) {

    public static final String ALL = "ALL";
    public static final String FIRST = "FIRST";
    public static final String OTHERS = "OTHERS";
    private static final Pattern PAGE_LIST = Pattern.compile("^(\\d{1,4}(-\\d{1,4})?|LAST)(,(\\d{1,4}(-\\d{1,4})?|LAST))*$");

    /** True when {@code spec} is ALL, FIRST, OTHERS or a well-formed page list. */
    public static boolean validPages(String spec) {
        if (spec == null) {
            return false;
        }
        String s = normalizePages(spec);
        return ALL.equals(s) || FIRST.equals(s) || OTHERS.equals(s) || PAGE_LIST.matcher(s).matches();
    }

    public static String normalizePages(String spec) {
        return spec == null ? ALL : spec.replaceAll("\\s+", "").toUpperCase(Locale.ROOT);
    }

    /** Whether this rule is written for page {@code page} (1-based) of a {@code pageCount}-page document. */
    public boolean matches(int page, int pageCount) {
        String s = normalizePages(pages);
        return switch (s) {
            case ALL -> true;
            case FIRST -> page == 1;
            case OTHERS -> page >= 2;
            default -> listMatches(s, page, pageCount);
        };
    }

    /** How specific the rule is: an explicit page list beats FIRST / OTHERS, which beat ALL. */
    public int specificity() {
        String s = normalizePages(pages);
        return ALL.equals(s) ? 0 : (FIRST.equals(s) || OTHERS.equals(s)) ? 1 : 2;
    }

    private static boolean listMatches(String list, int page, int pageCount) {
        for (String token : list.split(",")) {
            if ("LAST".equals(token)) {
                if (page == pageCount) {
                    return true;
                }
            } else if (token.contains("-")) {
                String[] range = token.split("-");
                if (page >= Integer.parseInt(range[0]) && page <= Integer.parseInt(range[1])) {
                    return true;
                }
            } else if (page == Integer.parseInt(token)) {
                return true;
            }
        }
        return false;
    }

    public boolean hasStampPosition() {
        return stampX != null && stampY != null;
    }

    public boolean hasWatermarkPosition() {
        return watermarkX != null && watermarkY != null;
    }
}
