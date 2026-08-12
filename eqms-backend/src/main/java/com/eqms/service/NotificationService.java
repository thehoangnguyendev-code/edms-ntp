package com.eqms.service;

import com.eqms.auth.CurrentUserService;
import com.eqms.dto.audittrail.AuditTrailChangeResponse;
import com.eqms.dto.notification.NotificationRelatedItemResponse;
import com.eqms.dto.notification.NotificationResponse;
import com.eqms.dto.notification.NotificationSummaryResponse;
import com.eqms.dto.notification.NotificationUserResponse;
import com.eqms.dto.user.PageResponse;
import com.eqms.dto.user.PaginationResponse;
import com.eqms.entity.EmailTemplate;
import com.eqms.entity.UserAccount;
import com.eqms.entity.UserNotification;
import com.eqms.repository.UserAccountRepository;
import com.eqms.repository.UserNotificationRepository;
import com.eqms.util.NotificationPreferenceUtils;
import com.eqms.util.DateTimeFormatUtils;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityNotFoundException;
import jakarta.transaction.Transactional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.regex.Pattern;

@Service
public class NotificationService {

    private static final Pattern HTML_TAG_PATTERN = Pattern.compile("<[^>]+>");
    private static final DateTimeFormatter DD_MM_YYYY = DateTimeFormatter.ofPattern("dd/MM/yyyy");
    private static final ZoneId ZONE = ZoneId.systemDefault();

    private final UserNotificationRepository notificationRepository;
    private final UserAccountRepository userAccountRepository;
    private final CurrentUserService currentUserService;
    private final AuditTrailService auditTrailService;
    private final NotificationRealtimeService notificationRealtimeService;
    private final ObjectMapper objectMapper;

    public NotificationService(
            UserNotificationRepository notificationRepository,
            UserAccountRepository userAccountRepository,
            CurrentUserService currentUserService,
            AuditTrailService auditTrailService,
            NotificationRealtimeService notificationRealtimeService,
            ObjectMapper objectMapper
    ) {
        this.notificationRepository = notificationRepository;
        this.userAccountRepository = userAccountRepository;
        this.currentUserService = currentUserService;
        this.auditTrailService = auditTrailService;
        this.notificationRealtimeService = notificationRealtimeService;
        this.objectMapper = objectMapper;
    }

    @Transactional
    public PageResponse<NotificationResponse> list(
            String scope,
            String search,
            String type,
            String module,
            String priority,
            String status,
            String sender,
            String relatedNumber,
            String relatedTitle,
            String dateFrom,
            String dateTo,
            String sortBy,
            String sortDirection,
            int page,
            int limit
    ) {
        UserAccount currentUser = currentUserService.requireCurrentUser();
        Specification<UserNotification> specification = buildSpecification(
                currentUser.getId(),
                scope,
                search,
                type,
                module,
                priority,
                status,
                sender,
                relatedNumber,
                relatedTitle,
                dateFrom,
                dateTo
        );
        Pageable pageable = PageRequest.of(
                Math.max(page - 1, 0),
                Math.max(limit, 1),
                buildSort(sortBy, sortDirection)
        );
        Page<UserNotification> result = notificationRepository.findAll(specification, pageable);
        List<NotificationResponse> data = result.getContent().stream().map(this::toResponse).toList();
        return new PageResponse<>(
                data,
                new PaginationResponse(
                        page,
                        limit,
                        result.getTotalElements(),
                        result.getTotalPages()
                )
        );
    }

    @Transactional
    public NotificationSummaryResponse getSummary() {
        UserAccount currentUser = currentUserService.requireCurrentUser();
        List<UserNotification> notifications = notificationRepository.findAll((root, query, cb) -> cb.and(
                cb.equal(root.get("recipientUser").get("id"), currentUser.getId()),
                cb.isNull(root.get("deletedAt"))
        ));
        long total = notifications.size();
        long unread = notifications.stream()
                .filter(notification -> UserNotification.STATUS_UNREAD.equalsIgnoreCase(notification.getStatus()))
                .count();
        long personal = notifications.stream()
                .filter(notification -> UserNotification.SCOPE_PERSONAL.equalsIgnoreCase(notification.getScope()))
                .count();
        long system = notifications.stream()
                .filter(notification -> UserNotification.SCOPE_SYSTEM.equalsIgnoreCase(notification.getScope()))
                .count();
        Map<String, Long> byType = notifications.stream()
                .filter(notification -> StringUtils.hasText(notification.getType()))
                .filter(notification -> UserNotification.STATUS_UNREAD.equalsIgnoreCase(notification.getStatus()))
                .collect(java.util.stream.Collectors.groupingBy(
                        notification -> notification.getType().trim().toLowerCase(Locale.ROOT),
                        java.util.stream.Collectors.counting()
                ));
        return new NotificationSummaryResponse(total, unread, personal, system, byType);
    }

