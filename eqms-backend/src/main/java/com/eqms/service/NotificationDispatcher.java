package com.eqms.service;

import com.eqms.entity.NotificationDispatchQueue;
import com.eqms.entity.NotificationEventDefinition;
import com.eqms.entity.NotificationPolicy;
import com.eqms.entity.NotificationTemplateVersion;
import com.eqms.entity.UserAccount;
import com.eqms.entity.UserStatus;
import com.eqms.repository.NotificationDispatchQueueRepository;
import com.eqms.repository.NotificationEventDefinitionRepository;
import com.eqms.repository.NotificationPolicyRepository;
import com.eqms.repository.NotificationTemplateVersionRepository;
import com.eqms.repository.UserAccountRepository;
import com.eqms.util.NotificationPreferenceUtils;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.Arrays;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Single point through which every module (Document Control, Controlled Copies, CAPA,
 * Deviation, Audit Trail, Security, ...) raises a notification. Callers supply only the event
 * code, the already-resolved recipient list (who counts as "the reviewer"/"the owner" is
 * inherently module-specific — this service does not re-derive it), and template variables. The
 * dispatcher resolves the policy, renders the ACTIVE content per enabled channel, and is the
 * only place that turns a policy + variables into an actual in-app notification / email —
 * modules never hardcode title/body text themselves anymore.
 *
 * Mandatory (GMP) events always fire on every enabled channel regardless of the recipient's
 * notification preferences or the policy's digest setting; optional events respect both.
 */
@Service
public class NotificationDispatcher {

    private static final Logger logger = LoggerFactory.getLogger(NotificationDispatcher.class);
    private static final Pattern VARIABLE_PATTERN = Pattern.compile("\\{\\{\\s*([a-zA-Z0-9_]+)\\s*\\}\\}");
    /** Fixed local time both DAILY_DIGEST and WEEKLY_DIGEST batch to -- simple and predictable;
     * not per-policy configurable in this phase. */
    private static final int DIGEST_HOUR_OF_DAY = 8;
    private static final ZoneId ZONE = ZoneId.systemDefault();

    private final NotificationEventDefinitionRepository eventRepository;
    private final NotificationPolicyRepository policyRepository;
    private final NotificationTemplateVersionRepository templateVersionRepository;
    private final NotificationService notificationService;
    private final UserAccountRepository userAccountRepository;
    private final PermissionEvaluationService permissionEvaluationService;
    private final ObjectMapper objectMapper;
    private final EmailNotificationService emailNotificationService;
    private final NotificationDispatchQueueRepository dispatchQueueRepository;

    public NotificationDispatcher(
            NotificationEventDefinitionRepository eventRepository,
            NotificationPolicyRepository policyRepository,
            NotificationTemplateVersionRepository templateVersionRepository,
            NotificationService notificationService,
            UserAccountRepository userAccountRepository,
            PermissionEvaluationService permissionEvaluationService,
            ObjectMapper objectMapper,
            EmailNotificationService emailNotificationService,
            NotificationDispatchQueueRepository dispatchQueueRepository
    ) {
        this.eventRepository = eventRepository;
        this.policyRepository = policyRepository;
        this.templateVersionRepository = templateVersionRepository;
        this.notificationService = notificationService;
        this.userAccountRepository = userAccountRepository;
        this.permissionEvaluationService = permissionEvaluationService;
        this.objectMapper = objectMapper;
        this.emailNotificationService = emailNotificationService;
        this.dispatchQueueRepository = dispatchQueueRepository;
    }

