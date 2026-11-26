package com.eqms.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.stream.Collectors;
import java.util.stream.Stream;

/**
 * The Vietnamese wording that comes with the system (notification-translations-vi.json). It is added once, after start-up, where a notification channel has never had
 * a Vietnamese wording and its English wording is exactly the one the translation was written from. It never replaces what an administrator wrote, and each addition
 * is recorded in the Audit Trail.
 */
@Component
public class NotificationSuppliedTranslations {
    static final String RESOURCE = "notification-translations-vi.json";
    private static final Logger log = LoggerFactory.getLogger(NotificationSuppliedTranslations.class);

    public record Supplied(String eventCode, String channel, String english, String title, String summary, String subject, String body, String actionLabel) {}

    private final JdbcTemplate jdbc;
    private final ObjectMapper mapper;
    private final AuditTrailService audit;

    public NotificationSuppliedTranslations(JdbcTemplate jdbc, ObjectMapper mapper, AuditTrailService audit) {
        this.jdbc = jdbc;
        this.mapper = mapper;
        this.audit = audit;
    }

    @EventListener(ApplicationReadyEvent.class)
    @Transactional
    public void addMissing() {
        int added = 0;
        for (Supplied wording : supplied()) {
            // one row only when the channel never had a Vietnamese wording
            List<Map<String, Object>> english = jdbc.queryForList("""
                select p.id as policy_id, v.id as version_id, v.title, v.summary, v.subject, v.body, v.action_label
                  from notification_policies p join notification_template_versions v on v.policy_id = p.id and v.channel = ? and v.status = 'ACTIVE'
                 where p.event_code = ? and not exists (select 1 from notification_template_translations t where t.policy_id = p.id and t.channel = ? and t.language = 'vi')
                """, wording.channel(), wording.eventCode(), wording.channel());
            if (english.size() != 1) continue;
            Map<String, Object> row = english.get(0);
            if (!wording.english().equals(fingerprint(wording.channel(), row))) continue;
            UUID policyId = (UUID) row.get("policy_id");
            String body = wording.body() == null ? null : EmailTemplateService.sanitizeWording(wording.body());
            jdbc.update("""
                insert into notification_template_translations(policy_id, channel, language, version_number, status, base_version_id, title, summary, subject, body, action_label, change_summary)
                values (?, ?, 'vi', 1, 'ACTIVE', ?, ?, ?, ?, ?, ?, 'Supplied with the system')
                """, policyId, wording.channel(), row.get("version_id"), wording.title(), wording.summary(), wording.subject(), body, wording.actionLabel());
            audit.logSystem("NOTIFICATION_POLICY", wording.eventCode() + " (" + wording.channel() + ", Vietnamese)", policyId, "UPDATE_CONTENT", null, null,
                    "Vietnamese wording supplied with the system, to be reviewed");
            added++;
        }
        if (added > 0) log.info("Added the supplied Vietnamese wording of {} notification channels", added);
    }

    List<Supplied> supplied() {
        try (InputStream in = new ClassPathResource(RESOURCE).getInputStream()) {
            return mapper.readValue(in, new TypeReference<List<Supplied>>() {});
        } catch (java.io.IOException failure) {
            log.warn("The supplied Vietnamese wording could not be read", failure);
            return List.of();
        }
    }

    /** The English wording a reader sees on the channel; the address it opens is not part of it. */
    static String fingerprint(String channel, Map<String, Object> row) {
        boolean email = "EMAIL".equals(channel);
        String text = Stream.of(email ? null : row.get("title"), email ? null : row.get("summary"), email ? row.get("subject") : null, email ? row.get("body") : null, email ? row.get("action_label") : null)
                .map(value -> Objects.toString(value, "")).collect(Collectors.joining("\u0001"));
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(text.getBytes(StandardCharsets.UTF_8)));
        } catch (java.security.NoSuchAlgorithmException impossible) {
            throw new IllegalStateException(impossible);
        }
    }
}
