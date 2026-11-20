package com.eqms.service;

import com.eqms.auth.CurrentUserService;
import com.eqms.dto.audittrail.AuditTrailChangeResponse;
import com.eqms.dto.notification.NotificationPolicyDetailResponse;
import com.eqms.dto.notification.NotificationPolicySummaryResponse;
import com.eqms.dto.notification.NotificationPreviewRequest;
import com.eqms.dto.notification.NotificationPreviewResponse;
import com.eqms.dto.notification.NotificationTemplateVersionResponse;
import com.eqms.dto.notification.UpdateNotificationPolicyRequest;
import com.eqms.dto.notification.UpdateNotificationTemplateRequest;
import com.eqms.entity.NotificationEventDefinition;
import com.eqms.entity.NotificationPolicy;
import com.eqms.entity.NotificationTemplateVersion;
import com.eqms.entity.UserAccount;
import com.eqms.repository.NotificationEventDefinitionRepository;
import com.eqms.repository.NotificationPolicyRepository;
import com.eqms.repository.NotificationTemplateVersionRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Backs the Notifications Administration screens: event catalog -> policy (who/how/when) ->
 * template content (per channel, versioned) -> preview. Every notification is always sent: there is no mandatory or optional kind, and changing
 * a wording needs no electronic signature (only an administrator edits). Every change is written to the Audit Trail with the value before and after.
 */
@Service
public class NotificationPolicyService {

    private static final Pattern VARIABLE_PATTERN = Pattern.compile("\\{\\{\\s*([a-zA-Z0-9_]+)\\s*\\}\\}");
    private static final Pattern EVENT_CODE_PATTERN = Pattern.compile("^[a-z0-9_]+(\\.[a-z0-9_]+)+$");
    private static final Set<String> VALID_STATUSES = Set.of(
            NotificationPolicy.STATUS_ACTIVE, NotificationPolicy.STATUS_DRAFT, NotificationPolicy.STATUS_DISABLED);
    private static final Set<String> VALID_DIGEST_MODES = Set.of(
            NotificationPolicy.DIGEST_IMMEDIATE, NotificationPolicy.DIGEST_DAILY, NotificationPolicy.DIGEST_WEEKLY);
    private static final Set<String> VALID_PRIORITIES = Set.of(
            NotificationEventDefinition.PRIORITY_LOW, NotificationEventDefinition.PRIORITY_MEDIUM,
            NotificationEventDefinition.PRIORITY_HIGH, NotificationEventDefinition.PRIORITY_CRITICAL);
    private static final DateTimeFormatter TIME_FORMAT = DateTimeFormatter.ofPattern("HH:mm");

    private final NotificationEventDefinitionRepository eventRepository;
    private final NotificationPolicyRepository policyRepository;
    private final NotificationTemplateVersionRepository templateVersionRepository;
    private final CurrentUserService currentUserService;
    private final AuditTrailService auditTrailService;
    private final ObjectMapper objectMapper;

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private EmailDesignService emailDesignService;

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    @org.springframework.context.annotation.Lazy
    private EmailService emailService;

    public NotificationPolicyService(
            NotificationEventDefinitionRepository eventRepository,
            NotificationPolicyRepository policyRepository,
            NotificationTemplateVersionRepository templateVersionRepository,
            CurrentUserService currentUserService,
            AuditTrailService auditTrailService,
            ObjectMapper objectMapper
    ) {
        this.eventRepository = eventRepository;
        this.policyRepository = policyRepository;
        this.templateVersionRepository = templateVersionRepository;
        this.currentUserService = currentUserService;
        this.auditTrailService = auditTrailService;
        this.objectMapper = objectMapper;
    }

    @Transactional(readOnly = true)
    public com.eqms.dto.user.PageResponse<NotificationPolicySummaryResponse> list(
            String search, String module, String status, String channel,
            String sortBy, String sortDirection, int page, int limit
    ) {
        String query = StringUtils.hasText(search) ? search.trim().toLowerCase(Locale.ROOT) : null;
        List<NotificationPolicySummaryResponse> summaries = eventRepository.findAll().stream()
                .filter(e -> !StringUtils.hasText(module) || moduleKey(module).equals(moduleKey(e.getModule())))
                .map(event -> {
                    NotificationPolicy policy = policyRepository.findByEventCode(event.getCode()).orElse(null);
                    return toSummary(event, policy);
                })
                .filter(summary -> !StringUtils.hasText(status) || status.equalsIgnoreCase(summary.policyStatus()))
                .filter(summary -> matchesChannel(channel, summary.enabledChannels()))
                .filter(summary -> query == null
                        || summary.name().toLowerCase(Locale.ROOT).contains(query)
                        || summary.eventCode().toLowerCase(Locale.ROOT).contains(query)
                        || (summary.description() != null && summary.description().toLowerCase(Locale.ROOT).contains(query)))
                .sorted(summaryComparator(sortBy, sortDirection))
                .toList();
        return com.eqms.util.PagedList.paginate(summaries, page, limit);
    }

    /** Low, Medium, High: how important a notification is, for sorting and for the filter. */
    static int priorityRank(String priority) {
        return switch (priority == null ? "" : priority.trim().toUpperCase(Locale.ROOT)) {
            case NotificationEventDefinition.PRIORITY_LOW -> 1;
            case NotificationEventDefinition.PRIORITY_HIGH -> 3;
            case NotificationEventDefinition.PRIORITY_CRITICAL -> 4;
            default -> 2;
        };
    }