    /**
     * @param eventCode  stable code from notification_event_definitions (e.g.
     *                   "controlled_copy.recalled")
     * @param recipients already-resolved recipients for this specific occurrence
     * @param variables  values for the event's declared {{variables}} — must include
     *                   "recipientName" only if it varies per recipient; it is auto-filled
     *                   from each recipient's full name otherwise
     */
    @Transactional
    public void dispatch(String eventCode, List<UserAccount> recipients, Map<String, String> variables) {
        NotificationEventDefinition event = eventRepository.findByCode(eventCode).orElse(null);
        if (event == null || !event.isActive()) {
            logger.warn("Notification dispatch skipped: unknown or inactive event '{}'", eventCode);
            return;
        }
        NotificationPolicy policy = policyRepository.findByEventCode(eventCode).orElse(null);
        if (policy == null) {
            logger.warn("Notification dispatch skipped: no policy configured for event '{}'", eventCode);
            return;
        }
        boolean mandatory = event.isMandatory();
        if (!mandatory && NotificationPolicy.STATUS_DISABLED.equalsIgnoreCase(policy.getStatus())) {
            return;
        }

        List<UserAccount> resolvedRecipients = resolveRecipients(policy.getRecipientRules(), recipients);
        if (resolvedRecipients.isEmpty()) {
            logger.warn("Notification dispatch skipped: no recipients resolved for event '{}'", eventCode);
            return;
        }

        Set<String> channels = parseChannels(policy.getEnabledChannels());
        NotificationTemplateVersion inAppVersion = channels.contains(NotificationTemplateVersion.CHANNEL_IN_APP)
                ? activeVersion(policy.getId(), NotificationTemplateVersion.CHANNEL_IN_APP) : null;
        NotificationTemplateVersion emailVersion = channels.contains(NotificationTemplateVersion.CHANNEL_EMAIL)
                ? activeVersion(policy.getId(), NotificationTemplateVersion.CHANNEL_EMAIL) : null;

        String moduleKey = event.getModule();
        String priority = event.getPriority() == null ? "medium" : event.getPriority().toLowerCase(Locale.ROOT);

        for (UserAccount recipient : resolvedRecipients) {
            if (recipient == null || recipient.getId() == null) {
                continue;
            }
            Map<String, String> recipientVariables = withRecipientDefaults(variables, recipient);

            if (inAppVersion != null) {
                String title = render(inAppVersion.getTitle(), recipientVariables);
                String summary = render(inAppVersion.getSummary(), recipientVariables);
                String actionUrl = render(inAppVersion.getActionUrlTemplate(), recipientVariables);
                if (StringUtils.hasText(title)) {
                    notificationService.recordNotification(
                            recipient, null, "personal", moduleKey, event.getCode(),
                            title, summary, actionUrl, event.getDataObject(), null, null, null,
                            priority, objectMapper.valueToTree(recipientVariables), mandatory
                    );
                }
            }

            if (emailVersion != null && StringUtils.hasText(recipient.getEmail()) && recipient.isEmailNotificationsEnabled()
                    && (mandatory || NotificationPreferenceUtils.canReceiveEmailNotification(objectMapper, recipient, moduleKey))) {
                String subject = render(emailVersion.getSubject(), recipientVariables);
                String body = render(emailVersion.getBody(), recipientVariables);
                if (StringUtils.hasText(subject) && StringUtils.hasText(body)) {
                    // Mandatory GMP events always send immediately -- digest/quiet-hours exist to
                    // reduce noise for optional events, not to delay a compliance-required alert.
                    Instant deferredUntil = mandatory ? null : computeDeferredSendTime(policy);
                    if (deferredUntil != null) {
                        queueDeferredSend(policy, event.getCode(), recipient,
                                NotificationTemplateVersion.CHANNEL_EMAIL, subject, body, deferredUntil);
                    } else {
                        emailNotificationService.sendRenderedEmailWithTracking(
                                recipient.getEmail(), subject, body, event.getCode(), moduleKey, recipientVariables);
                    }
                }
            }
        }
    }

    private NotificationTemplateVersion activeVersion(java.util.UUID policyId, String channel) {
        return templateVersionRepository
                .findFirstByPolicy_IdAndChannelAndStatusOrderByVersionNumberDesc(policyId, channel, NotificationTemplateVersion.STATUS_ACTIVE)
                .orElse(null);
    }

