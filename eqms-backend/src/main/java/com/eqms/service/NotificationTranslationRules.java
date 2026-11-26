package com.eqms.service;

import java.util.Arrays;
import java.util.LinkedHashSet;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** What a translation of a notification wording must keep. */
public final class NotificationTranslationRules {
    private static final Pattern PLACEHOLDER = Pattern.compile("\\{\\{\\s*([A-Za-z0-9_.]+)\\s*}}");

    private NotificationTranslationRules() {}

    public static Set<String> placeholders(String... texts) {
        Set<String> found = new LinkedHashSet<>();
        for (String text : texts) {
            if (text == null) continue;
            Matcher matcher = PLACEHOLDER.matcher(text);
            while (matcher.find()) found.add(matcher.group(1));
        }
        return found;
    }

    /**
     * Refuses a translation that would lose a value (a link, a code, a number) or ask for one the English wording does not use.
     * The message names the placeholders, so the editor can show it as it is.
     */
    public static void requireSamePlaceholders(Set<String> english, Set<String> translated) {
        Set<String> missing = new LinkedHashSet<>(english);
        missing.removeAll(translated);
        Set<String> extra = new LinkedHashSet<>(translated);
        extra.removeAll(english);
        if (!missing.isEmpty()) throw new IllegalArgumentException("The translation must keep every placeholder of the English wording. Missing: " + braces(missing));
        if (!extra.isEmpty()) throw new IllegalArgumentException("The translation uses placeholders the English wording does not use: " + braces(extra));
    }

    private static String braces(Set<String> names) {
        return String.join(", ", Arrays.stream(names.toArray(new String[0])).map(n -> "{{" + n + "}}").toList());
    }
}
