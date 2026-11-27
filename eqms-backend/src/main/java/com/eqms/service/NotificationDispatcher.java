package com.eqms.service;

import com.eqms.util.DateTimeFormatUtils;
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
import org.springframework.transaction.annotation.Propagation;
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
 * Every notification is always sent on every enabled channel: a recipient cannot opt out of one. Only the digest and quiet-hours
 * of the policy can delay an email.
 */
@Service
public class NotificationDispatcher {

    private static final Logger logger = LoggerFactory.getLogger(NotificationDispatcher.class);
    private static final Pattern VARIABLE_PATTERN = Pattern.compile("\\{\\{\\s*([a-zA-Z0-9_]+)\\s*\\}\\}");
    /** Fixed local time both DAILY_DIGEST and WEEKLY_DIGEST batch to -- simple and predictable;
     * not per-policy configurable in this phase. */
    private static final int DIGEST_HOUR_OF_DAY = 8;
    private static final ZoneId ZONE = DateTimeFormatUtils.ZONE;

    private final NotificationEventDefinitionRepository eventRepository;
    private final NotificationPolicyRepository policyRepository;
    private final NotificationTemplateVersionRepository templateVersionRepository;
    private final NotificationService notificationService;
    private final UserAccountRepository userAccountRepository;
    private final PermissionEvaluationService permissionEvaluationService;
    private final ObjectMapper objectMapper;
    private final NotificationDispatchQueueRepository dispatchQueueRepository;
    private final NotificationEmailOutbox emailOutbox;

    /** Only for the address of the button of an email; without it the mail simply has no button. */
    @org.springframework.beans.factory.annotation.Autowired(required = false)
    @org.springframework.context.annotation.Lazy
    private EmailNotificationService emailNotificationService;

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private EmailDesignService emailDesignService;

    /** Field injection on purpose: without it (as in the unit tests of the dispatcher) every recipient gets the English wording, as before. */
    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private NotificationTranslationService translations;