    /**
     * Resolves the policy-owned portion of the audience. Contextual rules (for example OWNER
     * or RECIPIENT) intentionally use the recipients supplied by the business module, because
     * only that module knows the current document/copy/CAPA context. Static organisation rules
     * are resolved here so an Admin's policy configuration is never display-only.
     */
    /** Package-visible for {@link NotificationEscalationScheduler}, which resolves {@code
     * escalationRecipientRules} the same way (ALL_USERS/PERMISSION org-wide rules; escalation has
     * no per-occurrence contextual recipients, so it always passes an empty list here). */
    List<UserAccount> resolveRecipients(JsonNode rules, List<UserAccount> contextualRecipients) {
        java.util.LinkedHashMap<java.util.UUID, UserAccount> recipients = new java.util.LinkedHashMap<>();
        Set<String> types = new java.util.LinkedHashSet<>();
        Set<String> permissionAudienceCodes = new java.util.LinkedHashSet<>();
        if (rules != null && rules.isArray()) {
            for (JsonNode rule : rules) {
                String type = rule.path("type").asText("").trim().toUpperCase(Locale.ROOT);
                if (StringUtils.hasText(type)) {
                    types.add(type);
                    if ("PERMISSION".equals(type)) {
                        String permissionCode = rule.path("value").asText("").trim();
                        if (StringUtils.hasText(permissionCode)) permissionAudienceCodes.add(permissionCode);
                    }
                }
            }
        }

        boolean needsContextualRecipients = types.stream().anyMatch(type -> Set.of(
                "OWNER", "AUTHOR", "ASSIGNEE", "REVIEWER", "APPROVER", "RECIPIENT", "AFFECTED_USERS").contains(type));
        // AFFECTED_USERS is the one contextual type that is expected to be non-Active by the
        // time dispatch() runs -- e.g. "you have just been suspended/terminated" must still
        // reach the person it happened to, even though the status change (which may already be
        // applied in-memory by the caller) would otherwise fail the isActive() gate meant for
        // workflow participants (reviewer/approver/etc, who must currently be able to act).
        boolean allowInactiveAffectedUser = types.contains("AFFECTED_USERS");
        if (needsContextualRecipients && contextualRecipients != null) {
            for (UserAccount user : contextualRecipients) {
                if (user == null || user.getId() == null) continue;
                if (isActive(user) || allowInactiveAffectedUser) recipients.put(user.getId(), user);
            }
        }
        if (types.contains("ALL_USERS")) {
            for (UserAccount user : userAccountRepository.findAllByStatus(UserStatus.Active)) {
                recipients.put(user.getId(), user);
            }
        }
        if (!permissionAudienceCodes.isEmpty()) {
            for (UserAccount user : userAccountRepository.findAllByStatus(UserStatus.Active)) {
                if (permissionAudienceCodes.stream()
                        .anyMatch(permissionCode -> permissionEvaluationService.hasPermission(user, permissionCode))) {
                    recipients.put(user.getId(), user);
                }
            }
        }
        return new java.util.ArrayList<>(recipients.values());
    }

    private boolean isActive(UserAccount user) {
        return user != null && user.getId() != null && user.getStatus() == UserStatus.Active;
    }

    private Set<String> parseChannels(String channels) {
        if (!StringUtils.hasText(channels)) return Set.of();
        return new LinkedHashSet<>(Arrays.stream(channels.split(","))
                .map(String::trim).map(s -> s.toUpperCase(Locale.ROOT)).toList());
    }

    private Map<String, String> withRecipientDefaults(Map<String, String> variables, UserAccount recipient) {
        Map<String, String> merged = new java.util.LinkedHashMap<>(variables == null ? Map.of() : variables);
        merged.putIfAbsent("recipientName", StringUtils.hasText(recipient.getFullName()) ? recipient.getFullName() : recipient.getUsername());
        merged.putIfAbsent("systemName", "EQMS");
        return merged;
    }

