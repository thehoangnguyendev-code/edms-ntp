package com.eqms.service;

import com.eqms.util.DateTimeFormatUtils;
import com.eqms.entity.ElectronicSignature;
import com.eqms.entity.ElectronicSignatureMeaning;
import com.eqms.entity.ElectronicSignatureSetting;
import com.eqms.repository.ElectronicSignatureMeaningRepository;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class ElectronicSignatureRendererService {

    private static final DateTimeFormatter DISPLAY_TIME_PATTERN = DateTimeFormatter.ofPattern(DateTimeFormatUtils.DATETIME_PATTERN_STRICT, Locale.ROOT);

    private static final Pattern UTC_OFFSET_PATTERN = Pattern.compile("^UTC([+-]\\d{1,2})(?::?(\\d{2}))?$", Pattern.CASE_INSENSITIVE);

    /** Controlled catalog of timestamp patterns permitted for the active signature configuration. */
    private static final Set<String> ALLOWED_TIMESTAMP_FORMATS = Set.of(DateTimeFormatUtils.DATETIME_PATTERN_STRICT);

    private final ElectronicSignatureMeaningRepository meaningRepository;

    public ElectronicSignatureRendererService(ElectronicSignatureMeaningRepository meaningRepository) {
        this.meaningRepository = meaningRepository;
    }

    public String renderPreviewText(ElectronicSignatureSetting setting) {
        ElectronicSignature sample = sampleSignature();
        sample.setTimezone(setting != null && StringUtils.hasText(setting.getSignatureTimezone()) ? setting.getSignatureTimezone() : "Asia/Ho_Chi_Minh");
        sample.setTimestampDisplay(formatTimestampSnapshot(sample.getSignedAt(), setting));
        return renderTextBlock(sample, setting);
    }

    /** Renders the canonical GMP signature text block. The setting param is accepted for backward compatibility but ignored. */
    public String renderTextBlock(ElectronicSignature signature, ElectronicSignatureSetting ignored) {
        ElectronicSignature s = signature == null ? new ElectronicSignature() : signature;
        String status = normalizeStatus(s.getStatus());

        if ("PENDING".equals(status)) {
            return renderPending(s);
        }
        if ("FAILED".equals(status) || "INVALID".equals(status) || "REJECTED".equals(status)) {
            return renderRejected(s);
        }
        return renderSigned(s);
    }

    private String renderSigned(ElectronicSignature s) {
        StringBuilder b = new StringBuilder();
        appendLine(b, s.getFullName());
        appendLine(b, "Electronically Signed");
        appendLine(b, signedTime(s));
        appendLine(b, "Meaning: " + displayMeaning(s.getMeaning()));
        if (StringUtils.hasText(s.getReason())) {
            appendLine(b, "Reason: " + s.getReason());
        }
        // Keep the immutable reference last. This is the same canonical order used by the
        // signature-settings preview and prevents generated DOCX/PDF blocks from drifting.
        if (StringUtils.hasText(s.getSignatureId())) {
            appendLine(b, "Signature ID: " + s.getSignatureId());
        }
        return b.toString();
    }

    private String renderPending(ElectronicSignature s) {
        StringBuilder b = new StringBuilder();
        appendLine(b, s.getFullName());
        appendLine(b, "Pending Electronic Signature");
        appendLine(b, "Meaning: " + displayMeaning(s.getMeaning()));
        return b.toString();
    }

    private String renderRejected(ElectronicSignature s) {
        StringBuilder b = new StringBuilder();
        appendLine(b, s.getFullName());
        appendLine(b, "Signature Rejected");
        appendLine(b, "Meaning: " + displayMeaning(s.getMeaning()));
        if (StringUtils.hasText(s.getReason())) {
            appendLine(b, "Reason: " + s.getReason());
        }
        return b.toString();
    }

    /**
     * The time of a signature as a person reads it. The moment (signedAt) and the zone written on the record are the record; the text is how it is shown, and it is the same
     * for every signature, old or new: dd/MM/yyyy HH:mm:ss and the offset of the zone of the record. The text stored when an old signature was made
     * (timestamp_display, for example "11-Aug-2026 13:11:40 (UTC+7)") stays in the database as evidence of what was shown then; it is not read to show a signature.
     */
    private String signedTime(ElectronicSignature s) {
        if (s.getSignedAt() == null) return "";
        ZoneId zone = resolveZoneId(s.getTimezone());
        return DISPLAY_TIME_PATTERN.withZone(zone).format(s.getSignedAt()) + " (" + offsetLabel(zone, s.getSignedAt()) + ")";
    }

    /**
     * Formats a signature timestamp using the currently active signature configuration
     * (timestamp pattern + display timezone). Used for newly-created signatures; legacy,
     * already-signed records keep their originally recorded display via {@link #renderTextBlock}
     * so that changing the active configuration never rewrites history.
     */
    public String formatTimestampSnapshot(Instant instant, ElectronicSignatureSetting setting) {
        if (instant == null) {
            return "";
        }
        String pattern = setting != null && StringUtils.hasText(setting.getSignatureTimestampFormat())
                ? setting.getSignatureTimestampFormat()
                : DateTimeFormatUtils.DATETIME_PATTERN_STRICT;
        // A new signature is always written in the zone of the site.
        ZoneId zone = DateTimeFormatUtils.ZONE;
        String formatted = DateTimeFormatter.ofPattern(pattern, Locale.ROOT).withZone(zone).format(instant);
        return formatted + " (" + offsetLabel(zone, instant) + ")";
    }

    /** Validates a candidate timestamp pattern against the controlled catalog. */
    public String normalizeTimestampFormat(String pattern) {
        String trimmed = pattern == null ? "" : pattern.trim();
        if (!ALLOWED_TIMESTAMP_FORMATS.contains(trimmed)) {
            throw new IllegalArgumentException("Unsupported signature timestamp format: " + pattern);
        }
        return trimmed;
    }

    private ZoneId resolveZoneId(String tz) {
        if (!StringUtils.hasText(tz)) {
            return DateTimeFormatUtils.ZONE;
        }
        String trimmed = tz.trim();
        try {
            return ZoneId.of(trimmed);
        } catch (Exception ignored) {
            Matcher matcher = UTC_OFFSET_PATTERN.matcher(trimmed);
            if (matcher.matches()) {
                int hours = Integer.parseInt(matcher.group(1));
                int minutes = matcher.group(2) != null ? Integer.parseInt(matcher.group(2)) : 0;
                int totalSeconds = hours * 3600 + (hours < 0 ? -minutes : minutes) * 60;
                return ZoneOffset.ofTotalSeconds(totalSeconds);
            }
            return ZoneOffset.UTC;
        }
    }

    private String offsetLabel(ZoneId zone, Instant instant) {
        ZoneOffset offset = zone.getRules().getOffset(instant);
        int totalSeconds = offset.getTotalSeconds();
        int hours = totalSeconds / 3600;
        int minutes = Math.abs((totalSeconds % 3600) / 60);
        StringBuilder sb = new StringBuilder("UTC");
        sb.append(hours >= 0 ? "+" : "").append(hours);
        if (minutes != 0) {
            sb.append(':').append(minutes < 10 ? "0" + minutes : String.valueOf(minutes));
        }
        return sb.toString();
    }

    private void appendLine(StringBuilder b, String value) {
        if (!StringUtils.hasText(value)) return;
        if (b.length() > 0) b.append('\n');
        b.append(value);
    }

    private String displayMeaning(String code) {
        return meaningRepository.findByCodeIgnoreCase(normalizeMeaning(code))
                .map(ElectronicSignatureMeaning::getDisplayName)
                .orElseGet(() -> humanize(code));
    }

    private String normalizeMeaning(String value) {
        return StringUtils.hasText(value) ? value.trim().toUpperCase(Locale.ROOT).replace('-', '_').replace(' ', '_') : "SIGNED";
    }

    private String normalizeStatus(String value) {
        return StringUtils.hasText(value) ? value.trim().toUpperCase(Locale.ROOT) : "";
    }

    private String humanize(String value) {
        if (!StringUtils.hasText(value)) return "-";
        String lower = value.toLowerCase(Locale.ROOT).replace('_', ' ');
        return Character.toUpperCase(lower.charAt(0)) + lower.substring(1);
    }

    private ElectronicSignature sampleSignature() {
        ElectronicSignature sample = new ElectronicSignature();
        sample.setFullName("Nguyen Van A");
        sample.setMeaning("APPROVED");
        sample.setReason("Document Approval");
        sample.setSignedAt(Instant.now());
        sample.setTimezone(DateTimeFormatUtils.ZONE_ID);
        sample.setStatus("SIGNED");
        sample.setSignatureId("SIG-2026-8F3A9B");
        return sample;
    }
}
