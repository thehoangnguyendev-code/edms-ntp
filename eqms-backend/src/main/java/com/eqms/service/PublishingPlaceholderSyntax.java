package com.eqms.service;

import org.springframework.util.StringUtils;

import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

final class PublishingPlaceholderSyntax {

    static final Pattern PLACEHOLDER_PATTERN = Pattern.compile("\\{\\{\\s*([a-zA-Z0-9_.-]+)(?:\\s*\\|\\s*([^{}]+?))?\\s*\\}\\}");
    private static final Pattern PLACEHOLDER_TOKEN_PATTERN = Pattern.compile("^([a-zA-Z0-9_.-]+)(?:\\s*\\|\\s*([^{}]+?))?$");

    private PublishingPlaceholderSyntax() {
    }

    static PlaceholderToken parse(String placeholder) {
        if (!StringUtils.hasText(placeholder)) {
            return null;
        }
        String candidate = placeholder.trim();
        if (candidate.startsWith("{{") && candidate.endsWith("}}")) {
            Matcher matcher = PLACEHOLDER_PATTERN.matcher(candidate);
            if (!matcher.matches()) {
                return null;
            }
            String name = matcher.group(1).trim();
            String transform = matcher.group(2) == null ? null : matcher.group(2).trim().toLowerCase(Locale.ROOT);
            return new PlaceholderToken(name, transform);
        }
        Matcher matcher = PLACEHOLDER_TOKEN_PATTERN.matcher(candidate);
        if (!matcher.matches()) {
            return null;
        }
        String name = matcher.group(1).trim();
        String transform = matcher.group(2) == null ? null : matcher.group(2).trim().toLowerCase(Locale.ROOT);
        return new PlaceholderToken(name, transform);
    }

    static PlaceholderToken parse(String name, String transform) {
        if (!StringUtils.hasText(name)) {
            return null;
        }
        return new PlaceholderToken(
                name.trim(),
                StringUtils.hasText(transform) ? transform.trim().toLowerCase(Locale.ROOT) : null
        );
    }

    static String normalizeKey(String name, String transform) {
        if (!StringUtils.hasText(name)) {
            return null;
        }
        String normalizedName = name.trim().toLowerCase(Locale.ROOT);
        if (!StringUtils.hasText(transform)) {
            return normalizedName;
        }
        return normalizedName + "|" + transform.trim().toLowerCase(Locale.ROOT);
    }

    /**
     * Many placeholder tokens are aliases of the same underlying field (e.g. {{author}},
     * {{authorName}}, {{preparedBy}} all resolve to the revision author). Placeholder styles
     * must be keyed by this canonical name — not the raw token text — so that styling one
     * alias applies regardless of which alias variant is actually typed in the DOCX. Mirrors
     * the alias groups in PublishingTemplatePlaceholderMapperService's value resolution switch.
     */
    static String canonicalName(String rawName) {
        if (!StringUtils.hasText(rawName)) {
            return rawName;
        }
        String normalized = rawName.trim().toLowerCase(Locale.ROOT);
        String collapsed = normalized.replaceAll("[_\\-\\s]+", "");
        if (collapsed.startsWith("reviewersignature") && collapsed.length() > "reviewersignature".length()
                && Character.isDigit(collapsed.charAt("reviewersignature".length()))) {
            return collapsed;
        }
        if (collapsed.startsWith("approversignature") && collapsed.length() > "approversignature".length()
                && Character.isDigit(collapsed.charAt("approversignature".length()))) {
            return collapsed;
        }
        return switch (normalized) {
            case "doctype", "documenttype", "document_type", "type" -> "documenttype";
            case "documentnumber", "document_number" -> "documentnumber";
            case "documentname", "document_name" -> "documentname";
            case "revisionnumber", "revision_number" -> "revisionnumber";
            case "revisionname", "revision_name" -> "revisionname";
            case "effectivedate", "effective_date" -> "effectivedate";
            case "reviewdate", "review_date" -> "reviewdate";
            case "validuntil", "valid_until" -> "validuntil";
            case "author", "authorname", "preparedby", "prepared_by" -> "author";
            case "authorusername", "author_username", "preparedbyusername", "prepared_by_username" -> "authorusername";
            case "authorposition", "author_position", "preparedbyposition", "prepared_by_position" -> "authorposition";
            case "checkedby", "checkedbyname", "checked_by", "reviewedby", "reviewed_by" -> "checkedby";
            case "checkedbyusername", "checked_by_username", "reviewedbyusername", "reviewed_by_username" -> "checkedbyusername";
            case "checkedbyposition", "checked_by_position", "reviewedbyposition", "reviewed_by_position" -> "checkedbyposition";
            case "approvedby", "approvedbyname", "approved_by" -> "approvedby";
            case "approvedbyusername", "approved_by_username" -> "approvedbyusername";
            case "approvedbyposition", "approved_by_position" -> "approvedbyposition";
            case "openedby", "opened_by" -> "openedby";
            case "openedbyusername", "opened_by_username" -> "openedbyusername";
            case "submittedbyusername", "submitted_by_username" -> "submittedbyusername";
            case "businessunit", "business_unit" -> "businessunit";
            case "titlelocallanguage", "title_local_language" -> "titlelocallanguage";
            case "trainingcompletiondate", "training_completion_date" -> "trainingcompletiondate";
            case "trainingplanneddate", "training_planned_date" -> "trainingplanneddate";
            case "trainingperiodenddate", "training_period_end_date" -> "trainingperiodenddate";
            case "requirestraining", "requires_training" -> "requirestraining";
            case "coauthors", "co_authors" -> "coauthors";
            case "reviewersignatures", "reviewer_signatures" -> "reviewersignatures";
            case "approversignatures", "approver_signatures" -> "approversignatures";
            case "status", "state" -> "status";
            case "page", "pagecount", "page_count" -> "page";
            case "copyno", "copy_no" -> "copyno";
            case "issuedby", "issued_by" -> "issuedby";
            case "submittedon", "submitted_on", "submitforreviewtime", "submit_for_review_time" -> "submittedon";
            case "reviewedon", "reviewed_on", "reviewcompletetime", "review_complete_time" -> "reviewedon";
            case "approvedon", "approved_on", "approvalcompletetime", "approval_complete_time" -> "approvedon";
            case "distributionlist", "distribution_list" -> "distributionlist";
            case "reviewevaluate", "review_evaluate", "reviewhistory" -> "reviewhistory";
            case "preparedsignature", "prepared_signature", "authorsignature", "author_signature", "authorblock", "author_block" -> "preparedsignature";
            case "dcosignature", "dco_signature", "submittedsignature", "submitted_signature", "submittedbysignature", "submitted_by_signature", "submittedforreviewsignature", "submitted_for_review_signature" -> "dcosignature";
            case "reviewedsignature", "reviewed_signature" -> "reviewedsignature";
            case "approvedsignature", "approved_signature" -> "approvedsignature";
            case "publishedsignature", "published_signature" -> "publishedsignature";
            case "obsoletedsignature", "obsoleted_signature" -> "obsoletedsignature";
            case "cancelledsignature", "cancelled_signature" -> "cancelledsignature";
            default -> normalized;
        };
    }