    /**
     * The priority an administrator asks for: LOW, MEDIUM or HIGH. CRITICAL is only the default of an event the catalog marks critical, so it can be kept
     * but not given to another notification. Null when no change is asked.
     */
    static String requestedPriority(String requested, NotificationEventDefinition event) {
        if (requested == null) return null;
        String value = requested.trim().toUpperCase(Locale.ROOT);
        boolean keepsCriticalDefault = NotificationEventDefinition.PRIORITY_CRITICAL.equals(value)
                && NotificationEventDefinition.PRIORITY_CRITICAL.equalsIgnoreCase(event.getPriority());
        if (!VALID_PRIORITIES.contains(value) || (NotificationEventDefinition.PRIORITY_CRITICAL.equals(value) && !keepsCriticalDefault)) {
            throw new IllegalArgumentException("Invalid priority: " + requested + ". Choose Low, Medium or High.");
        }
        return value;
    }

    /** EMAIL: the email is switched on. IN_APP_ONLY: it is not (whether or not the event has one). Anything else: no filter. */
    static boolean matchesChannel(String channel, String enabledChannels) {
        if (!StringUtils.hasText(channel)) return true;
        boolean email = Arrays.stream(enabledChannels == null ? new String[0] : enabledChannels.split(","))
                .anyMatch(c -> NotificationTemplateVersion.CHANNEL_EMAIL.equalsIgnoreCase(c.trim()));
        return switch (channel.trim().toUpperCase(Locale.ROOT)) {
            case "EMAIL" -> email;
            case "IN_APP_ONLY" -> !email;
            default -> true;
        };
    }

    private java.util.Comparator<NotificationPolicySummaryResponse> summaryComparator(String sortBy, String sortDirection) {
        java.util.Comparator<NotificationPolicySummaryResponse> comparator = switch (sortBy == null ? "" : sortBy) {
            case "priority" -> java.util.Comparator.comparingInt((NotificationPolicySummaryResponse s) -> priorityRank(s.priority()));
            case "updatedAt" -> java.util.Comparator.comparing(NotificationPolicySummaryResponse::updatedAt);
            case "name" -> java.util.Comparator.comparing(NotificationPolicySummaryResponse::name, String.CASE_INSENSITIVE_ORDER);
            default -> java.util.Comparator.comparing(NotificationPolicySummaryResponse::module, String.CASE_INSENSITIVE_ORDER);
        };
        return "desc".equalsIgnoreCase(sortDirection) ? comparator.reversed() : comparator;
    }

    @Transactional(readOnly = true)
    public NotificationPolicyDetailResponse getDetail(String eventCode) {
        NotificationEventDefinition event = requireEvent(eventCode);
        NotificationPolicy policy = requirePolicy(eventCode);
        // the wording of every channel the event supports, also of one that is switched off: it is kept, and the screen of that channel shows it so that it can be read and edited
        List<NotificationTemplateVersionResponse> templates = Arrays.stream(StringUtils.hasText(event.getSupportedChannels()) ? event.getSupportedChannels().split(",") : policy.getEnabledChannels().split(","))
                .map(String::trim)
                .filter(StringUtils::hasText)
                .map(channel -> templateVersionRepository
                        .findFirstByPolicy_IdAndChannelAndStatusOrderByVersionNumberDesc(
                                policy.getId(), channel, NotificationTemplateVersion.STATUS_ACTIVE)
                        .map(this::toVersionResponse)
                        .orElse(null))
                .filter(java.util.Objects::nonNull)
                .toList();
        return toDetail(event, policy, templates);
    }

