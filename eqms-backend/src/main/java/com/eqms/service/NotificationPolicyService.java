package com.eqms.service;

import com.eqms.auth.CurrentUserService;
import com.eqms.dto.audittrail.AuditTrailChangeResponse;
import com.eqms.dto.notification.CreateNotificationEventRequest;
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
 * Backs the redesigned Notification Policy screen: event catalog -> policy (who/how/when) ->
 * template content (per channel, versioned) -> preview. Mandatory GMP events are locked here
 * (not just in the UI) — status/channels/recipients cannot be changed via {@link
 * #updatePolicy}, matching {@code mandatoryReason} shown to the Admin.
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
    private static final Set<String> VALID_COMPLIANCE_GROUPS = Set.of(
            NotificationEventDefinition.COMPLIANCE_GMP_MANDATORY, NotificationEventDefinition.COMPLIANCE_COMPLIANCE,
            NotificationEventDefinition.COMPLIANCE_OPTIONAL);
    private static final DateTimeFormatter TIME_FORMAT = DateTimeFormatter.ofPattern("HH:mm");

    private final NotificationEventDefinitionRepository eventRepository;
    private final NotificationPolicyRepository policyRepository;
    private final NotificationTemplateVersionRepository templateVersionRepository;
    private final CurrentUserService currentUserService;
    private final AuditTrailService auditTrailService;
    private final ObjectMapper objectMapper;

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
            String search, String module, String complianceGroup, String status,
            String sortBy, String sortDirection, int page, int limit
    ) {
        String query = StringUtils.hasText(search) ? search.trim().toLowerCase(Locale.ROOT) : null;
        List<NotificationPolicySummaryResponse> summaries = eventRepository.findAll().stream()
                .filter(e -> !StringUtils.hasText(module) || module.equalsIgnoreCase(e.getModule()))
                .filter(e -> !StringUtils.hasText(complianceGroup) || complianceGroup.equalsIgnoreCase(e.getComplianceGroup()))
                .map(event -> {
                    NotificationPolicy policy = policyRepository.findByEventCode(event.getCode()).orElse(null);
                    return toSummary(event, policy);
                })
                .filter(summary -> !StringUtils.hasText(status) || status.equalsIgnoreCase(summary.policyStatus()))
                .filter(summary -> query == null
                        || summary.name().toLowerCase(Locale.ROOT).contains(query)
                        || summary.eventCode().toLowerCase(Locale.ROOT).contains(query)
                        || (summary.description() != null && summary.description().toLowerCase(Locale.ROOT).contains(query)))
                .sorted(summaryComparator(sortBy, sortDirection))
                .toList();
        return com.eqms.util.PagedList.paginate(summaries, page, limit);
    }

    private java.util.Comparator<NotificationPolicySummaryResponse> summaryComparator(String sortBy, String sortDirection) {
        java.util.Comparator<NotificationPolicySummaryResponse> comparator = switch (sortBy == null ? "" : sortBy) {
            case "priority" -> java.util.Comparator.comparing(NotificationPolicySummaryResponse::priority, String.CASE_INSENSITIVE_ORDER);
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
        List<NotificationTemplateVersionResponse> templates = Arrays.stream(policy.getEnabledChannels().split(","))
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
        NotificationPolicy policy = requirePolicy(eventCode);

        List<AuditTrailChangeResponse> changes = new ArrayList<>();

        if (request.status() != null && !VALID_STATUSES.contains(request.status().toUpperCase(Locale.ROOT))) {
            throw new IllegalArgumentException("Invalid status: " + request.status());
        }
        if (request.digestMode() != null && !VALID_DIGEST_MODES.contains(request.digestMode().toUpperCase(Locale.ROOT))) {
            throw new IllegalArgumentException("Invalid digest mode: " + request.digestMode());
        }

        String requestedQuietHoursStart = normalizeTimeValue(request.quietHoursStart());
        String requestedQuietHoursEnd = normalizeTimeValue(request.quietHoursEnd());
        String effectiveQuietHoursStart = request.quietHoursStart() == null ? policy.getQuietHoursStart() : requestedQuietHoursStart;
        String effectiveQuietHoursEnd = request.quietHoursEnd() == null ? policy.getQuietHoursEnd() : requestedQuietHoursEnd;
        validateQuietHours(effectiveQuietHoursStart, effectiveQuietHoursEnd);

        boolean effectiveEscalationEnabled = request.escalationEnabled() == null
                ? policy.isEscalationEnabled() : request.escalationEnabled();
        Integer effectiveEscalationAfterMinutes = request.escalationAfterMinutes() == null
                ? policy.getEscalationAfterMinutes() : request.escalationAfterMinutes();
        com.fasterxml.jackson.databind.JsonNode effectiveEscalationRecipients = request.escalationRecipientRules() == null
                ? policy.getEscalationRecipientRules() : request.escalationRecipientRules();
        validateEscalation(effectiveEscalationEnabled, effectiveEscalationAfterMinutes, effectiveEscalationRecipients);

        if (event.isMandatory()) {
            if (request.status() != null && !NotificationPolicy.STATUS_ACTIVE.equalsIgnoreCase(request.status())) {
                throw new IllegalArgumentException("This event is GMP-mandatory and cannot be disabled: " + event.getMandatoryReason());
            }
            if (request.recipientRules() != null && !request.recipientRules().equals(policy.getRecipientRules())) {
                throw new IllegalArgumentException("This event's required recipients are locked by GMP policy: " + event.getMandatoryReason());
            }
            if (request.digestMode() != null && !NotificationPolicy.DIGEST_IMMEDIATE.equalsIgnoreCase(request.digestMode())) {
                throw new IllegalArgumentException("GMP-mandatory notifications are delivered immediately and cannot be added to a digest.");
            }
            if (request.quietHoursStart() != null || request.quietHoursEnd() != null) {
                throw new IllegalArgumentException("GMP-mandatory notifications cannot be delayed by quiet hours.");
            }
        }

        String effectiveStatus = request.status() == null ? policy.getStatus() : request.status();
        if (NotificationPolicy.STATUS_ACTIVE.equalsIgnoreCase(effectiveStatus)) {
            validateActivation(policy, request.recipientRules());
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

    @Transactional
    public NotificationPolicySummaryResponse createEvent(CreateNotificationEventRequest request) {
        UserAccount currentUser = currentUserService.requireCurrentUser();
        if (!StringUtils.hasText(request.code()) || !StringUtils.hasText(request.name()) || !StringUtils.hasText(request.module())) {
            throw new IllegalArgumentException("Event code, name and module are required.");
        }
        String code = request.code().trim().toLowerCase(Locale.ROOT);
        if (!EVENT_CODE_PATTERN.matcher(code).matches()) {
            throw new IllegalArgumentException("Event code must look like 'module.action' using lowercase letters, digits, underscores and at least one dot (e.g. document.custom_review).");
        }
        if (eventRepository.existsByCode(code)) {
            throw new IllegalArgumentException("An event with code '" + code + "' already exists.");
        }
        String priority = StringUtils.hasText(request.priority()) ? request.priority().toUpperCase(Locale.ROOT) : NotificationEventDefinition.PRIORITY_MEDIUM;
        if (!VALID_PRIORITIES.contains(priority)) {
            throw new IllegalArgumentException("Invalid priority: " + request.priority());
        }
        String complianceGroup = StringUtils.hasText(request.complianceGroup()) ? request.complianceGroup().toUpperCase(Locale.ROOT) : NotificationEventDefinition.COMPLIANCE_OPTIONAL;
        if (!VALID_COMPLIANCE_GROUPS.contains(complianceGroup)) {
            throw new IllegalArgumentException("Invalid compliance group: " + request.complianceGroup());
        }
        if (request.mandatory() && !StringUtils.hasText(request.mandatoryReason())) {
            throw new IllegalArgumentException("A GMP-mandatory event requires a documented reason.");
        }
        validateVariables(parseCsv(request.availableVariables()), request.actionUrlTemplate());
        NotificationEventDefinition event = new NotificationEventDefinition();
        event.setCode(code);
        event.setName(request.name());
        event.setDescription(request.description());
        event.setModule(request.module());
        event.setPriority(priority);
        event.setComplianceGroup(complianceGroup);
        event.setRelatedAction(request.relatedAction());
        event.setDataObject(request.dataObject());
        event.setSupportedChannels(NotificationTemplateVersion.CHANNEL_IN_APP);
        event.setAvailableVariables(request.availableVariables());
        event.setMandatory(request.mandatory());
        event.setMandatoryReason(request.mandatory() ? request.mandatoryReason() : null);
        event.setActive(true);
        event.setDisplayOrder((int) (eventRepository.count() + 1) * 10);
        event = eventRepository.save(event);

        NotificationPolicy policy = new NotificationPolicy();
        policy.setEventCode(event.getCode());
        policy.setStatus(NotificationPolicy.STATUS_DRAFT);
        policy.setEnabledChannels(NotificationTemplateVersion.CHANNEL_IN_APP);
        policy.setRecipientRules(objectMapper.createArrayNode());
        policy.setDigestMode(NotificationPolicy.DIGEST_IMMEDIATE);
        policy.setEscalationEnabled(false);
        policy.setEscalationRecipientRules(objectMapper.createArrayNode());
        policy = policyRepository.save(policy);

        NotificationTemplateVersion version = new NotificationTemplateVersion();
        version.setPolicy(policy);
        version.setChannel(NotificationTemplateVersion.CHANNEL_IN_APP);
        version.setVersionNumber(1);
        version.setStatus(NotificationTemplateVersion.STATUS_ACTIVE);
        version.setActionUrlTemplate(StringUtils.hasText(request.actionUrlTemplate()) ? request.actionUrlTemplate() : "{{actionUrl}}");
        version.setVariablesUsed(request.availableVariables());
        version.setChangeSummary("Event created");
        version.setCreatedBy(currentUser);
        templateVersionRepository.save(version);

        auditTrailService.logAs(
                currentUser, "NOTIFICATION_POLICY", event.getName(), policy.getId(),
                "CREATE", null, null, "Notification event created", List.of(
                        new AuditTrailChangeResponse("Event Code", null, event.getCode()),
                        new AuditTrailChangeResponse("Module", null, event.getModule()),
                        new AuditTrailChangeResponse("Priority", null, event.getPriority()),
                        new AuditTrailChangeResponse("Compliance Group", null, event.getComplianceGroup()),
                        new AuditTrailChangeResponse("Mandatory", null, String.valueOf(event.isMandatory())),
                        new AuditTrailChangeResponse("Mandatory Reason", null, event.getMandatoryReason()),
                        new AuditTrailChangeResponse("Policy Status", null, policy.getStatus())
                )
        );

        return toSummary(event, policy);
    }

    @Transactional
    public void deleteEvent(String eventCode) {
        UserAccount currentUser = currentUserService.requireCurrentUser();
        NotificationEventDefinition event = requireEvent(eventCode);
        if (event.isMandatory()) {
            throw new IllegalArgumentException("This event is GMP-mandatory and cannot be deleted: " + event.getMandatoryReason());
        }
        auditTrailService.logAs(
                currentUser, "NOTIFICATION_POLICY", event.getName(), event.getId(),
                "DELETE", null, null, "Notification event deleted", List.of()
        );
        eventRepository.delete(event);
    }

    @Transactional
    public NotificationTemplateVersionResponse updateTemplate(String eventCode, String channel, UpdateNotificationTemplateRequest request) {
        UserAccount currentUser = currentUserService.requireCurrentUser();
        NotificationEventDefinition event = requireEvent(eventCode);
        NotificationPolicy policy = requirePolicy(eventCode);

        if (!NotificationTemplateVersion.CHANNEL_IN_APP.equalsIgnoreCase(channel)) {
            throw new IllegalArgumentException("This feature only configures in-app/webapp notification content.");
        }
        if (NotificationPolicy.STATUS_ACTIVE.equalsIgnoreCase(policy.getStatus())
                && (!StringUtils.hasText(request.title()) || !StringUtils.hasText(request.summary()))) {
            throw new IllegalArgumentException("An active notification policy requires an in-app title and summary.");
        }

        Set<String> allowedVariables = parseCsv(event.getAvailableVariables());
        validateVariables(allowedVariables, request.title());
        validateVariables(allowedVariables, request.summary());
        validateVariables(allowedVariables, request.subject());
        validateVariables(allowedVariables, request.body());
        validateVariables(allowedVariables, request.actionUrlTemplate());

        if (NotificationTemplateVersion.CHANNEL_IN_APP.equalsIgnoreCase(channel)) {
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
        version.setVariablesUsed(String.join(",", collectVariables(request)));
        version.setChangeSummary(request.changeSummary());
        version.setCreatedBy(currentUser);
        version = templateVersionRepository.save(version);

        if (!changes.isEmpty()) {
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
                toRestore.getActionUrlTemplate(), "Restored from version " + toRestore.getVersionNumber()
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
        return new NotificationPreviewResponse(
                request.channel(),
                render(request.title(), sample),
                render(request.summary(), sample),
                render(request.subject(), sample),
                render(request.body(), sample),
                render(request.actionUrlTemplate(), sample)
        );
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    private NotificationEventDefinition requireEvent(String eventCode) {
        return eventRepository.findByCode(eventCode)
                .orElseThrow(() -> new EntityNotFoundException("Notification event not found: " + eventCode));
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

    private void validateActivation(NotificationPolicy policy, com.fasterxml.jackson.databind.JsonNode requestedRecipients) {
        com.fasterxml.jackson.databind.JsonNode recipients = requestedRecipients == null ? policy.getRecipientRules() : requestedRecipients;
        if (recipients == null || !recipients.isArray() || recipients.isEmpty()) {
            throw new IllegalArgumentException("An active notification policy requires at least one recipient rule.");
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
        return sample;
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
                event.getPriority(), event.getComplianceGroup(), event.isMandatory(), event.getSupportedChannels(),
                policy == null ? NotificationPolicy.STATUS_DRAFT : policy.getStatus(),
                policy == null ? "" : policy.getEnabledChannels(),
                policy != null && policy.isEscalationEnabled(),
                policy == null ? event.getUpdatedAt() : policy.getUpdatedAt()
        );
    }

    private NotificationPolicyDetailResponse toDetail(NotificationEventDefinition event, NotificationPolicy policy, List<NotificationTemplateVersionResponse> templates) {
        return new NotificationPolicyDetailResponse(
                event.getCode(), event.getName(), event.getDescription(), event.getModule(),
                event.getPriority(), event.getComplianceGroup(), event.getRelatedAction(), event.getDataObject(),
                event.getSupportedChannels(), event.getAvailableVariables(), event.isMandatory(), event.getMandatoryReason(),
                policy.getStatus(), policy.getEnabledChannels(), policy.getRecipientRules(), policy.getDigestMode(),
                policy.getQuietHoursStart(), policy.getQuietHoursEnd(), policy.isEscalationEnabled(), policy.getEscalationAfterMinutes(),
                policy.getEscalationRecipientRules(),
                policy.getUpdatedBy() == null ? null : policy.getUpdatedBy().getFullName(),
                policy.getUpdatedAt(), templates
        );
    }

    private NotificationTemplateVersionResponse toVersionResponse(NotificationTemplateVersion version) {
        return new NotificationTemplateVersionResponse(
                version.getId().toString(), version.getChannel(), version.getVersionNumber(), version.getStatus(),
                version.getTitle(), version.getSummary(), version.getSubject(), version.getBody(),
                version.getActionUrlTemplate(), version.getVariablesUsed(), version.getChangeSummary(),
                version.getCreatedBy() == null ? null : version.getCreatedBy().getFullName(),
                version.getCreatedAt()
        );
    }
}