    /**
     * Returns the current user's effective delivery settings.  Keeping this endpoint beside the
     * inbox prevents the notifications client from having to depend on the authentication API
     * just to render its own settings.
     */
    @Transactional
    public Map<String, Object> getPreferences() {
        UserAccount currentUser = currentUserService.requireCurrentUser();
        Map<String, Object> preferences = new java.util.LinkedHashMap<>(
                NotificationPreferenceUtils.parsePreferences(objectMapper, currentUser.getNotificationPreferences()));
        Map<String, Object> channels = new java.util.LinkedHashMap<>(
                (Map<String, Object>) preferences.getOrDefault("channels", Map.of()));
        // The legacy account-level flag remains the authoritative email opt-out.
        channels.put(NotificationPreferenceUtils.CHANNEL_EMAIL, currentUser.isEmailNotificationsEnabled());
        preferences.put("channels", channels);
        return preferences;
    }

    @Transactional
    public Map<String, Object> updatePreferences(Map<String, Object> requestedPreferences) {
        UserAccount currentUser = currentUserService.requireCurrentUser();
        Map<String, Object> existing = NotificationPreferenceUtils.parsePreferences(objectMapper, currentUser.getNotificationPreferences());
        Map<String, Object> merged = new java.util.LinkedHashMap<>(existing);
        if (requestedPreferences != null) {
            mergePreferenceSection(merged, requestedPreferences, "channels");
            mergePreferenceSection(merged, requestedPreferences, "modules");
        }
        Map<String, Object> normalized = NotificationPreferenceUtils.normalizePreferences(merged);
        @SuppressWarnings("unchecked")
        Map<String, Object> channels = (Map<String, Object>) normalized.get("channels");
        boolean emailEnabled = Boolean.TRUE.equals(channels.get(NotificationPreferenceUtils.CHANNEL_EMAIL));
        String serialized = NotificationPreferenceUtils.serializePreferences(objectMapper, normalized);
        boolean changed = !java.util.Objects.equals(serialized, currentUser.getNotificationPreferences())
                || currentUser.isEmailNotificationsEnabled() != emailEnabled;
        if (changed) {
            currentUser.setNotificationPreferences(serialized);
            currentUser.setEmailNotificationsEnabled(emailEnabled);
            userAccountRepository.save(currentUser);
            auditNotificationInboxAction(currentUser, "UPDATE_NOTIFICATION_PREFERENCES",
                    "Updated notification delivery preferences", List.of());
        }
        return getPreferences();
    }

    @SuppressWarnings("unchecked")
    private void mergePreferenceSection(Map<String, Object> target, Map<String, Object> patch, String section) {
        Object incoming = patch.get(section);
        if (!(incoming instanceof Map<?, ?> incomingMap)) {
            return;
        }
        Map<String, Object> mergedSection = new java.util.LinkedHashMap<>();
        Object current = target.get(section);
        if (current instanceof Map<?, ?> currentMap) {
            currentMap.forEach((key, value) -> mergedSection.put(String.valueOf(key), value));
        }
        incomingMap.forEach((key, value) -> mergedSection.put(String.valueOf(key), value));
        target.put(section, mergedSection);
    }

    @Transactional
    public long getUnreadCount() {
        UserAccount currentUser = currentUserService.requireCurrentUser();
        return notificationRepository.countByRecipientUserIdAndDeletedAtIsNullAndStatusIgnoreCase(currentUser.getId(), UserNotification.STATUS_UNREAD);
    }