    @Transactional
    public NotificationPolicyDetailResponse updatePolicy(String eventCode, UpdateNotificationPolicyRequest request) {
        UserAccount currentUser = currentUserService.requireCurrentUser();
        NotificationEventDefinition event = requireEvent(eventCode);
        NotificationPolicy policy = lockPolicy(eventCode);
        requireFresh(policy, request.expectedUpdatedAt());

        List<AuditTrailChangeResponse> changes = new ArrayList<>();

        if (request.status() != null && !VALID_STATUSES.contains(request.status().toUpperCase(Locale.ROOT))) {
            throw new IllegalArgumentException("Invalid status: " + request.status());
        }
        if (request.recipientRules() != null) {
            NotificationRecipientRules.validate(request.recipientRules());
        }
        if (request.escalationRecipientRules() != null && !request.escalationRecipientRules().isEmpty()) {
            NotificationRecipientRules.validate(request.escalationRecipientRules());
        }
        if (request.digestMode() != null && !VALID_DIGEST_MODES.contains(request.digestMode().toUpperCase(Locale.ROOT))) {
            throw new IllegalArgumentException("Invalid digest mode: " + request.digestMode());
        }
        String requestedPriority = requestedPriority(request.priority(), event);
        java.util.List<String> requestedChannels = null;
        if (request.enabledChannels() != null) {
            requestedChannels = request.enabledChannels().stream().filter(StringUtils::hasText).map(c -> c.trim().toUpperCase(Locale.ROOT)).distinct().toList();
            Set<String> supportedChannels = parseCsv(event.getSupportedChannels());
            if (requestedChannels.isEmpty()) {
                throw new IllegalArgumentException("A notification must be sent on at least one channel. To stop sending it, switch the notification off.");
            }
            for (String channel : requestedChannels) {
                if (!supportedChannels.contains(channel)) {
                    throw new IllegalArgumentException("This notification cannot be sent on the channel " + channel + ".");
                }
            }
        }

        String requestedQuietHoursStart = normalizeTimeValue(request.quietHoursStart());
        String requestedQuietHoursEnd = normalizeTimeValue(request.quietHoursEnd());
        String effectiveQuietHoursStart = request.quietHoursStart() == null ? policy.getQuietHoursStart() : requestedQuietHoursStart;
        String effectiveQuietHoursEnd = request.quietHoursEnd() == null ? policy.getQuietHoursEnd() : requestedQuietHoursEnd;
        validateQuietHours(effectiveQuietHoursStart, effectiveQuietHoursEnd);
        if (NotificationMandatoryEvents.isMandatory(eventCode)) {
            requireMandatoryStaysSent(request, requestedChannels, requestedQuietHoursStart, requestedQuietHoursEnd);
        }

        boolean effectiveEscalationEnabled = request.escalationEnabled() == null
                ? policy.isEscalationEnabled() : request.escalationEnabled();
        Integer effectiveEscalationAfterMinutes = request.escalationAfterMinutes() == null
                ? policy.getEscalationAfterMinutes() : request.escalationAfterMinutes();
        com.fasterxml.jackson.databind.JsonNode effectiveEscalationRecipients = request.escalationRecipientRules() == null
                ? policy.getEscalationRecipientRules() : request.escalationRecipientRules();
        validateEscalation(effectiveEscalationEnabled, effectiveEscalationAfterMinutes, effectiveEscalationRecipients);

        String effectiveStatus = request.status() == null ? policy.getStatus() : request.status();
        if (NotificationPolicy.STATUS_ACTIVE.equalsIgnoreCase(effectiveStatus)) {
            validateActivation(event, policy, request.recipientRules());
        }

        if (request.status() != null) {
            compareAndSet(changes, "Status", policy.getStatus(), request.status(), policy::setStatus);
        }
        if (request.recipientRules() != null) {
            String before = policy.getRecipientRules() == null ? "" : policy.getRecipientRules().toString();
            String after = request.recipientRules().toString();
            if (!before.equals(after)) {
                changes.add(new AuditTrailChangeResponse("Recipients", before, after));
                policy.setRecipientRules(request.recipientRules());
            }
        }
        if (requestedChannels != null) {
            String before = policy.getEnabledChannels() == null ? "" : policy.getEnabledChannels();
            String after = String.join(",", requestedChannels);
            if (!parseCsv(before).equals(new java.util.LinkedHashSet<>(requestedChannels))) {
                changes.add(new AuditTrailChangeResponse("Channels", before, after));
                policy.setEnabledChannels(after);
            }
            if (requestedChannels.contains(NotificationTemplateVersion.CHANNEL_EMAIL)) {
                ensureEmailWording(policy, currentUser, changes);
            }
        }
        if (request.priority() != null) {
            // stored only when it differs from the default of the event; the default puts the notification back (null)
            String stored = requestedPriority.equalsIgnoreCase(event.getPriority()) ? null : requestedPriority;
            String before = policy.effectivePriority(event);
            if (!java.util.Objects.equals(stored, policy.getPriority())) {
                policy.setPriority(stored);
                changes.add(new AuditTrailChangeResponse("Priority", before, requestedPriority));
            }
        }
        if (request.digestMode() != null) {
            compareAndSet(changes, "Digest Mode", policy.getDigestMode(), request.digestMode(), policy::setDigestMode);
        }
        if (request.quietHoursStart() != null) {
            compareAndSet(changes, "Quiet Hours Start", policy.getQuietHoursStart(), requestedQuietHoursStart, policy::setQuietHoursStart);
        }
        if (request.quietHoursEnd() != null) {
            compareAndSet(changes, "Quiet Hours End", policy.getQuietHoursEnd(), requestedQuietHoursEnd, policy::setQuietHoursEnd);
        }
        if (request.escalationEnabled() != null && request.escalationEnabled() != policy.isEscalationEnabled()) {
            changes.add(new AuditTrailChangeResponse("Escalation Enabled", String.valueOf(policy.isEscalationEnabled()), String.valueOf(request.escalationEnabled())));
            policy.setEscalationEnabled(request.escalationEnabled());
        }
        if (request.escalationAfterMinutes() != null && !request.escalationAfterMinutes().equals(policy.getEscalationAfterMinutes())) {
            changes.add(new AuditTrailChangeResponse("Escalation After (minutes)",
                    policy.getEscalationAfterMinutes() == null ? "" : String.valueOf(policy.getEscalationAfterMinutes()),
                    String.valueOf(request.escalationAfterMinutes())));
            policy.setEscalationAfterMinutes(request.escalationAfterMinutes());
        }
        if (request.escalationRecipientRules() != null) {
            String before = policy.getEscalationRecipientRules() == null ? "" : policy.getEscalationRecipientRules().toString();
            String after = request.escalationRecipientRules().toString();
            if (!before.equals(after)) {
                changes.add(new AuditTrailChangeResponse("Escalation Recipients", before, after));
                policy.setEscalationRecipientRules(request.escalationRecipientRules());
            }
        }

        if (request.escalationEnabled() != null && !request.escalationEnabled()) {
            if (policy.getEscalationAfterMinutes() != null) {
                changes.add(new AuditTrailChangeResponse("Escalation After (minutes)", String.valueOf(policy.getEscalationAfterMinutes()), ""));
                policy.setEscalationAfterMinutes(null);
            }
            if (policy.getEscalationRecipientRules() != null && !policy.getEscalationRecipientRules().isEmpty()) {
                changes.add(new AuditTrailChangeResponse("Escalation Recipients", policy.getEscalationRecipientRules().toString(), "[]"));
                policy.setEscalationRecipientRules(objectMapper.createArrayNode());
            }
        }

        if (!changes.isEmpty()) {
            policy.setUpdatedBy(currentUser);
            policy.setUpdatedAt(java.time.Instant.now());
            policyRepository.save(policy);
            auditTrailService.logAs(
                    currentUser, "NOTIFICATION_POLICY", event.getName(), policy.getId(),
                    "UPDATE", null, null, "Notification policy updated", changes
            );
        }

        return getDetail(eventCode);
    }