    public NotificationDispatcher(
            NotificationEventDefinitionRepository eventRepository,
            NotificationPolicyRepository policyRepository,
            NotificationTemplateVersionRepository templateVersionRepository,
            NotificationService notificationService,
            UserAccountRepository userAccountRepository,
            PermissionEvaluationService permissionEvaluationService,
            ObjectMapper objectMapper,
            NotificationEmailOutbox emailOutbox,
            NotificationDispatchQueueRepository dispatchQueueRepository
    ) {
        this.eventRepository = eventRepository;
        this.policyRepository = policyRepository;
        this.templateVersionRepository = templateVersionRepository;
        this.notificationService = notificationService;
        this.userAccountRepository = userAccountRepository;
        this.permissionEvaluationService = permissionEvaluationService;
        this.objectMapper = objectMapper;
        this.emailOutbox = emailOutbox;
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
    /**
     * The same dispatch in a transaction of its own. A caller whose own transaction may still be rolled back (a deferred database guard checks at commit) registers it to run after the commit,
     * when the outcome the message reports is certain; called from another bean, so that the proxy starts the new transaction.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public Outcome dispatchIndependently(String eventCode, List<UserAccount> recipients, Map<String, String> variables) {
        return dispatch(eventCode, recipients, variables, null, null);
    }

    /** The same, limited to some of the channels the policy has on. */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public Outcome dispatchIndependently(String eventCode, List<UserAccount> recipients, Map<String, String> variables, Set<String> onlyChannels) {
        return dispatch(eventCode, recipients, variables, onlyChannels, null);
    }

    /** A file that goes with the e-mail of a notice (the in-app notification has none). */
    public record MailFile(String name, byte[] content) {
    }

    /** The same, with a file attached to the e-mail. The e-mail of such a notice is sent at once: a digest or quiet hours do not hold a file back. */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public Outcome dispatchIndependently(String eventCode, List<UserAccount> recipients, Map<String, String> variables, MailFile file) {
        return dispatch(eventCode, recipients, variables, null, file);
    }

    /** The same, limited to some of the channels, with a file for the e-mail (the channels of one notice may then say different things: the in-app one is a notice only). */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public Outcome dispatchIndependently(String eventCode, List<UserAccount> recipients, Map<String, String> variables, Set<String> onlyChannels, MailFile file) {
        return dispatch(eventCode, recipients, variables, onlyChannels, file);
    }

    /**
     * What a dispatch did, for a caller that keeps its own log of the notices it sent: why nothing was sent ({@code blocked}: NOT_REGISTERED, POLICY_OFF or
     * NO_RECIPIENT), which channels the policy has on, and whether a notification was recorded or an e-mail queued for at least one recipient.
     */
    public record Outcome(String blocked, boolean inAppChannelOn, boolean emailChannelOn, boolean inAppSent, boolean emailSent) {
        static Outcome blocked(String reason) {
            return new Outcome(reason, false, false, false, false);
        }

        /** Why no in-app notification was recorded, or null when one was. */
        public String inAppReason() {
            return inAppSent ? null : blocked != null ? blocked : !inAppChannelOn ? "CHANNEL_OFF" : "NOT_SENT";
        }

        /** Why no e-mail was queued, or null when one was. */
        public String emailReason(boolean personHasAddress) {
            return emailSent ? null : blocked != null ? blocked : !emailChannelOn ? "CHANNEL_OFF" : !personHasAddress ? "NO_EMAIL_ADDRESS" : "NOT_SENT";
        }
    }

    /** What a notification is about, found from the values the sender gave: the record it opens, its number and its title, as the bell and the calendar show them. */
    record Related(String type, java.util.UUID id, String number, String title) {
    }

    static Related relatedOf(Map<String, String> variables, String fallbackType) {
        String type = firstText(variables, "relatedEntityType", "entityType");
        if (type == null) {
            type = firstText(variables, "controlledCopyNumber", "batchNumber") != null ? "controlled-copy" : fallbackType;
        }
        java.util.UUID id = null;
        String rawId = firstText(variables, "relatedEntityId", "documentId", "revisionId", "controlledCopyId");
        if (rawId != null) {
            try {
                id = java.util.UUID.fromString(rawId);
            } catch (IllegalArgumentException ignored) {
                // not a record id: the notification simply has none
            }
        }
        return new Related(type, id, firstText(variables, "documentNumber", "revisionNumber", "controlledCopyNumber", "batchNumber"),
                firstText(variables, "documentTitle", "revisionTitle", "controlledCopyTitle"));
    }

    private static String firstText(Map<String, String> values, String... keys) {
        if (values == null) return null;
        for (String key : keys) {
            String value = values.get(key);
            if (StringUtils.hasText(value)) return value.trim();
        }
        return null;
    }

    /** The values kept with an in-app notification are read by anyone who can open it: a password or a token written in the e-mail is not one of them. */
    static Map<String, String> withoutSecrets(Map<String, String> variables) {
        Map<String, String> kept = new java.util.LinkedHashMap<>();
        variables.forEach((name, value) -> {
            String key = name == null ? "" : name.toLowerCase(Locale.ROOT);
            if (!key.contains("password") && !key.contains("token") && !key.contains("secret")) kept.put(name, value);
        });
        return kept;
    }

    /** The variables of a notice whose title and text the module composes (the registry events that pass them through: {title}, {message}, {actionUrl}). */
    public static Map<String, String> noticeVariables(String title, String message, String actionUrl) {
        Map<String, String> variables = new java.util.LinkedHashMap<>();
        variables.put("title", title == null ? "" : com.eqms.util.DateTimeFormatUtils.normalizeText(title));
        variables.put("message", message == null ? "" : com.eqms.util.DateTimeFormatUtils.normalizeText(message));
        variables.put("actionUrl", actionUrl == null ? "" : actionUrl);
        return variables;
    }

    @Transactional
    public Outcome dispatch(String eventCode, List<UserAccount> recipients, Map<String, String> variables) {
        return dispatch(eventCode, recipients, variables, null, null);
    }

    private Outcome dispatch(String eventCode, List<UserAccount> recipients, Map<String, String> variables, Set<String> onlyChannels, MailFile file) {
        NotificationEventDefinition event = eventRepository.findByCode(eventCode).orElse(null);
        if (event == null || !event.isActive()) {
            logger.warn("Notification dispatch skipped: unknown or inactive event '{}'", eventCode);
            return Outcome.blocked("NOT_REGISTERED");
        }
        NotificationPolicy policy = policyRepository.findByEventCode(eventCode).orElse(null);
        if (policy == null) {
            logger.warn("Notification dispatch skipped: no policy configured for event '{}'", eventCode);
            return Outcome.blocked("NOT_REGISTERED");
        }
        // an account e-mail that carries a secret or that the person cannot do without is sent whatever the policy says (see NotificationMandatoryEvents)
        boolean mandatory = NotificationMandatoryEvents.isMandatory(eventCode);
        if (!mandatory && NotificationPolicy.STATUS_DISABLED.equalsIgnoreCase(policy.getStatus())) {
            return Outcome.blocked("POLICY_OFF");
        }

        List<UserAccount> resolvedRecipients = resolveRecipients(policy.getRecipientRules(), recipients);
        if (resolvedRecipients.isEmpty()) {
            logger.warn("Notification dispatch skipped: no recipients resolved for event '{}'", eventCode);
            return Outcome.blocked("NO_RECIPIENT");
        }

        // a recipient rule may name its own channels (the author by in-app and e-mail, the approvers by in-app only): the people of each channel are then
        // worked out on their own; without such a rule every recipient gets every channel the event sends on
        JsonNode policyRules = policy.getRecipientRules();
        boolean ruleChannels = NotificationRecipientRules.hasChannelRules(policyRules);
        Set<java.util.UUID> inAppPeople = ruleChannels ? idsOf(resolveRecipients(NotificationRecipientRules.forChannel(policyRules, NotificationTemplateVersion.CHANNEL_IN_APP), recipients)) : null;
        Set<java.util.UUID> emailPeople = ruleChannels ? idsOf(resolveRecipients(NotificationRecipientRules.forChannel(policyRules, NotificationTemplateVersion.CHANNEL_EMAIL), recipients)) : null;

        Set<String> channels = parseChannels(policy.getEnabledChannels());
        if (mandatory) {
            // e-mail only: a secret is never kept as an in-app notification
            channels = new LinkedHashSet<>(Set.of(NotificationTemplateVersion.CHANNEL_EMAIL));
        }
        if (onlyChannels != null) channels.retainAll(onlyChannels);
        NotificationTemplateVersion inAppVersion = channels.contains(NotificationTemplateVersion.CHANNEL_IN_APP)
                ? activeVersion(policy.getId(), NotificationTemplateVersion.CHANNEL_IN_APP) : null;
        NotificationTemplateVersion emailVersion = channels.contains(NotificationTemplateVersion.CHANNEL_EMAIL)
                ? activeVersion(policy.getId(), NotificationTemplateVersion.CHANNEL_EMAIL) : null;

        String moduleKey = event.getModule();
        // the priority an administrator chose for the notification, else the default of its event
        String priority = policy.effectivePriority(event).toLowerCase(Locale.ROOT);
        boolean inAppSent = false;
        boolean emailSent = false;

        for (UserAccount recipient : resolvedRecipients) {
            if (recipient == null || recipient.getId() == null) {
                continue;
            }
            Map<String, String> recipientVariables = withRecipientDefaults(variables, recipient);
            Related related = relatedOf(recipientVariables, event.getDataObject());
            // the wording of the recipient's language; the English version itself unless a usable translation of exactly that version exists
            NotificationTemplateVersion inAppWording = translations == null ? inAppVersion : translations.forRecipient(inAppVersion, recipient.getId());
            NotificationTemplateVersion emailWording = translations == null ? emailVersion : translations.forRecipient(emailVersion, recipient.getId());
            // a translated wording also gets the fixed words (action, status, kind) in Vietnamese; what is kept with the notification and where it opens do not change
            Map<String, String> inAppValues = inAppWording == inAppVersion ? recipientVariables : NotificationValueWords.vietnamese(recipientVariables);
            Map<String, String> emailValues = emailWording == emailVersion ? recipientVariables : NotificationValueWords.vietnamese(recipientVariables);

            if (inAppVersion != null && (inAppPeople == null || inAppPeople.contains(recipient.getId()))) {
                String title = render(inAppWording.getTitle(), inAppValues);
                String summary = render(inAppWording.getSummary(), inAppValues);
                String actionUrl = render(inAppWording.getActionUrlTemplate(), recipientVariables);
                if (StringUtils.hasText(title)) {
                    notificationService.recordNotification(
                            recipient, null, "personal", moduleKey, event.getCode(),
                            title, summary, actionUrl, related.type(), related.id(), related.number(), related.title(),
                            priority, objectMapper.valueToTree(withoutSecrets(recipientVariables))
                    );
                    inAppSent = true;
                }
            }

            if (emailVersion != null && (emailPeople == null || emailPeople.contains(recipient.getId())) && StringUtils.hasText(recipient.getEmail())) {
                String subject = render(emailWording.getSubject(), emailValues);
                String body = composeEmailBody(emailWording, inAppVersion, emailValues, emailWording != emailVersion);
                if (StringUtils.hasText(subject) && StringUtils.hasText(body)) {
                    // a mandatory e-mail goes out at once: a digest or quiet hours would delay a code and would keep the secret unencrypted in the dispatch queue
                    Instant deferredUntil = file == null && !mandatory ? computeDeferredSendTime(policy) : null;
                    if (deferredUntil != null) {
                        queueDeferredSend(policy, event.getCode(), recipient,
                                NotificationTemplateVersion.CHANNEL_EMAIL, subject, body, deferredUntil);
                    } else {
                        if (file == null) {
                            emailOutbox.enqueue(recipient.getEmail(), subject, body, event.getCode(), moduleKey, recipientVariables);
                        } else {
                            emailOutbox.enqueue(recipient.getEmail(), subject, body, event.getCode(), moduleKey, recipientVariables, file.name(), file.content());
                        }
                    }
                    emailSent = true;
                }
            }
        }
        return new Outcome(null, channels.contains(NotificationTemplateVersion.CHANNEL_IN_APP), channels.contains(NotificationTemplateVersion.CHANNEL_EMAIL), inAppSent, emailSent);
    }

    /**
     * The message of an email: the wording as paragraphs, then the action button (its words from the email, its address from the email or,
     * failing that, from the in-app notification). The shared frame is put around it when the mail is sent.
     */
    private String composeEmailBody(NotificationTemplateVersion emailVersion, NotificationTemplateVersion inAppVersion, Map<String, String> variables, boolean vietnamese) {
        // for the mail only: complete addresses, shown as words that can be pressed (a path cannot be opened from a mail and shows an internal identifier)
        Map<String, String> mail = com.eqms.util.EmailLinks.absolute(variables, emailNotificationService == null ? null : emailNotificationService.resolvePublicAppBaseUrl());
        String message = com.eqms.util.EmailLinks.friendly(EmailTemplateService.sanitizeRenderedHtml(render(emailVersion.getBody(), mail)), mail);
        String urlTemplate = StringUtils.hasText(emailVersion.getActionUrlTemplate()) ? emailVersion.getActionUrlTemplate()
                : inAppVersion == null ? null : inAppVersion.getActionUrlTemplate();
        String url = render(urlTemplate, variables);
        String html = com.eqms.util.EmailFrameRenderer.paragraphs(message);
        html = com.eqms.util.EmailFrameRenderer.withGreeting(html, variables.get("recipientName"), vietnamese);
        if (StringUtils.hasText(url) && emailNotificationService != null) {
            String absolute = url.startsWith("http://") || url.startsWith("https://") ? url
                    : emailNotificationService.resolvePublicAppBaseUrl() + (url.startsWith("/") ? url : "/" + url);
            String brand = emailDesignService == null ? null : emailDesignService.current().getButtonColor();
            html += com.eqms.util.EmailFrameRenderer.button(emailVersion.getActionLabel(), absolute, brand, vietnamese,
                    emailDesignService == null ? null : emailDesignService.current().getButtonSize(),
                    emailDesignService == null || emailDesignService.current().isShowButtonLink());
        }
        return vietnamese && StringUtils.hasText(html) ? com.eqms.util.EmailFrameRenderer.VIETNAMESE_MARK + html : html;
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
        Set<String> roleAudience = new java.util.LinkedHashSet<>();
        Set<String> departmentAudience = new java.util.LinkedHashSet<>();
        if (rules != null && rules.isArray()) {
            for (JsonNode rule : rules) {
                String type = rule.path("type").asText("").trim().toUpperCase(Locale.ROOT);
                if (StringUtils.hasText(type)) {
                    types.add(type);
                    String value = rule.path("value").asText("").trim();
                    if (StringUtils.hasText(value)) {
                        switch (type) {
                            case "PERMISSION" -> permissionAudienceCodes.add(value);
                            case "ROLE" -> roleAudience.add(value.toLowerCase(Locale.ROOT));
                            case "DEPARTMENT" -> departmentAudience.add(value.toLowerCase(Locale.ROOT));
                            default -> { }
                        }
                    }
                }
            }
        }

        boolean needsContextualRecipients = types.stream().anyMatch(NotificationRecipientRules::isContext);
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
        if (!roleAudience.isEmpty() || !departmentAudience.isEmpty()) {
            for (UserAccount user : userAccountRepository.findAllByStatus(UserStatus.Active)) {
                String role = user.getRoleName() == null ? "" : user.getRoleName().trim().toLowerCase(Locale.ROOT);
                String department = user.getDepartment() == null ? "" : user.getDepartment().trim().toLowerCase(Locale.ROOT);
                if (roleAudience.contains(role) || departmentAudience.contains(department)) {
                    recipients.put(user.getId(), user);
                }
            }
        }
        return new java.util.ArrayList<>(recipients.values());
    }

    private static Set<java.util.UUID> idsOf(List<UserAccount> users) {
        Set<java.util.UUID> ids = new java.util.HashSet<>();
        for (UserAccount user : users) {
            if (user != null && user.getId() != null) ids.add(user.getId());
        }
        return ids;
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

    /** Package-visible (not private) so {@link EmailNotificationService#retryDeliveryFailure} can
     *  reuse the exact same variable-substitution logic when manually re-sending a policy-driven
     *  (NotificationTemplateVersion-based) email from its durably-persisted variables, without
     *  duplicating this regex elsewhere. */
    String render(String template, Map<String, String> variables) {
        if (!StringUtils.hasText(template)) return template;
        Matcher matcher = VARIABLE_PATTERN.matcher(template);
        StringBuilder result = new StringBuilder();
        while (matcher.find()) {
            // getOrDefault returns null for a variable that is present with a null value (a field the event has no answer for); an empty text is written for it, as for a missing one,
            // instead of failing the whole action that raised the notification
            String value = variables.get(matcher.group(1));
            matcher.appendReplacement(result, Matcher.quoteReplacement(value == null ? "" : value));
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
