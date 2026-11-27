package com.eqms.service;

import com.eqms.auth.CurrentUserService;
import com.eqms.dto.audittrail.AuditTrailChangeResponse;
import com.eqms.entity.NotificationPolicy;
import com.eqms.entity.NotificationTemplateVersion;
import com.eqms.entity.UserAccount;
import com.eqms.repository.NotificationEventDefinitionRepository;
import com.eqms.repository.NotificationPolicyRepository;
import com.eqms.repository.NotificationTemplateVersionRepository;
import com.eqms.repository.UserLocalizationPreferenceRepository;
import jakarta.persistence.EntityNotFoundException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

/** The Vietnamese wording of notifications: reading and saving it, and giving a recipient the wording of their language. */
@Service
public class NotificationTranslationService {
    public static final String VIETNAMESE = "vi";
    private static final Set<String> CHANNELS = Set.of(NotificationTemplateVersion.CHANNEL_IN_APP, NotificationTemplateVersion.CHANNEL_EMAIL);

    /** What the editor sends. {@code baseVersionId} is the English version the person translated from. */
    public record SaveRequest(UUID baseVersionId, String title, String summary, String subject, String body, String actionLabel, String changeSummary) {}

    private final JdbcTemplate jdbc;
    private final NotificationEventDefinitionRepository events;
    private final NotificationPolicyRepository policies;
    private final NotificationTemplateVersionRepository versions;
    private final UserLocalizationPreferenceRepository preferences;
    private final CurrentUserService currentUser;
    private final AuditTrailService audit;

    public NotificationTranslationService(JdbcTemplate jdbc, NotificationEventDefinitionRepository events, NotificationPolicyRepository policies,
                                          NotificationTemplateVersionRepository versions, UserLocalizationPreferenceRepository preferences,
                                          CurrentUserService currentUser, AuditTrailService audit) {
        this.jdbc = jdbc;
        this.events = events;
        this.policies = policies;
        this.versions = versions;
        this.preferences = preferences;
        this.currentUser = currentUser;
        this.audit = audit;
    }

    // ---------------------------------------------------------------------------------------------------------------------------- sending

    /**
     * The wording to render for a recipient: the translation when the person chose Vietnamese, a translation of exactly this English version exists and the English wording
     * otherwise the English version itself, unchanged. A failure to look it up never stops the notification.
     */
    public NotificationTemplateVersion forRecipient(NotificationTemplateVersion english, UUID recipientId) {
        if (english == null || english.getId() == null || recipientId == null) return english;
        try {
            if (!preferences.findById(recipientId).map(p -> VIETNAMESE.equalsIgnoreCase(p.getLanguage())).orElse(false)) return english;
            return forLanguage(english, VIETNAMESE);
        } catch (RuntimeException failure) {
            org.slf4j.LoggerFactory.getLogger(NotificationTranslationService.class).warn("The translation of version {} was not read; the English wording is sent", english.getId(), failure);
            return english;
        }
    }

    /** The wording of one language for a stored English version; English itself when the language is not Vietnamese or no translation exists. */
    public NotificationTemplateVersion forLanguage(NotificationTemplateVersion english, String language) {
        if (english == null || english.getId() == null || !VIETNAMESE.equalsIgnoreCase(language)) return english;
        try {
            Map<String, Object> row = jdbc.queryForList("select title, summary, subject, body, action_label from notification_template_translations where base_version_id = ? and language = ? and status = 'ACTIVE'",
                    english.getId(), VIETNAMESE).stream().findFirst().orElse(null);
            if (row == null) return english;
            NotificationTemplateVersion translated = new NotificationTemplateVersion();
            translated.setPolicy(english.getPolicy());
            translated.setChannel(english.getChannel());
            translated.setVersionNumber(english.getVersionNumber());
            translated.setStatus(english.getStatus());
            translated.setTitle(text(row.get("title"), english.getTitle()));
            translated.setSummary(text(row.get("summary"), english.getSummary()));
            translated.setSubject(text(row.get("subject"), english.getSubject()));
            translated.setBody(text(row.get("body"), english.getBody()));
            translated.setActionLabel(text(row.get("action_label"), english.getActionLabel()));
            // where it opens is never translated
            translated.setActionUrlTemplate(english.getActionUrlTemplate());
            return translated;
        } catch (RuntimeException failure) {
            org.slf4j.LoggerFactory.getLogger(NotificationTranslationService.class).warn("The translation of version {} was not read; the English wording is used", english.getId(), failure);
            return english;
        }
    }