    /**
     * An account e-mail that carries a secret (a sign-in code, a reset link, a temporary password) or that the person cannot do without is always sent, at once,
     * by e-mail only: it cannot be switched off, moved to another channel, held by a digest or by quiet hours, or escalated. Who gets it and its wording can change.
     */
    private static void requireMandatoryStaysSent(UpdateNotificationPolicyRequest request, List<String> requestedChannels, String quietStart, String quietEnd) {
        String why = " It is an account e-mail that is always sent; only its wording and who gets it can be changed.";
        if (request.status() != null && !NotificationPolicy.STATUS_ACTIVE.equalsIgnoreCase(request.status())) {
            throw new IllegalArgumentException("This notification cannot be switched off." + why);
        }
        if (requestedChannels != null && !requestedChannels.equals(List.of(NotificationTemplateVersion.CHANNEL_EMAIL))) {
            throw new IllegalArgumentException("This notification is sent by e-mail only." + why);
        }
        if (request.digestMode() != null && !NotificationPolicy.DIGEST_IMMEDIATE.equalsIgnoreCase(request.digestMode())) {
            throw new IllegalArgumentException("This notification cannot be held back in a digest." + why);
        }
        if (StringUtils.hasText(quietStart) || StringUtils.hasText(quietEnd)) {
            throw new IllegalArgumentException("This notification cannot be held back by quiet hours." + why);
        }
        if (Boolean.TRUE.equals(request.escalationEnabled())) {
            throw new IllegalArgumentException("This notification cannot be escalated." + why);
        }
    }

    /**
     * The icon of an in-app notification is one icon of the Lucide or the Tabler library, written {@code lucide:BellRing} or {@code tabler:IconBell}
     * (the library and the name of its React component). The libraries live in the browser, so the server checks the form of the key, not the
     * list of names; a name that no longer exists draws the icon of the kind of notification instead. The colour of the icon is not chosen: it follows
     * the priority of the notification.
     */
    public static final Pattern ICON_KEY = Pattern.compile("^(lucide|tabler):[A-Za-z][A-Za-z0-9]{0,59}$");

    /** Chooses the icon of the in-app notification of an event; empty means the icon of its kind. The change is written to the Audit Trail with the value before and after. */
    public NotificationPolicyDetailResponse updateAppearance(String eventCode, String icon) {
        return updateAppearance(eventCode, icon, null);
    }

    @Transactional
    public NotificationPolicyDetailResponse updateAppearance(String eventCode, String icon, java.time.Instant expectedUpdatedAt) {
        UserAccount currentUser = currentUserService.requireCurrentUser();
        NotificationEventDefinition event = requireEvent(eventCode);
        NotificationPolicy policy = lockPolicy(eventCode);
        requireFresh(policy, expectedUpdatedAt);
        String newIcon = StringUtils.hasText(icon) ? icon.trim() : null;
        if (newIcon != null && !ICON_KEY.matcher(newIcon).matches()) {
            throw new IllegalArgumentException("The icon must be an icon of the Lucide or the Tabler library, written lucide:Name or tabler:Name");
        }
        List<AuditTrailChangeResponse> changes = new ArrayList<>();
        diffField(changes, "Icon", policy.getIcon() == null ? "" : policy.getIcon(), newIcon == null ? "" : newIcon);
        if (!changes.isEmpty()) {
            policy.setIcon(newIcon);
            policy.setUpdatedBy(currentUser);
            policy.setUpdatedAt(java.time.Instant.now());
            policyRepository.save(policy);
            auditTrailService.logAs(currentUser, "NOTIFICATION_POLICY", event.getName(), policy.getId(), "UPDATE_ICON", null, null,
                    "Notification icon changed", changes);
        }
        return getDetail(eventCode);
    }

    @Transactional
    public NotificationTemplateVersionResponse updateTemplate(String eventCode, String channel, UpdateNotificationTemplateRequest request) {
        UserAccount currentUser = currentUserService.requireCurrentUser();
        NotificationEventDefinition event = requireEvent(eventCode);
        NotificationPolicy policy = lockPolicy(eventCode);
        requireFresh(policy, request.expectedUpdatedAt());

        boolean inApp = NotificationTemplateVersion.CHANNEL_IN_APP.equalsIgnoreCase(channel);
        boolean email = NotificationTemplateVersion.CHANNEL_EMAIL.equalsIgnoreCase(channel);
        if (!inApp && !email) {
            throw new IllegalArgumentException("Only the in-app and the email wording of a notification can be edited.");
        }
        if (email && !parseCsv(event.getSupportedChannels()).contains(NotificationTemplateVersion.CHANNEL_EMAIL)) {
            throw new IllegalArgumentException("This notification has no email.");
        }
        if (inApp && NotificationPolicy.STATUS_ACTIVE.equalsIgnoreCase(policy.getStatus())
                && (!StringUtils.hasText(request.title()) || !StringUtils.hasText(request.summary()))) {
            throw new IllegalArgumentException("An active notification policy requires an in-app title and summary.");
        }
        if (email && (!StringUtils.hasText(request.subject()) || !StringUtils.hasText(request.body()))) {
            throw new IllegalArgumentException("An email needs a subject and a message.");
        }
        if (email && request.subject().length() > 255) {
            throw new IllegalArgumentException("The email subject must be 255 characters or fewer.");
        }
        if (inApp && StringUtils.hasText(request.title()) && request.title().length() > 255) {
            throw new IllegalArgumentException("The in-app title must be 255 characters or fewer.");
        }
        if (request.actionLabel() != null && request.actionLabel().length() > 80) {
            throw new IllegalArgumentException("The button label must be 80 characters or fewer.");
        }
        // the email message is HTML written in the editor: keep only what a mail may hold, so nothing that runs reaches a reader
        if (email) {
            request = new UpdateNotificationTemplateRequest(request.title(), request.summary(), request.subject(),
                    EmailTemplateService.sanitizeRenderedHtml(request.body()), request.actionUrlTemplate(), request.changeSummary(), request.actionLabel());
        }
        Set<String> allowedVariables = parseCsv(event.getAvailableVariables());
        validateVariables(allowedVariables, request.title());
        validateVariables(allowedVariables, request.summary());
        validateVariables(allowedVariables, request.subject());
        validateVariables(allowedVariables, request.body());
        validateVariables(allowedVariables, request.actionUrlTemplate());

        if (inApp) {
            if (StringUtils.hasText(request.summary()) && request.summary().length() > 500) {
                throw new IllegalArgumentException("In-app summary must be 500 characters or fewer — it is not the email body.");
            }
        }

        NotificationTemplateVersion current = templateVersionRepository
                .findFirstByPolicy_IdAndChannelAndStatusOrderByVersionNumberDesc(policy.getId(), channel, NotificationTemplateVersion.STATUS_ACTIVE)
                .orElse(null);

        List<AuditTrailChangeResponse> changes = new ArrayList<>();
        if (current != null) {
            diffField(changes, "Title", current.getTitle(), request.title());
            diffField(changes, "Summary", current.getSummary(), request.summary());
            diffField(changes, "Subject", current.getSubject(), request.subject());
            diffField(changes, "Body", current.getBody(), request.body());
            diffField(changes, "Action URL Template", current.getActionUrlTemplate(), request.actionUrlTemplate());
            diffField(changes, "Button label", current.getActionLabel(), request.actionLabel());
            current.setStatus(NotificationTemplateVersion.STATUS_ARCHIVED);
            templateVersionRepository.save(current);
        }

        int nextVersion = templateVersionRepository.countByPolicy_IdAndChannel(policy.getId(), channel) + 1;
        NotificationTemplateVersion version = new NotificationTemplateVersion();
        version.setPolicy(policy);
        version.setChannel(channel);
        version.setVersionNumber(nextVersion);
        version.setStatus(NotificationTemplateVersion.STATUS_ACTIVE);
        version.setTitle(request.title());
        version.setSummary(request.summary());
        version.setSubject(request.subject());
        version.setBody(request.body());
        version.setActionUrlTemplate(request.actionUrlTemplate());
        version.setActionLabel(request.actionLabel());
        version.setVariablesUsed(String.join(",", collectVariables(request)));
        version.setChangeSummary(request.changeSummary());
        version.setCreatedBy(currentUser);
        version = templateVersionRepository.save(version);
        // the notification as a whole was changed now: its "Updated" time moves, and anyone who opened it before is told when they save
        policy.setUpdatedBy(currentUser);
        policy.setUpdatedAt(java.time.Instant.now());
        policyRepository.save(policy);

        if (!changes.isEmpty() || current == null) {
            auditTrailService.logAs(
                    currentUser, "NOTIFICATION_POLICY", event.getName() + " (" + channel + ")", policy.getId(),
                    "UPDATE_CONTENT", null, null,
                    StringUtils.hasText(request.changeSummary()) ? request.changeSummary() : "Notification content updated",
                    changes
            );
        }

        return toVersionResponse(version);
    }