    @Transactional
    public NotificationResponse getById(UUID id) {
        UserAccount currentUser = currentUserService.requireCurrentUser();
        UserNotification notification = notificationRepository.findByIdAndRecipientUserIdAndDeletedAtIsNull(id, currentUser.getId())
                .orElseThrow(() -> new EntityNotFoundException("Notification not found"));
        return toResponse(notification);
    }

    @Transactional
    public NotificationResponse markAsRead(UUID id) {
        UserAccount currentUser = currentUserService.requireCurrentUser();
        UserNotification notification = notificationRepository.findByIdAndRecipientUserIdAndDeletedAtIsNull(id, currentUser.getId())
                .orElseThrow(() -> new EntityNotFoundException("Notification not found"));
        String oldStatus = notification.getStatus();
        String oldReadAt = DateTimeFormatUtils.formatDateTime(notification.getReadAt());
        if (!UserNotification.STATUS_READ.equalsIgnoreCase(notification.getStatus())) {
            notification.setStatus(UserNotification.STATUS_READ);
            notification.setReadAt(Instant.now());
            notification = notificationRepository.save(notification);
        }
        auditTrailService.logAs(
                currentUser,
                "NOTIFICATION",
                notification.getTitle(),
                notification.getId(),
                "MARK_AS_READ",
                oldStatus,
                notification.getStatus(),
                "Notification marked as read",
                List.of(
                        new AuditTrailChangeResponse("Status", oldStatus, notification.getStatus()),
                        new AuditTrailChangeResponse("Read At", oldReadAt, DateTimeFormatUtils.formatDateTime(notification.getReadAt()))
                )
        );
        notifyRealtimeAfterCommit(currentUser.getId());
        return toResponse(notification);
    }

    @Transactional
    public void markAllAsRead() {
        UserAccount currentUser = currentUserService.requireCurrentUser();
        List<UserNotification> unreadNotifications = notificationRepository.findAll((root, query, cb) -> cb.and(
                cb.equal(root.get("recipientUser").get("id"), currentUser.getId()),
                cb.isNull(root.get("deletedAt")),
                cb.notEqual(cb.lower(root.get("status")), UserNotification.STATUS_READ)
        ));
        Instant now = Instant.now();
        for (UserNotification notification : unreadNotifications) {
            notification.setStatus(UserNotification.STATUS_READ);
            notification.setReadAt(now);
        }
        notificationRepository.saveAll(unreadNotifications);
        auditNotificationInboxAction(
                currentUser,
                "MARK_ALL_AS_READ",
                "Marked all unread notifications as read",
                List.of(new AuditTrailChangeResponse("Unread Notification Count", String.valueOf(unreadNotifications.size()), "0"))
        );
        notifyRealtimeAfterCommit(currentUser.getId());
    }

    @Transactional
    public void markManyAsRead(List<UUID> ids) {
        if (ids == null || ids.isEmpty()) {
            return;
        }
        UserAccount currentUser = currentUserService.requireCurrentUser();
        List<UserNotification> notifications = notificationRepository.findAll((root, query, cb) -> cb.and(
                root.get("id").in(ids),
                cb.equal(root.get("recipientUser").get("id"), currentUser.getId()),
                cb.isNull(root.get("deletedAt"))
        ));
        Instant now = Instant.now();
        for (UserNotification notification : notifications) {
            notification.setStatus(UserNotification.STATUS_READ);
            if (notification.getReadAt() == null) {
                notification.setReadAt(now);
            }
        }
        notificationRepository.saveAll(notifications);
        auditNotificationInboxAction(
                currentUser,
                "MARK_SELECTED_AS_READ",
                "Marked selected notifications as read",
                List.of(new AuditTrailChangeResponse("Selected Notification Count", String.valueOf(notifications.size()), "0"))
        );
        notifyRealtimeAfterCommit(currentUser.getId());
    }

    @Transactional
    public void deleteNotification(UUID id) {
        UserAccount currentUser = currentUserService.requireCurrentUser();
        UserNotification notification = notificationRepository.findByIdAndRecipientUserIdAndDeletedAtIsNull(id, currentUser.getId())
                .orElseThrow(() -> new EntityNotFoundException("Notification not found"));
        String previousStatus = notification.getStatus();
        notification.setDeletedAt(Instant.now());
        notificationRepository.save(notification);
        auditTrailService.logAs(
                currentUser,
                "NOTIFICATION",
                notification.getTitle(),
                notification.getId(),
                "DELETE_NOTIFICATION",
                previousStatus,
                "DELETED",
                "Notification deleted",
                List.of(
                        new AuditTrailChangeResponse("Status", previousStatus, "DELETED"),
                        new AuditTrailChangeResponse("Deleted At", "", DateTimeFormatUtils.formatDateTime(notification.getDeletedAt()))
                )
        );
        notifyRealtimeAfterCommit(currentUser.getId());
    }