    static String applyTransform(String value, String transform) {
        String safeValue = value == null ? "-" : value;
        if (!StringUtils.hasText(transform)) {
            return safeValue;
        }
        String result = safeValue;
        for (String rawStep : transform.split("\\|")) {
            String step = rawStep.trim();
            if (!StringUtils.hasText(step)) {
                continue;
            }
            String lower = step.toLowerCase(Locale.ROOT);
            if (lower.startsWith("size:") || lower.startsWith("fontsize:") || lower.startsWith("font-size:")) {
                continue;
            }
            if ("upper".equals(lower) || "uppercase".equals(lower)) {
                result = result.toUpperCase(Locale.ROOT);
                continue;
            }
            if ("lower".equals(lower) || "lowercase".equals(lower)) {
                result = result.toLowerCase(Locale.ROOT);
                continue;
            }
            if ("trim".equals(lower)) {
                result = result.trim();
                continue;
            }
            if ("title".equals(lower) || "titlecase".equals(lower) || "capitalized".equals(lower) || "capitalize".equals(lower) || "capitalizedcase".equals(lower)) {
                result = toTitleCase(result);
                continue;
            }
        }
        return result;
    }

    private static String toTitleCase(String value) {
        if (!StringUtils.hasText(value)) {
            return value;
        }
        String[] parts = value.toLowerCase(Locale.ROOT).split("\\s+");
        StringBuilder builder = new StringBuilder();
        for (String part : parts) {
            if (!StringUtils.hasText(part)) {
                continue;
            }
            if (builder.length() > 0) {
                builder.append(' ');
            }
            builder.append(Character.toUpperCase(part.charAt(0)));
            if (part.length() > 1) {
                builder.append(part.substring(1));
            }
        }
        return builder.toString();
    }

    static Double extractFontSize(String transform) {
        if (!StringUtils.hasText(transform)) {
            return null;
        }
        for (String rawStep : transform.split("\\|")) {
            String step = rawStep.trim().toLowerCase(Locale.ROOT);
            if (step.startsWith("size:")) {
                return parseFontSize(step.substring("size:".length()));
            }
            if (step.startsWith("fontsize:")) {
                return parseFontSize(step.substring("fontsize:".length()));
            }
            if (step.startsWith("font-size:")) {
                return parseFontSize(step.substring("font-size:".length()));
            }
            if (step.startsWith("pt:")) {
                return parseFontSize(step.substring("pt:".length()));
            }
        }
        return null;
    }

    static String extractFontFamily(String transform) {
        if (!StringUtils.hasText(transform)) {
            return null;
        }
        for (String rawStep : transform.split("\\|")) {
            String step = rawStep.trim();
            if (!StringUtils.hasText(step)) {
                continue;
            }
            String lower = step.toLowerCase(Locale.ROOT);
            if (lower.startsWith("font:")) {
                return normalizeFontFamily(step.substring("font:".length()));
            }
            if (lower.startsWith("font-family:")) {
                return normalizeFontFamily(step.substring("font-family:".length()));
            }
            if (lower.startsWith("family:")) {
                return normalizeFontFamily(step.substring("family:".length()));
            }
        }
        return null;
    }

    private static String normalizeFontFamily(String rawValue) {
        if (!StringUtils.hasText(rawValue)) {
            return null;
        }
        String value = rawValue.trim();
        if ((value.startsWith("'") && value.endsWith("'")) || (value.startsWith("\"") && value.endsWith("\""))) {
            value = value.substring(1, value.length() - 1).trim();
        }
        return StringUtils.hasText(value) ? value : null;
    }

    private static Double parseFontSize(String rawValue) {
        if (!StringUtils.hasText(rawValue)) {
            return null;
        }
        try {
            double size = Double.parseDouble(rawValue.trim());
            return size > 0 ? size : null;
        } catch (NumberFormatException ex) {
            return null;
        }
    }

    record PlaceholderToken(String name, String transform) {
        String key() {
            return normalizeKey(name, transform);
        }
    }
}