    @Transactional(readOnly = true)
    public List<NotificationTemplateVersionResponse> getHistory(String eventCode, String channel) {
        NotificationPolicy policy = requirePolicy(eventCode);
        return templateVersionRepository.findAllByPolicy_IdAndChannelOrderByVersionNumberDesc(policy.getId(), channel)
                .stream().map(this::toVersionResponse).toList();
    }

    @Transactional
    public NotificationTemplateVersionResponse restoreVersion(String eventCode, String channel, java.util.UUID versionId) {
        UserAccount currentUser = currentUserService.requireCurrentUser();
        NotificationEventDefinition event = requireEvent(eventCode);
        NotificationPolicy policy = requirePolicy(eventCode);
        NotificationTemplateVersion toRestore = templateVersionRepository.findById(versionId)
                .filter(v -> v.getPolicy().getId().equals(policy.getId()) && v.getChannel().equalsIgnoreCase(channel))
                .orElseThrow(() -> new EntityNotFoundException("Template version not found"));

        UpdateNotificationTemplateRequest request = new UpdateNotificationTemplateRequest(
                toRestore.getTitle(), toRestore.getSummary(), toRestore.getSubject(), toRestore.getBody(),
                toRestore.getActionUrlTemplate(), "Restored from version " + toRestore.getVersionNumber(),
                toRestore.getActionLabel()
        );
        NotificationTemplateVersionResponse restored = updateTemplate(eventCode, channel, request);
        auditTrailService.logAs(
                currentUser, "NOTIFICATION_POLICY", event.getName() + " (" + channel + ")", policy.getId(),
                "RESTORE_CONTENT", null, null,
                "Restored content from version " + toRestore.getVersionNumber(), List.of()
        );
        return restored;
    }

    @Transactional(readOnly = true)
    public NotificationPreviewResponse preview(String eventCode, NotificationPreviewRequest request) {
        NotificationEventDefinition event = requireEvent(eventCode);
        java.util.Map<String, String> sample = buildSampleData(event);
        String html = null;
        if (NotificationTemplateVersion.CHANNEL_EMAIL.equalsIgnoreCase(request.channel())) {
            // the mail as the reader gets it: the message as paragraphs, the button, all in the shared frame
            html = framedSample(request.body(), request.actionUrlTemplate(), request.actionLabel(), sample, true);
        }
        return new NotificationPreviewResponse(
                request.channel(),
                render(request.title(), sample),
                render(request.summary(), sample),
                render(request.subject(), sample),
                render(request.body(), sample),
                render(request.actionUrlTemplate(), sample),
                html
        );
    }

    /**
     * The placeholders an event offers (the ones its wording may use, and only those: anything else is refused when the wording is saved),
     * each with the token to copy and an example, so a person never has to guess a name.
     */
    @Transactional(readOnly = true)
    public List<com.eqms.dto.notification.NotificationVariableResponse> variables(String eventCode) {
        NotificationEventDefinition event = requireEvent(eventCode);
        java.util.Map<String, String> sample = buildSampleData(event);
        return parseCsv(event.getAvailableVariables()).stream()
                .map(name -> new com.eqms.dto.notification.NotificationVariableResponse(
                        name, "{{" + name + "}}", labelOf(name), sample.getOrDefault(name, "(example)")))
                .toList();
    }