    @Transactional
    public void deleteNotifications(List<UUID> ids) {
        if (ids == null || ids.isEmpty()) {
            return;
        }
        UserAccount currentUser = currentUserService.requireCurrentUser();
        List<UserNotification> notifications = notificationRepository.findAll((root, query, cb) -> cb.and(
                root.get("id").in(ids),
                cb.equal(root.get("recipientUser").get("id"), currentUser.getId()),
                cb.isNull(root.get("deletedAt"))
        ));
        Instant now = Instant.now();
        for (UserNotification notification : notifications) {
            notification.setDeletedAt(now);
        }
        notificationRepository.saveAll(notifications);
        auditNotificationInboxAction(
                currentUser,
                "DELETE_SELECTED_NOTIFICATIONS",
                "Deleted selected notifications",
                List.of(new AuditTrailChangeResponse("Selected Notification Count", String.valueOf(notifications.size()), "0"))
        );
        notifyRealtimeAfterCommit(currentUser.getId());
    }

    @Transactional
    public void clearAllRead() {
        UserAccount currentUser = currentUserService.requireCurrentUser();
        List<UserNotification> notifications = notificationRepository.findAll((root, query, cb) -> cb.and(
                cb.equal(root.get("recipientUser").get("id"), currentUser.getId()),
                cb.isNull(root.get("deletedAt")),
                cb.equal(cb.lower(root.get("status")), UserNotification.STATUS_READ)
        ));
        Instant now = Instant.now();
        for (UserNotification notification : notifications) {
            notification.setDeletedAt(now);
        }
        notificationRepository.saveAll(notifications);
        auditNotificationInboxAction(
                currentUser,
                "CLEAR_ALL_READ",
                "Cleared all read notifications",
                List.of(new AuditTrailChangeResponse("Read Notification Count", String.valueOf(notifications.size()), "0"))
        );
        notifyRealtimeAfterCommit(currentUser.getId());
    }

    @Transactional
    public NotificationResponse recordNotification(
            UserAccount recipient,
            UserAccount sender,
            String scope,
            String module,
            String type,
            String title,
            String message,
            String actionUrl,
            String relatedEntityType,
            UUID relatedEntityId,
            String relatedEntityNumber,
            String relatedEntityTitle,
            String priority,
            JsonNode metadata
    ) {
        return recordNotification(recipient, sender, scope, module, type, title, message, actionUrl,
                relatedEntityType, relatedEntityId, relatedEntityNumber, relatedEntityTitle, priority, metadata, false);
    }

    @Transactional
    public NotificationResponse recordNotification(
            UserAccount recipient,
            UserAccount sender,
            String scope,
            String module,
            String type,
            String title,
            String message,
            String actionUrl,
            String relatedEntityType,
            UUID relatedEntityId,
            String relatedEntityNumber,
            String relatedEntityTitle,
            String priority,
            JsonNode metadata,
            boolean mandatory
    ) {
        if (recipient == null || recipient.getId() == null || !StringUtils.hasText(title)) {
            return null;
        }
        if (!mandatory && !NotificationPreferenceUtils.canReceiveInAppNotification(objectMapper, recipient, module)) {
            return null;
        }

        UserNotification notification = new UserNotification();
        notification.setRecipientUser(recipient);
        notification.setSenderUser(sender);
        notification.setScope(StringUtils.hasText(scope) ? scope.toLowerCase(Locale.ROOT) : UserNotification.SCOPE_PERSONAL);
        notification.setModule(StringUtils.hasText(module) ? module : "System");
        notification.setModuleKey(StringUtils.hasText(module) ? module.toLowerCase(Locale.ROOT).replace(" ", "-") : "system");
        notification.setType(StringUtils.hasText(type) ? type : "system");
        notification.setTitle(title);
        notification.setMessage(message);
        notification.setActionUrl(actionUrl);
        notification.setRelatedEntityType(relatedEntityType);
        notification.setRelatedEntityId(relatedEntityId);
        notification.setRelatedEntityNumber(relatedEntityNumber);
        notification.setRelatedEntityTitle(relatedEntityTitle);
        notification.setPriority(StringUtils.hasText(priority) ? priority.toLowerCase(Locale.ROOT) : "medium");
        notification.setStatus(UserNotification.STATUS_UNREAD);
        notification.setMetadata(metadata);
        notification.setReadAt(null);
        notification.setDeletedAt(null);
        NotificationResponse response = toResponse(notificationRepository.save(notification));
        notifyRealtimeAfterCommit(recipient.getId());
        return response;
    }