    private String render(String template, Map<String, String> variables) {
        if (!StringUtils.hasText(template)) return template;
        Matcher matcher = VARIABLE_PATTERN.matcher(template);
        StringBuilder result = new StringBuilder();
        while (matcher.find()) {
            String value = variables.getOrDefault(matcher.group(1), "");
            matcher.appendReplacement(result, Matcher.quoteReplacement(value));
        }
        matcher.appendTail(result);
        return result.toString();
    }

    /**
     * Returns when a non-IN_APP send should actually go out, or {@code null} to send now.
     * DAILY_DIGEST/WEEKLY_DIGEST always defer (grouped and sent by {@link
     * NotificationDigestScheduler}); IMMEDIATE only defers if currently inside the policy's quiet
     * hours window, in which case it's deferred to the moment quiet hours end (not batched to the
     * next digest run -- quiet hours and digest are independent settings).
     */
    private Instant computeDeferredSendTime(NotificationPolicy policy) {
        ZonedDateTime now = ZonedDateTime.now(ZONE);
        String digestMode = policy.getDigestMode();
        if (NotificationPolicy.DIGEST_DAILY.equals(digestMode)) {
            return nextDailyTime(now).toInstant();
        }
        if (NotificationPolicy.DIGEST_WEEKLY.equals(digestMode)) {
            return nextWeeklyTime(now).toInstant();
        }
        if (isWithinQuietHours(policy, now)) {
            return nextQuietHoursEnd(policy, now).toInstant();
        }
        return null;
    }

    private ZonedDateTime nextDailyTime(ZonedDateTime now) {
        ZonedDateTime candidate = now.toLocalDate().atTime(DIGEST_HOUR_OF_DAY, 0).atZone(ZONE);
        return candidate.isAfter(now) ? candidate : candidate.plusDays(1);
    }

    private ZonedDateTime nextWeeklyTime(ZonedDateTime now) {
        ZonedDateTime candidate = now.toLocalDate().atTime(DIGEST_HOUR_OF_DAY, 0).atZone(ZONE);
        int daysUntilMonday = (DayOfWeek.MONDAY.getValue() - candidate.getDayOfWeek().getValue() + 7) % 7;
        candidate = candidate.plusDays(daysUntilMonday);
        return candidate.isAfter(now) ? candidate : candidate.plusDays(7);
    }

    private boolean isWithinQuietHours(NotificationPolicy policy, ZonedDateTime now) {
        LocalTime start = parseTime(policy.getQuietHoursStart());
        LocalTime end = parseTime(policy.getQuietHoursEnd());
        if (start == null || end == null || start.equals(end)) {
            return false;
        }
        LocalTime t = now.toLocalTime();
        if (start.isBefore(end)) {
            return !t.isBefore(start) && t.isBefore(end);
        }
        return !t.isBefore(start) || t.isBefore(end); // wraps past midnight
    }

    private ZonedDateTime nextQuietHoursEnd(NotificationPolicy policy, ZonedDateTime now) {
        LocalTime end = parseTime(policy.getQuietHoursEnd());
        ZonedDateTime candidate = now.toLocalDate().atTime(end).atZone(ZONE);
        return candidate.isAfter(now) ? candidate : candidate.plusDays(1);
    }

    private LocalTime parseTime(String hhmm) {
        if (!StringUtils.hasText(hhmm)) {
            return null;
        }
        try {
            return LocalTime.parse(hhmm.trim());
        } catch (Exception e) {
            return null;
        }
    }

    private void queueDeferredSend(
            NotificationPolicy policy, String eventCode, UserAccount recipient, String channel,
            String subject, String body, Instant scheduledFor
    ) {
        NotificationDispatchQueue queued = new NotificationDispatchQueue();
        queued.setPolicy(policy);
        queued.setEventCode(eventCode);
        queued.setRecipient(recipient);
        queued.setChannel(channel);
        queued.setRenderedSubject(subject);
        queued.setRenderedBody(body);
        queued.setScheduledFor(scheduledFor);
        dispatchQueueRepository.save(queued);
    }
}