    /** Every placeholder any event of the system offers, once each, with the example of what it becomes. */
    @Transactional(readOnly = true)
    public List<com.eqms.dto.notification.NotificationVariableResponse> allEventVariables() {
        java.util.Map<String, String> sample = buildSampleData(null);
        Set<String> names = new java.util.TreeSet<>(String.CASE_INSENSITIVE_ORDER);
        eventRepository.findAll().forEach(event -> names.addAll(parseCsv(event.getAvailableVariables())));
        return names.stream()
                .map(name -> new com.eqms.dto.notification.NotificationVariableResponse(
                        name, "{{" + name + "}}", labelOf(name),
                        sample.getOrDefault(name, java.util.Optional.ofNullable(NotificationPlaceholderCatalog.find(name)).map(NotificationPlaceholderCatalog.Entry::sample).orElse("(example)"))))
                .toList();
    }

    /** A module is written "DOCUMENT_CONTROL" by most events and "Document Control" by a few: the filter treats them as one. */
    static String moduleKey(String module) {
        return module == null ? "" : module.trim().toUpperCase(Locale.ROOT).replace(' ', '_');
    }

    /** The mail as the reader gets it, with example values: the message as paragraphs, the button, all in the shared frame. */
    private String framedSample(String body, String actionUrlTemplate, String actionLabel, java.util.Map<String, String> sample, boolean preview) {
        String message = EmailTemplateService.sanitizeRenderedHtml(render(body, sample));
        String url = render(actionUrlTemplate, sample);
        String absolute = !StringUtils.hasText(url) ? null
                : url.startsWith("http://") || url.startsWith("https://") ? url : "https://eqms.example.com" + (url.startsWith("/") ? url : "/" + url);
        String brand = emailDesignService == null ? null : emailDesignService.current().getButtonColor();
        String content = com.eqms.util.EmailFrameRenderer.paragraphs(message) + com.eqms.util.EmailFrameRenderer.button(actionLabel, absolute, brand);
        return emailDesignService == null ? com.eqms.util.EmailFrameRenderer.render(null, content, null, preview)
                : preview ? emailDesignService.framePreview(content) : emailDesignService.frame(content);
    }

    /**
     * Sends the PUBLISHED email of an event to one address, with example values, so a person sees the real mail in a real inbox before relying on
     * it. Nothing is recorded as a notification; the send is written to the Audit Trail.
     */
    @Transactional
    public void testSend(String eventCode, String to) {
        UserAccount currentUser = currentUserService.requireCurrentUser();
        NotificationEventDefinition event = requireEvent(eventCode);
        NotificationPolicy policy = requirePolicy(eventCode);
        if (!StringUtils.hasText(to) || !to.trim().matches("[^@\\s<>\"]+@[^@\\s<>\"]+\\.[^@\\s<>\"]+")) {
            throw new IllegalArgumentException("Write a valid e-mail address to send the test to.");
        }
        NotificationTemplateVersion email = templateVersionRepository
                .findFirstByPolicy_IdAndChannelAndStatusOrderByVersionNumberDesc(policy.getId(), NotificationTemplateVersion.CHANNEL_EMAIL, NotificationTemplateVersion.STATUS_ACTIVE)
                .orElseThrow(() -> new IllegalArgumentException("This notification has no published email to send."));
        NotificationTemplateVersion inApp = templateVersionRepository
                .findFirstByPolicy_IdAndChannelAndStatusOrderByVersionNumberDesc(policy.getId(), NotificationTemplateVersion.CHANNEL_IN_APP, NotificationTemplateVersion.STATUS_ACTIVE)
                .orElse(null);
        java.util.Map<String, String> sample = buildSampleData(event);
        String urlTemplate = StringUtils.hasText(email.getActionUrlTemplate()) ? email.getActionUrlTemplate() : inApp == null ? null : inApp.getActionUrlTemplate();
        String html = framedSample(email.getBody(), urlTemplate, email.getActionLabel(), sample, false);
        if (emailService == null) {
            throw new IllegalStateException("The email service is not available.");
        }
        boolean sent;
        try {
            sent = emailService.sendRenderedEmail(to.trim(), "[Test] " + render(email.getSubject(), sample), html);
        } catch (Exception e) {
            throw new IllegalStateException("The test email could not be sent: " + e.getMessage(), e);
        }
        if (!sent) {
            throw new IllegalStateException("The test email was not sent: email notifications are off or the SMTP settings are not complete.");
        }
        auditTrailService.logAs(currentUser, "NOTIFICATION_POLICY", event.getName() + " (EMAIL)", policy.getId(), "TEST_SEND", null, null,
                "A test email was sent to " + to.trim(), List.of());
    }