    @Transactional
    public NotificationResponse recordFromEmailTemplate(
            EmailTemplate template,
            UserAccount recipient,
            UserAccount sender,
            String module,
            String type,
            String scope,
            Map<String, String> variables
    ) {
        if (template == null || recipient == null) {
            return null;
        }
        String renderedSubject = renderTemplate(template.getSubject(), variables);
        String renderedBody = renderTemplate(template.getContent(), variables);
        String cleanMessage = summarize(renderedBody);
        String actionUrl = resolveActionUrl(variables);
        return recordNotification(
                recipient,
                sender,
                scope,
                module,
                type,
                renderedSubject,
                cleanMessage,
                actionUrl,
                guessRelatedEntityType(variables),
                parseUuid(firstNonBlank(variables, "relatedEntityId", "documentId", "revisionId", "controlledCopyId")).orElse(null),
                firstNonBlank(variables, "documentNumber", "revisionNumber", "controlledCopyNumber", "batchNumber"),
                firstNonBlank(variables, "documentTitle", "revisionTitle", "controlledCopyTitle", "title"),
                firstNonBlank(variables, "priority", "notificationPriority", "severity"),
                toMetadata(variables)
        );
    }

    @Transactional
    public void seedIfEmpty(UserAccount recipient, UserAccount sender, String title, String message, String module, String type, String scope) {
        if (recipient == null) {
            return;
        }
        if (notificationRepository.countByRecipientUserIdAndDeletedAtIsNull(recipient.getId()) > 0) {
            return;
        }
        recordNotification(recipient, sender, scope, module, type, title, message, null, null, null, null, null, "medium", null);
    }