    // ---------------------------------------------------------------------------------------------------------------------------- the editor

    @Transactional(readOnly = true)
    public Map<String, Object> get(String eventCode, String channel) {
        NotificationPolicy policy = policy(eventCode);
        NotificationTemplateVersion english = english(policy, channel);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("language", VIETNAMESE);
        out.put("channel", channel);
        if (english == null) {
            out.put("translatable", false);
            out.put("noEnglishWording", true);
            return out;
        }
        Set<String> used = placeholdersOf(english);
        out.put("translatable", true);
        out.put("requiredPlaceholders", List.copyOf(used));
        out.put("baseVersionId", english.getId());
        Map<String, Object> row = jdbc.queryForList("select title, summary, subject, body, action_label, base_version_id from notification_template_translations where policy_id = ? and channel = ? and language = ? and status = 'ACTIVE'",
                policy.getId(), channel, VIETNAMESE).stream().findFirst().orElse(null);
        if (row != null) {
            Map<String, Object> translation = new LinkedHashMap<>();
            translation.put("title", row.get("title"));
            translation.put("summary", row.get("summary"));
            translation.put("subject", row.get("subject"));
            translation.put("body", row.get("body"));
            translation.put("actionLabel", row.get("action_label"));
            // the English wording changed after this was written: it is kept for the editor but no longer sent
            translation.put("outdated", !english.getId().equals(row.get("base_version_id")));
            out.put("translation", translation);
        }
        return out;
    }

    @Transactional
    public Map<String, Object> save(String eventCode, String channel, SaveRequest request) {
        UserAccount actor = currentUser.requireCurrentUser();
        NotificationPolicy policy = policy(eventCode);
        NotificationTemplateVersion english = english(policy, channel);
        if (english == null) throw new IllegalArgumentException("There is no English wording to translate yet.");
        if (request == null || !english.getId().equals(request.baseVersionId())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "The English wording was changed while you were translating. Reload and translate the current version.");
        }
        boolean email = NotificationTemplateVersion.CHANNEL_EMAIL.equals(channel);
        String title = email ? null : trimmed(request.title(), 255, "title");
        String summary = email ? null : trimmed(request.summary(), 500, "message");
        String subject = email ? trimmed(request.subject(), 255, "subject") : null;
        String body = email ? EmailTemplateService.sanitizeWording(Objects.toString(request.body(), "")) : null;
        String label = email ? trimmed(request.actionLabel(), 80, "button label") : null;
        if (email) {
            if (!StringUtils.hasText(subject) || !StringUtils.hasText(body)) throw new IllegalArgumentException("The subject and the message are required.");
            if (StringUtils.hasText(english.getActionLabel()) && !StringUtils.hasText(label)) throw new IllegalArgumentException("The button label is required.");
        } else if (StringUtils.hasText(english.getTitle()) && !StringUtils.hasText(title) || StringUtils.hasText(english.getSummary()) && !StringUtils.hasText(summary)) {
            throw new IllegalArgumentException("The title and the message are required.");
        }
        // the address of the button is not part of a translation, so its placeholders are not asked of it
        NotificationTranslationRules.requireSamePlaceholders(
                NotificationTranslationRules.placeholders(english.getTitle(), english.getSummary(), email ? english.getSubject() : null, email ? english.getBody() : null, email ? english.getActionLabel() : null),
                NotificationTranslationRules.placeholders(title, summary, subject, body, label));