    /** "controlledCopyNumber" becomes "Controlled copy number". */
    static String variableLabel(String name) {
        if (name == null || name.isBlank()) return "";
        String spaced = name.replaceAll("([a-z0-9])([A-Z])", "$1 $2").toLowerCase(Locale.ROOT);
        return Character.toUpperCase(spaced.charAt(0)) + spaced.substring(1);
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    private NotificationEventDefinition requireEvent(String eventCode) {
        return eventRepository.findByCode(eventCode)
                .orElseThrow(() -> new EntityNotFoundException("Notification event not found: " + eventCode));
    }

    private NotificationPolicy lockPolicy(String eventCode) {
        return policyRepository.lockByEventCode(eventCode)
                .orElseThrow(() -> new EntityNotFoundException("Notification policy not found: " + eventCode));
    }

    /**
     * The person saw the notification as it was at {@code expectedUpdatedAt}. When another change was saved since (its "Updated" time moved), this one is refused: saving it would
     * silently overwrite the other person's work. The comparison is to the microsecond, which is what the database keeps.
     */
    static void requireFresh(NotificationPolicy policy, java.time.Instant expectedUpdatedAt) {
        if (expectedUpdatedAt == null || policy.getUpdatedAt() == null) return;
        if (!expectedUpdatedAt.truncatedTo(java.time.temporal.ChronoUnit.MICROS).equals(policy.getUpdatedAt().truncatedTo(java.time.temporal.ChronoUnit.MICROS))) {
            throw new IllegalStateException("This was changed by someone else after you opened it. Reload it to see their change, then make yours again.");
        }
    }

    private NotificationPolicy requirePolicy(String eventCode) {
        return policyRepository.findByEventCode(eventCode)
                .orElseThrow(() -> new EntityNotFoundException("Notification policy not found for event: " + eventCode));
    }

    private Set<String> normalizeChannels(String channels) {
        if (!StringUtils.hasText(channels)) return Set.of();
        return new LinkedHashSet<>(Arrays.stream(channels.split(",")).map(String::trim).map(s -> s.toUpperCase(Locale.ROOT)).toList());
    }

    private Set<String> parseCsv(String csv) {
        if (!StringUtils.hasText(csv)) return Set.of();
        return new LinkedHashSet<>(Arrays.stream(csv.split(",")).map(String::trim).filter(StringUtils::hasText).toList());
    }

    private void validateVariables(Set<String> allowed, String text) {
        if (!StringUtils.hasText(text)) return;
        Matcher matcher = VARIABLE_PATTERN.matcher(text);
        while (matcher.find()) {
            String variable = matcher.group(1);
            if (!allowed.contains(variable)) {
                throw new IllegalArgumentException("Variable {{" + variable + "}} is not declared for this event. Allowed: " + String.join(", ", allowed));
            }
        }
    }

    private Set<String> collectVariables(UpdateNotificationTemplateRequest request) {
        Set<String> found = new LinkedHashSet<>();
        for (String text : List.of(
                request.title() == null ? "" : request.title(),
                request.summary() == null ? "" : request.summary(),
                request.subject() == null ? "" : request.subject(),
                request.body() == null ? "" : request.body(),
                request.actionUrlTemplate() == null ? "" : request.actionUrlTemplate()
        )) {
            Matcher matcher = VARIABLE_PATTERN.matcher(text);
            while (matcher.find()) {
                found.add(matcher.group(1));
            }
        }
        return found;
    }

    private void diffField(List<AuditTrailChangeResponse> changes, String label, String before, String after) {
        String b = before == null ? "" : before;
        String a = after == null ? "" : after;
        if (!b.equals(a)) {
            changes.add(new AuditTrailChangeResponse(label, before, after));
        }
    }

    /**
     * An e-mail can only be sent when it has wording. When an administrator turns the e-mail on for a notification that never had one, it starts from the in-app
     * wording (the title as the subject, the message as the text, the address of the in-app notification as the button), which the administrator then edits.
     */
    private void ensureEmailWording(NotificationPolicy policy, UserAccount currentUser, List<AuditTrailChangeResponse> changes) {
        if (templateVersionRepository.findFirstByPolicy_IdAndChannelAndStatusOrderByVersionNumberDesc(
                policy.getId(), NotificationTemplateVersion.CHANNEL_EMAIL, NotificationTemplateVersion.STATUS_ACTIVE).isPresent()) {
            return;
        }
        NotificationTemplateVersion inApp = templateVersionRepository.findFirstByPolicy_IdAndChannelAndStatusOrderByVersionNumberDesc(
                policy.getId(), NotificationTemplateVersion.CHANNEL_IN_APP, NotificationTemplateVersion.STATUS_ACTIVE).orElse(null);
        NotificationTemplateVersion version = new NotificationTemplateVersion();
        version.setPolicy(policy);
        version.setChannel(NotificationTemplateVersion.CHANNEL_EMAIL);
        version.setVersionNumber(templateVersionRepository.countByPolicy_IdAndChannel(policy.getId(), NotificationTemplateVersion.CHANNEL_EMAIL) + 1);
        version.setStatus(NotificationTemplateVersion.STATUS_ACTIVE);
        String title = inApp == null || !StringUtils.hasText(inApp.getTitle()) ? "{{systemName}} notification" : inApp.getTitle();
        String summary = inApp == null || !StringUtils.hasText(inApp.getSummary()) ? "" : inApp.getSummary();
        version.setSubject("[EQMS] " + title);
        version.setBody("<p>" + EmailTemplateService.sanitizeRenderedHtml(summary) + "</p>");
        version.setActionUrlTemplate(inApp == null ? "{{actionUrl}}" : inApp.getActionUrlTemplate());
        version.setActionLabel("Open in EQMS");
        version.setVariablesUsed(String.join(",", collectVariables(new UpdateNotificationTemplateRequest(title, summary, version.getSubject(), version.getBody(), version.getActionUrlTemplate(), null, null))));
        version.setChangeSummary("Started from the in-app wording when the e-mail was turned on");
        version.setCreatedBy(currentUser);
        templateVersionRepository.save(version);
        changes.add(new AuditTrailChangeResponse("Email wording", "", "Started from the in-app wording"));
    }

    private void compareAndSet(List<AuditTrailChangeResponse> changes, String label, String before, String after, java.util.function.Consumer<String> setter) {
        if (!java.util.Objects.equals(before, after)) {
            changes.add(new AuditTrailChangeResponse(label, before, after));
            setter.accept(after);
        }
    }

    private String normalizeTimeValue(String value) {
        if (!StringUtils.hasText(value)) return null;
        try {
            return LocalTime.parse(value, TIME_FORMAT).format(TIME_FORMAT);
        } catch (DateTimeParseException ex) {
            throw new IllegalArgumentException("Quiet hours must use the HH:mm format.");
        }
    }

    private void validateQuietHours(String start, String end) {
        if (StringUtils.hasText(start) != StringUtils.hasText(end)) {
            throw new IllegalArgumentException("Provide both a quiet-hours start and end time, or clear both values.");
        }
        if (StringUtils.hasText(start) && start.equals(end)) {
            throw new IllegalArgumentException("Quiet-hours start and end must be different.");
        }
    }

    private void validateEscalation(boolean enabled, Integer afterMinutes, com.fasterxml.jackson.databind.JsonNode recipients) {
        if (!enabled) return;
        if (afterMinutes == null || afterMinutes < 1) {
            throw new IllegalArgumentException("Escalation requires a delay of at least one minute.");
        }
        if (recipients == null || !recipients.isArray() || recipients.isEmpty()) {
            throw new IllegalArgumentException("Escalation requires at least one recipient rule.");
        }
    }

    private void validateActivation(NotificationEventDefinition event, NotificationPolicy policy, com.fasterxml.jackson.databind.JsonNode requestedRecipients) {
        com.fasterxml.jackson.databind.JsonNode recipients = requestedRecipients == null ? policy.getRecipientRules() : requestedRecipients;
        if (recipients == null || !recipients.isArray() || recipients.isEmpty()) {
            throw new IllegalArgumentException("An active notification policy requires at least one recipient rule.");
        }
        // an e-mail-only notification (an account e-mail that carries a secret) has no in-app wording: its e-mail wording is what must exist
        if (!parseCsv(event.getSupportedChannels()).contains(NotificationTemplateVersion.CHANNEL_IN_APP)) {
            NotificationTemplateVersion mail = templateVersionRepository
                    .findFirstByPolicy_IdAndChannelAndStatusOrderByVersionNumberDesc(
                            policy.getId(), NotificationTemplateVersion.CHANNEL_EMAIL, NotificationTemplateVersion.STATUS_ACTIVE)
                    .orElse(null);
            if (mail == null || !StringUtils.hasText(mail.getSubject()) || !StringUtils.hasText(mail.getBody())) {
                throw new IllegalArgumentException("An active notification policy requires an e-mail subject and message.");
            }
            return;
        }
        NotificationTemplateVersion template = templateVersionRepository
                .findFirstByPolicy_IdAndChannelAndStatusOrderByVersionNumberDesc(
                        policy.getId(), NotificationTemplateVersion.CHANNEL_IN_APP, NotificationTemplateVersion.STATUS_ACTIVE)
                .orElse(null);
        if (template == null || !StringUtils.hasText(template.getTitle()) || !StringUtils.hasText(template.getSummary())) {
            throw new IllegalArgumentException("An active notification policy requires an in-app title and summary.");
        }
    }

    private java.util.Map<String, String> buildSampleData(NotificationEventDefinition event) {
        java.util.Map<String, String> sample = new java.util.HashMap<>();
        sample.put("recipientName", "Nguyen Van A");
        sample.put("documentNumber", "SOP.0001");
        sample.put("documentTitle", "Sample Document Title");
        sample.put("revisionNumber", "02");
        sample.put("actionUrl", "https://eqms.example.com/documents/sample");
        sample.put("systemName", "EQMS");
        sample.put("controlledCopyNumber", "CC-0001");
        sample.put("expiryDateDisplay", "31/12/2026");
        sample.put("recallReason", "Obsoleted when a newer revision was published");
        sample.put("dueDate", "31/12/2026");
        sample.put("campaignName", "Q3 Audit Trail Review");
        // every other placeholder the event offers takes the example of the catalogue of placeholders; the words a module composes (title, message) take the event's own
        if (event != null) {
            for (String name : parseCsv(event.getAvailableVariables())) {
                var entry = NotificationPlaceholderCatalog.find(name);
                if (entry != null) sample.putIfAbsent(name, entry.sample());
            }
            if (parseCsv(event.getAvailableVariables()).contains("title")) {
                sample.put("title", event.getName());
                sample.put("message", "Nguyen Van A - Sample record: what happened, and what to do.");
            }
        }
        return sample;
    }

    /** The label of a placeholder: the catalogue's, else its name in words. */
    static String labelOf(String name) {
        var entry = NotificationPlaceholderCatalog.find(name);
        return entry != null ? entry.label() : variableLabel(name);
    }

    private String render(String template, java.util.Map<String, String> variables) {
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

    private NotificationPolicySummaryResponse toSummary(NotificationEventDefinition event, NotificationPolicy policy) {
        return new NotificationPolicySummaryResponse(
                event.getCode(), event.getName(), event.getDescription(), event.getModule(),
                policy == null ? event.getPriority() : policy.effectivePriority(event), event.getSupportedChannels(),
                policy == null ? NotificationPolicy.STATUS_DRAFT : policy.getStatus(),
                policy == null ? "" : policy.getEnabledChannels(),
                policy != null && policy.isEscalationEnabled(),
                policy == null ? event.getUpdatedAt() : policy.getUpdatedAt()
        );
    }

    private NotificationPolicyDetailResponse toDetail(NotificationEventDefinition event, NotificationPolicy policy, List<NotificationTemplateVersionResponse> templates) {
        return new NotificationPolicyDetailResponse(
                event.getCode(), event.getName(), event.getDescription(), event.getModule(),
                policy.effectivePriority(event), event.getRelatedAction(), event.getDataObject(),
                event.getSupportedChannels(), event.getAvailableVariables(),
                policy.getStatus(), policy.getEnabledChannels(), policy.getRecipientRules(), policy.getDigestMode(),
                policy.getQuietHoursStart(), policy.getQuietHoursEnd(), policy.isEscalationEnabled(), policy.getEscalationAfterMinutes(),
                policy.getEscalationRecipientRules(),
                policy.getUpdatedBy() == null ? null : policy.getUpdatedBy().getFullName(),
                policy.getUpdatedAt(), templates, policy.getIcon(), event.getPriority()
        );
    }

    private NotificationTemplateVersionResponse toVersionResponse(NotificationTemplateVersion version) {
        return new NotificationTemplateVersionResponse(
                version.getId().toString(), version.getChannel(), version.getVersionNumber(), version.getStatus(),
                version.getTitle(), version.getSummary(), version.getSubject(), version.getBody(),
                version.getActionUrlTemplate(), version.getActionLabel(), version.getVariablesUsed(), version.getChangeSummary(),
                version.getCreatedBy() == null ? null : version.getCreatedBy().getFullName(),
                version.getCreatedAt()
        );
    }
}