    private Specification<UserNotification> buildSpecification(
            UUID recipientUserId,
            String scope,
            String search,
            String type,
            String module,
            String priority,
            String status,
            String sender,
            String relatedNumber,
            String relatedTitle,
            String dateFrom,
            String dateTo
    ) {
        return (root, query, cb) -> {
            List<jakarta.persistence.criteria.Predicate> predicates = new ArrayList<>();
            predicates.add(cb.equal(root.get("recipientUser").get("id"), recipientUserId));
            predicates.add(cb.isNull(root.get("deletedAt")));

            if (StringUtils.hasText(scope) && !"all".equalsIgnoreCase(scope)) {
                predicates.add(cb.equal(cb.lower(root.get("scope")), scope.toLowerCase(Locale.ROOT)));
            }
            if (StringUtils.hasText(type) && !"all".equalsIgnoreCase(type)) {
                predicates.add(cb.equal(cb.lower(root.get("type")), type.toLowerCase(Locale.ROOT)));
            }
            if (StringUtils.hasText(module) && !"all".equalsIgnoreCase(module)) {
                predicates.add(cb.equal(cb.lower(root.get("module")), module.toLowerCase(Locale.ROOT)));
            }
            if (StringUtils.hasText(priority) && !"all".equalsIgnoreCase(priority)) {
                predicates.add(cb.equal(cb.lower(root.get("priority")), priority.toLowerCase(Locale.ROOT)));
            }
            if (StringUtils.hasText(status) && !"all".equalsIgnoreCase(status)) {
                predicates.add(cb.equal(cb.lower(root.get("status")), status.toLowerCase(Locale.ROOT)));
            }
            if (StringUtils.hasText(sender) && !"all".equalsIgnoreCase(sender)) {
                String pattern = "%" + sender.trim().toLowerCase(Locale.ROOT) + "%";
                var senderJoin = root.join("senderUser", jakarta.persistence.criteria.JoinType.LEFT);
                predicates.add(cb.or(
                        cb.like(cb.lower(senderJoin.get("fullName")), pattern),
                        cb.like(cb.lower(senderJoin.get("username")), pattern),
                        cb.like(cb.lower(senderJoin.get("employeeCode")), pattern),
                        cb.like(cb.lower(senderJoin.get("email")), pattern)
                ));
            }
            if (StringUtils.hasText(relatedNumber) && !"all".equalsIgnoreCase(relatedNumber)) {
                String pattern = "%" + relatedNumber.trim().toLowerCase(Locale.ROOT) + "%";
                predicates.add(cb.like(cb.lower(root.get("relatedEntityNumber")), pattern));
            }
            if (StringUtils.hasText(relatedTitle) && !"all".equalsIgnoreCase(relatedTitle)) {
                String pattern = "%" + relatedTitle.trim().toLowerCase(Locale.ROOT) + "%";
                predicates.add(cb.like(cb.lower(root.get("relatedEntityTitle")), pattern));
            }
            if (StringUtils.hasText(search)) {
                String pattern = "%" + search.trim().toLowerCase(Locale.ROOT) + "%";
                predicates.add(cb.or(
                        cb.like(cb.lower(root.get("title")), pattern),
                        cb.like(cb.lower(root.get("message")), pattern),
                        cb.like(cb.lower(root.get("module")), pattern),
                        cb.like(cb.lower(root.get("relatedEntityNumber")), pattern),
                        cb.like(cb.lower(root.get("relatedEntityTitle")), pattern),
                        cb.like(cb.lower(root.get("type")), pattern)
                ));
            }
            Instant from = parseBoundary(dateFrom, true);
            if (from != null) {
                predicates.add(cb.greaterThanOrEqualTo(root.get("createdAt"), from));
            }
            Instant to = parseBoundary(dateTo, false);
            if (to != null) {
                predicates.add(cb.lessThanOrEqualTo(root.get("createdAt"), to));
            }
            return cb.and(predicates.toArray(new jakarta.persistence.criteria.Predicate[0]));
        };
    }

    private Sort buildSort(String sortBy, String sortDirection) {
        String normalizedSortBy = normalizeSortField(sortBy);
        Sort.Direction direction = "asc".equalsIgnoreCase(sortDirection) ? Sort.Direction.ASC : Sort.Direction.DESC;
        return Sort.by(direction, normalizedSortBy);
    }

    private String normalizeSortField(String sortBy) {
        if (!StringUtils.hasText(sortBy)) {
            return "createdAt";
        }
        return switch (sortBy) {
            case "title", "module", "priority", "status", "createdAt", "readAt", "relatedEntityNumber", "relatedEntityTitle", "moduleKey" -> sortBy;
            default -> "createdAt";
        };
    }

    private NotificationResponse toResponse(UserNotification notification) {
        return new NotificationResponse(
                notification.getId(),
                notification.getType(),
                notification.getScope(),
                notification.getTitle(),
                notification.getMessage(),
                notification.getModule(),
                notification.getModuleKey(),
                notification.getPriority(),
                notification.getStatus(),
                DateTimeFormatUtils.formatDateTime(notification.getCreatedAt()),
                DateTimeFormatUtils.formatDateTime(notification.getReadAt()),
                DateTimeFormatUtils.formatDateTime(notification.getDeletedAt()),
                notification.getActionUrl(),
                toUserResponse(notification.getSenderUser()),
                toUserResponse(notification.getRecipientUser()),
                new NotificationRelatedItemResponse(
                        notification.getRelatedEntityId(),
                        notification.getRelatedEntityType(),
                        notification.getRelatedEntityNumber(),
                        notification.getRelatedEntityTitle()
                ),
                notification.getMetadata()
        );
    }

    private NotificationUserResponse toUserResponse(UserAccount user) {
        if (user == null) {
            return null;
        }
        return new NotificationUserResponse(
                user.getId(),
                user.getUsername(),
                user.getFullName(),
                user.getEmployeeCode(),
                user.getEmail(),
                user.getRoleName(),
                user.getPosition(),
                user.getDepartment(),
                user.getBusinessUnit()
        );
    }