        Map<String, Object> before = jdbc.queryForList("select title, summary, subject, body, action_label from notification_template_translations where policy_id = ? and channel = ? and language = ? and status = 'ACTIVE' for update",
                policy.getId(), channel, VIETNAMESE).stream().findFirst().orElse(Map.of());
        jdbc.update("update notification_template_translations set status = 'ARCHIVED' where policy_id = ? and channel = ? and language = ? and status = 'ACTIVE'", policy.getId(), channel, VIETNAMESE);
        jdbc.update("""
            insert into notification_template_translations(policy_id, channel, language, version_number, status, base_version_id, title, summary, subject, body, action_label, change_summary, created_by)
            values (?, ?, ?, (select coalesce(max(version_number), 0) + 1 from notification_template_translations where policy_id = ? and channel = ? and language = ?), 'ACTIVE', ?, ?, ?, ?, ?, ?, ?, ?)
            """, policy.getId(), channel, VIETNAMESE, policy.getId(), channel, VIETNAMESE, english.getId(), title, summary, subject, body, label,
                trimmed(request.changeSummary(), 500, "change summary"), actor.getId());

        List<AuditTrailChangeResponse> changes = new ArrayList<>();
        change(changes, "Title (Vietnamese)", before.get("title"), title);
        change(changes, "Summary (Vietnamese)", before.get("summary"), summary);
        change(changes, "Subject (Vietnamese)", before.get("subject"), subject);
        change(changes, "Body (Vietnamese)", before.get("body"), body);
        change(changes, "Button label (Vietnamese)", before.get("action_label"), label);
        audit.logAs(actor, "NOTIFICATION_POLICY", eventName(eventCode) + " (" + channel + ", Vietnamese)", policy.getId(), "UPDATE_CONTENT", null, null,
                StringUtils.hasText(request.changeSummary()) ? request.changeSummary() : "Vietnamese wording saved for English version " + english.getVersionNumber(), changes);
        return get(eventCode, channel);
    }

    private NotificationPolicy policy(String eventCode) {
        return policies.findByEventCode(eventCode).orElseThrow(() -> new EntityNotFoundException("Notification not found"));
    }

    private String eventName(String eventCode) {
        return events.findByCode(eventCode).map(e -> e.getName()).orElse(eventCode);
    }

    private NotificationTemplateVersion english(NotificationPolicy policy, String channel) {
        if (!CHANNELS.contains(channel)) throw new IllegalArgumentException("Unknown channel");
        return versions.findFirstByPolicy_IdAndChannelAndStatusOrderByVersionNumberDesc(policy.getId(), channel, NotificationTemplateVersion.STATUS_ACTIVE).orElse(null);
    }

    /** Every placeholder the English version of the channel shows to a reader (not the address it opens). */
    private static Set<String> placeholdersOf(NotificationTemplateVersion version) {
        boolean email = NotificationTemplateVersion.CHANNEL_EMAIL.equals(version.getChannel());
        return NotificationTranslationRules.placeholders(email ? null : version.getTitle(), email ? null : version.getSummary(),
                email ? version.getSubject() : null, email ? version.getBody() : null, email ? version.getActionLabel() : null);
    }

    private static String text(Object translated, String english) {
        return translated == null || !StringUtils.hasText(translated.toString()) ? english : translated.toString();
    }

    private static String trimmed(String value, int max, String what) {
        if (value == null || value.isBlank()) return null;
        String result = value.trim();
        if (result.length() > max) throw new IllegalArgumentException("The " + what + " must be " + max + " characters or fewer.");
        return result;
    }

    private static void change(List<AuditTrailChangeResponse> changes, String label, Object before, String after) {
        String b = before == null ? "" : before.toString();
        String a = after == null ? "" : after;
        if (!b.equals(a)) changes.add(new AuditTrailChangeResponse(label, b, a));
    }
}
