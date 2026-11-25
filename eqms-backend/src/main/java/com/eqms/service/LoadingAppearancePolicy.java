package com.eqms.service;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.Set;

/** Only presentation identifiers and a colour are public; no arbitrary CSS or component code. */
public final class LoadingAppearancePolicy {
    public static final String DEFAULT_STYLE = "system";
    public static final String DEFAULT_COLOR = "#059669";
    public static final Set<String> STYLES = Set.of(
            "system", "ring", "spokes", "classic", "dots-ring", "arc", "dual-arc", "fade-arc",
            "concentric-ring", "orbit-ring", "satellite-ring", "clock-ring", "quarter-ring", "dash-ring",
            "pulse", "ripple", "pulse-dot", "dots", "bobbing-dots", "bouncing-dots", "typing", "wave", "bars");

    private LoadingAppearancePolicy() { }

    public static void validate(JsonNode general) {
        JsonNode appearance = general == null ? null : general.get("appearance");
        JsonNode style = appearance == null ? null : appearance.get("loadingStyle");
        JsonNode color = appearance == null ? null : appearance.get("loadingColor");
        if (style != null && !style.isNull() && (!style.isTextual() || !STYLES.contains(style.asText()))) {
            throw new IllegalArgumentException("loadingStyle must be a supported loading animation");
        }
        if (color != null && !color.isNull() && (!color.isTextual() || !color.asText().matches("^#[0-9a-fA-F]{6}$"))) {
            throw new IllegalArgumentException("loadingColor must be a six-digit hex color");
        }
    }

    public static String publicStyle(JsonNode appearance) {
        JsonNode value = appearance == null ? null : appearance.get("loadingStyle");
        return value != null && value.isTextual() && STYLES.contains(value.asText()) ? value.asText() : DEFAULT_STYLE;
    }

    public static String publicColor(JsonNode appearance) {
        JsonNode value = appearance == null ? null : appearance.get("loadingColor");
        return value != null && value.isTextual() && value.asText().matches("^#[0-9a-fA-F]{6}$") ? value.asText() : DEFAULT_COLOR;
    }
}