    private Instant parseBoundary(String value, boolean startOfDay) {
        if (!StringUtils.hasText(value)) {
            return null;
        }
        String trimmed = value.trim();
        try {
            LocalDate date = LocalDate.parse(trimmed, DD_MM_YYYY);
            ZonedDateTime zonedDateTime = startOfDay ? date.atStartOfDay(ZONE) : date.atTime(23, 59, 59).atZone(ZONE);
            return zonedDateTime.toInstant();
        } catch (Exception ignored) {
        }
        try {
            if (trimmed.contains("T")) {
                return Instant.parse(trimmed);
            }
        } catch (Exception ignored) {
        }
        try {
            if (trimmed.contains(" ")) {
                return ZonedDateTime.parse(trimmed.replace(" ", "T")).toInstant();
            }
        } catch (Exception ignored) {
        }
        return null;
    }

    private void auditNotificationInboxAction(UserAccount actor, String actionType, String comment, List<AuditTrailChangeResponse> changes) {
        if (actor == null) {
            return;
        }
        auditTrailService.logAs(
                actor,
                "NOTIFICATION_INBOX",
                "Notification Inbox",
                actor.getId(),
                actionType,
                null,
                null,
                comment,
                changes
        );
    }

    private String renderTemplate(String template, Map<String, String> variables) {
        if (!StringUtils.hasText(template)) {
            return "";
        }
        String rendered = template;
        if (variables != null) {
            for (Map.Entry<String, String> entry : variables.entrySet()) {
                String key = entry.getKey();
                String value = entry.getValue() == null ? "" : entry.getValue();
                if (StringUtils.hasText(key)) {
                    rendered = rendered.replace("{{" + key + "}}", value);
                }
            }
        }
        return rendered;
    }

    private String summarize(String renderedHtml) {
        if (!StringUtils.hasText(renderedHtml)) {
            return "";
        }
        String plain = HTML_TAG_PATTERN.matcher(renderedHtml).replaceAll(" ");
        plain = plain.replace("&nbsp;", " ").replaceAll("\\s+", " ").trim();
        if (plain.length() <= 220) {
            return plain;
        }
        return plain.substring(0, 217) + "...";
    }

    private String resolveActionUrl(Map<String, String> variables) {
        if (variables == null || variables.isEmpty()) {
            return null;
        }
        return firstNonBlank(variables, "actionUrl", "revisionUrl", "documentUrl", "controlledCopyPreviewUrl", "controlledCopyUrl");
    }

    private String guessRelatedEntityType(Map<String, String> variables) {
        String value = firstNonBlank(variables, "relatedEntityType", "entityType");
        if (StringUtils.hasText(value)) {
            return value;
        }
        if (variables != null) {
            if (StringUtils.hasText(variables.get("controlledCopyNumber")) || StringUtils.hasText(variables.get("batchNumber"))) {
                return "controlled-copy";
            }
            if (StringUtils.hasText(variables.get("revisionNumber"))) {
                return "revision";
            }
            if (StringUtils.hasText(variables.get("documentNumber"))) {
                return "document";
            }
        }
        return null;
    }

    private JsonNode toMetadata(Map<String, String> variables) {
        if (variables == null || variables.isEmpty()) {
            return null;
        }
        return objectMapper.valueToTree(variables);
    }

    private String firstNonBlank(Map<String, String> variables, String... keys) {
        if (variables == null || keys == null) {
            return null;
        }
        for (String key : keys) {
            if (StringUtils.hasText(key) && StringUtils.hasText(variables.get(key))) {
                return variables.get(key).trim();
            }
        }
        return null;
    }

    private java.util.Optional<UUID> parseUuid(String value) {
        if (!StringUtils.hasText(value)) {
            return java.util.Optional.empty();
        }
        try {
            return java.util.Optional.of(UUID.fromString(value.trim()));
        } catch (Exception ignored) {
            return java.util.Optional.empty();
        }
    }

    private void notifyRealtimeAfterCommit(UUID userId) {
        if (userId == null) {
            return;
        }
        Runnable notifier = () -> notificationRealtimeService.publishUserEvent(userId, "notification-updated");
        if (TransactionSynchronizationManager.isActualTransactionActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    notifier.run();
                }
            });
            return;
        }
        notifier.run();
    }
}
