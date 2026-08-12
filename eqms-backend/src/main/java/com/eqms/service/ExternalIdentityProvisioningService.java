package com.eqms.service;

import com.eqms.auth.CurrentUserService;
import com.eqms.dto.user.ExternalIdentityActionRequest;
import com.eqms.dto.user.ExternalIdentityProvisioningResponse;
import com.eqms.entity.ExternalIdentityProvisioning;
import com.eqms.entity.UserAccount;
import com.eqms.repository.ExternalIdentityProvisioningRepository;
import com.eqms.repository.UserAccountRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.transaction.Transactional;
import org.springframework.scheduling.annotation.Scheduled;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.Duration;
import java.util.Map;
import java.util.Collection;
import java.util.List;
import java.util.LinkedHashMap;
import java.util.UUID;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@Service
public class ExternalIdentityProvisioningService {
    private static final Logger log = LoggerFactory.getLogger(ExternalIdentityProvisioningService.class);
    private static final String PROVIDER = "MICROSOFT_ENTRA";

    @org.springframework.beans.factory.annotation.Value("${app.external-identity.invite-redirect-url:https://login.microsoftonline.com}")
    private String inviteRedirectUrl;
    private final ExternalIdentityProvisioningRepository repository;
    private final UserAccountRepository userRepository;
    private final OfficeOnlineConfigurationService officeOnlineConfigurationService;
    private final NotificationRealtimeService notificationRealtimeService;
    private final NotificationService notificationService;
    private final ObjectMapper mapper;
    private final AuditTrailService auditTrailService;
    private final CurrentUserService currentUserService;
    private final PermissionEvaluationService permissionEvaluationService;
    private final DistributedSchedulerLockService schedulerLockService;
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();
    private volatile Instant lastManualReconciliationAt;
    private volatile String cachedGraphToken;
    private volatile Instant cachedGraphTokenExpiresAt;

    public ExternalIdentityProvisioningService(ExternalIdentityProvisioningRepository repository,
            UserAccountRepository userRepository, OfficeOnlineConfigurationService officeOnlineConfigurationService,
            NotificationRealtimeService notificationRealtimeService, NotificationService notificationService,
            ObjectMapper mapper, AuditTrailService auditTrailService, CurrentUserService currentUserService,
            PermissionEvaluationService permissionEvaluationService,
            DistributedSchedulerLockService schedulerLockService) {
        this.repository = repository; this.userRepository = userRepository; this.officeOnlineConfigurationService = officeOnlineConfigurationService;
        this.notificationRealtimeService = notificationRealtimeService;
        this.notificationService = notificationService;
        this.mapper = mapper; this.auditTrailService = auditTrailService; this.currentUserService = currentUserService;
        this.permissionEvaluationService = permissionEvaluationService;
        this.schedulerLockService = schedulerLockService;
    }

    /** Notifies every admin who can view external provisioning that a guest accepted their invitation. */
    private void notifyAdminsOfRedemption(UserAccount joinedUser, ExternalIdentityProvisioning record) {
        List<UserAccount> admins = userRepository.findAllByStatus(com.eqms.entity.UserStatus.Active).stream()
                .filter(admin -> permissionEvaluationService.hasPermission(admin, "users.view_external_provisioning"))
                .toList();
        for (UserAccount admin : admins) {
            notificationService.recordNotification(
                    admin, joinedUser, "personal", "User Management", "external-identity-redeemed",
                    "Microsoft Invitation Accepted",
                    joinedUser.getFullName() + " (" + record.getEmailNormalized() + ") accepted the Microsoft Entra invitation.",
                    "/security-authorization/user-management/" + joinedUser.getId(),
                    "user", joinedUser.getId(), null, joinedUser.getFullName(),
                    "medium", null);
        }
    }

    /**
     * Background reconciliation (scheduled job) runs with no authenticated HTTP request, so
     * {@code auditTrailService.log(...)} (which requires the current SecurityContext user)
     * would silently fail and be swallowed by the caller's try/catch — meaning automatically
     * detected status changes never made it into the Audit Trail. Attribute them to the
     * built-in admin account instead, matching the pattern used by other scheduled jobs.
     */
    private UserAccount resolveSystemActor() {
        return userRepository.findByUsername("admin").orElse(null);
    }

    @Transactional
    public ExternalIdentityProvisioningResponse invite(UUID userId, String reason, boolean resend) {
        requirePermission(resend ? "users.resend_external_invitation" : "users.invite_external");
        UserAccount user = requireActiveUser(userId);
        ExternalIdentityProvisioning record = findOrCreateForUser(user);
        String status = record.getStatus();
        if (hasPendingOperation(record)) {
            throw new IllegalStateException("A Microsoft Entra operation is already being processed");
        }
        if (resend && !"INVITED".equals(status)) {
            throw new IllegalStateException("An invitation can only be resent while it is pending");
        }
        if (!resend && !"NOT_INVITED".equals(status) && !"NOT_LINKED".equals(status) && !"REMOVED".equals(status)) {
            throw new IllegalStateException("This user already has a Microsoft Entra relationship");
        }
        return enqueue(record, resend ? "RESEND_INVITATION" : "INVITE", reason, "INVITE_PENDING");
    }

    /**
     * Clears a stale Microsoft link when a user's email is changed. The existing record (object
     * ID, LINKED/INVITED/REDEEMED status, etc.) describes the *old* email's relationship with
     * Entra — it says nothing about whether the new email belongs to the tenant. Rather than show
     * a misleading status, reset to NOT_LINKED so the next Invite/reconciliation pass re-evaluates
     * the new address from scratch.
     */
    @Transactional
    public void invalidateOnEmailChange(UUID userId, String newEmail) {
        repository.findByUser_Id(userId).ifPresent(record -> {
            String normalizedNewEmail = newEmail == null ? "" : newEmail.trim().toLowerCase();
            if (normalizedNewEmail.equals(record.getEmailNormalized())) return;
            String previousStatus = record.getStatus();
            String previousEmail = record.getEmailNormalized();
            // Never delete lifecycle evidence merely because a user changed their email.  A row
            // can no longer prove ownership of the former Entra object, therefore it is reset to
            // a safe, non-destructive state and its previous relationship remains in the audit.
            record.setEmailNormalized(normalizedNewEmail);
            record.setObjectId(null);
            record.setInvitationId(null);
            record.setStatus("NOT_LINKED");
            record.setLifecycleOwnership("UNKNOWN");
            record.setDirectoryUserType(null);
            record.setPendingOperation(null);
            record.setPendingReason(null);
            record.setOperationRequestedAt(null);
            record.setNextAttemptAt(null);
            repository.save(record);
            auditTrailService.log("USER", record.getUser().getFullName(), userId, "EXTERNAL_IDENTITY_RESET_ON_EMAIL_CHANGE", previousStatus, "NOT_LINKED",
                    "Email changed from " + previousEmail + " to " + normalizedNewEmail + " — previous Microsoft link cleared; re-invite or re-check required.");
            notificationRealtimeService.publishUserEvent(userId, "external-identity-status-changed", notLinkedResponse(userId));
            notificationRealtimeService.publishGlobalEvent("external-identity-status-changed");
        });
    }

    @Transactional
    private ExternalIdentityProvisioningResponse inviteInternal(UUID userId, String reason, boolean resend, String permission) {
        UserAccount user = userRepository.findById(userId).orElseThrow(() -> new IllegalArgumentException("User not found"));
        requirePermission(permission);
        String email = user.getEmail().trim().toLowerCase();
        ExternalIdentityProvisioning record = repository.findByProviderAndEmailNormalized(PROVIDER, email).orElseGet(() -> {
            ExternalIdentityProvisioning item = new ExternalIdentityProvisioning(); item.setUser(user); item.setEmailNormalized(email); return item;
        });
        if (record.getUser() != null && !record.getUser().getId().equals(userId)) {
            throw new IllegalStateException("This email is already linked to another EQMS user");
        }
        if (!resend && ("INVITED".equals(record.getStatus()) || "REDEEMED".equals(record.getStatus()))) return toResponse(record);
        String previousStatus = record.getStatus();
        // The Graph /invitations API is for onboarding external guests. If this email already
        // exists in the tenant (an internal Member added by IT, or a guest invited outside EQMS),
        // sending a fresh invite would be meaningless at best and error out at worst — link the
        // existing account directly instead, exactly like the background reconciliation does.
        if (!resend) {
            JsonNode existing = findExistingDirectoryUserSafely(email);
            if (existing != null) {
                record.setTenantId(graphConfig().tenantId());
                record.setObjectId(text(existing, "id"));
                boolean internalMember = "Member".equalsIgnoreCase(text(existing, "userType"));
                boolean acceptedGuest = "Accepted".equalsIgnoreCase(existing.path("externalUserState").asText());
                record.setStatus(internalMember ? "LINKED" : (acceptedGuest ? "REDEEMED" : "INVITED"));
                record.setInvitedAt(Instant.now());
                record.setLastGraphCheckedAt(Instant.now());
                record.setLastErrorCode(null);
                record.setLastErrorMessage(null);
                repository.save(record);
                auditTrailService.log("USER", user.getFullName(), user.getId(), "EXTERNAL_IDENTITY_RECONCILED", previousStatus, record.getStatus(),
                        "Existing Microsoft account found for " + email + " — linked instead of sending a new invitation.");
                notificationRealtimeService.publishUserEvent(user.getId(), "external-identity-status-changed", toResponse(record));
                notificationRealtimeService.publishGlobalEvent("external-identity-status-changed");
                return toResponse(record);
            }
        }
        try {
            JsonNode result = callInvitation(email, resend);
            record.setTenantId(graphConfig().tenantId()); record.setInvitationId(text(result, "id"));
            record.setObjectId(text(result.path("invitedUser"), "id")); record.setStatus("INVITED");
            record.setInvitedAt(Instant.now()); record.setLastErrorCode(null); record.setLastErrorMessage(null);
            record.setAttemptCount(record.getAttemptCount() + 1); repository.save(record);
            auditTrailService.log("USER", user.getFullName(), user.getId(), resend ? "EXTERNAL_INVITATION_RESENT" : "EXTERNAL_INVITATION_CREATED", previousStatus, "INVITED",
                    "Microsoft invitation " + (resend ? "resent" : "sent") + " to " + email + (StringUtils.hasText(reason) ? " — Reason: " + reason : ""));
        } catch (Exception ex) {
            record.setStatus("FAILED"); record.setLastErrorCode("GRAPH_ERROR"); record.setLastErrorMessage(ex.getMessage());
            record.setAttemptCount(record.getAttemptCount() + 1); repository.save(record);
            auditTrailService.log("USER", user.getFullName(), user.getId(), "EXTERNAL_PROVISIONING_FAILED", previousStatus, "FAILED",
                    "External invitation to " + email + " failed: " + ex.getMessage());
            throw new IllegalStateException("Microsoft invitation failed: " + ex.getMessage(), ex);
        }
        return toResponse(record);
    }

    public ExternalIdentityProvisioningResponse retry(UUID userId, String reason) {
        requirePermission("users.retry_external_provisioning");
        requireActiveUser(userId);
        ExternalIdentityProvisioning record = repository.findByUser_Id(userId)
                .orElseThrow(() -> new IllegalStateException("No failed Microsoft Entra operation exists for this user"));
        if (!"FAILED".equals(record.getStatus()) || hasPendingOperation(record)) {
            throw new IllegalStateException("Retry is only available after a failed Microsoft Entra operation");
        }
        return enqueue(record, "INVITE", reason, "INVITE_PENDING");
    }

    public ExternalIdentityProvisioningResponse get(UUID userId) {
        requirePermission("users.view_external_provisioning");
        Map<UUID, ExternalIdentityProvisioningResponse> status = statuses(List.of(userId));
        return status.getOrDefault(userId, notLinkedResponse(userId));
    }

    /** Lightweight status lookup for user-management responses. Permission is enforced by the
     * caller's list/detail endpoint, while this method deliberately avoids one request per row. */
    public Map<UUID, ExternalIdentityProvisioningResponse> statuses(Collection<UUID> userIds) {
        if (userIds == null || userIds.isEmpty()) return Map.of();
        Map<UUID, ExternalIdentityProvisioningResponse> result = new LinkedHashMap<>();
        List<ExternalIdentityProvisioning> records = repository.findAllByUser_IdIn(userIds);
        for (ExternalIdentityProvisioning record : records) {
            result.put(record.getUser().getId(), toResponse(record));
        }
        return result;
    }

    /** Internal capability helper. It intentionally exposes no Entra metadata to callers. */
    public boolean isEqmsManagedGuest(UUID userId) {
        return repository.findByUser_Id(userId)
                .map(record -> "EQMS_INVITED_GUEST".equals(record.getLifecycleOwnership())
                        && "Guest".equalsIgnoreCase(record.getDirectoryUserType()))
                .orElse(false);
    }

    public boolean hasPendingOperation(UUID userId) {
        return repository.findByUser_Id(userId).map(this::hasPendingOperation).orElse(false);
    }

    /**
     * Keep Entra links current even when no administrator has the user list
     * open. Changes are pushed to connected clients through the existing SSE
     * notification stream; the UI does not need to poll for every refresh.
     */
    @Scheduled(fixedDelay = 60000, initialDelay = 30000)
    public void reconcileDirectoryInBackground() {
        try (var lease = schedulerLockService.tryAcquire("external-identity-reconciliation", Duration.ofMinutes(5))) {
            if (!lease.acquired()) {
                log.debug("Skipping Microsoft Entra reconciliation because another instance owns the lease or Redis is unavailable");
                return;
            }
            processPendingOperations();
            reconcileManualGuests(List.of());
            refreshRedeemedState(repository.findAllByStatus("INVITED"));
        } catch (Exception ex) {
            log.debug("Background Microsoft Entra reconciliation skipped: {}", ex.getMessage());
        }
    }

    /**
     * Executes only durable, previously-authorized requests.  User-facing endpoints never wait
     * for Graph: they persist an operation and return the pending status immediately.  This also
     * makes retries safe after a transient Graph outage or backend restart.
     */
    @Transactional
    void processPendingOperations() {
        Instant now = Instant.now();
        for (ExternalIdentityProvisioning record : repository.findAllByPendingOperationIsNotNull()) {
            if (record.getNextAttemptAt() != null && record.getNextAttemptAt().isAfter(now)) continue;
            try {
                switch (record.getPendingOperation()) {
                    case "INVITE", "RESEND_INVITATION" -> executeInvitation(record);
                    case "DISABLE" -> executeDisable(record);
                    case "REMOVE" -> executeRemoval(record);
                    default -> throw new IllegalStateException("Unsupported Microsoft Entra operation");
                }
                publish(record);
            } catch (Exception ex) {
                int attempts = record.getAttemptCount() + 1;
                record.setAttemptCount(attempts);
                record.setLastErrorCode("GRAPH_OPERATION_FAILED");
                record.setLastErrorMessage(safeError(ex));
                if (attempts >= 5) {
                    record.setStatus("FAILED");
                    record.setPendingOperation(null);
                    record.setNextAttemptAt(null);
                } else {
                    record.setNextAttemptAt(now.plusSeconds(Math.min(300, 5L << Math.min(attempts, 5))));
                }
                repository.save(record);
                auditTrailService.logAs(resolveSystemActor(), "USER", record.getUser().getFullName(), record.getUser().getId(),
                        "EXTERNAL_IDENTITY_OPERATION_FAILED", null, record.getStatus(),
                        "Microsoft Entra operation " + record.getPendingOperation() + " failed: " + safeError(ex));
                publish(record);
            }
        }
    }

    private void executeInvitation(ExternalIdentityProvisioning record) throws Exception {
        String operation = record.getPendingOperation();
        JsonNode result = callInvitation(record.getEmailNormalized(), "RESEND_INVITATION".equals(operation));
        record.setTenantId(graphConfig().tenantId());
        record.setInvitationId(text(result, "id"));
        record.setObjectId(text(result.path("invitedUser"), "id"));
        record.setDirectoryUserType("Guest");
        record.setLifecycleOwnership("EQMS_INVITED_GUEST");
        record.setStatus("INVITED");
        record.setInvitedAt(Instant.now());
        completePendingOperation(record, operation, "INVITED");
    }

    private void executeDisable(ExternalIdentityProvisioning record) throws Exception {
        requireManagedGuest(record);
        HttpRequest request = graphRequest("/users/" + enc(record.getObjectId()))
                .header("Content-Type", "application/json")
                .method("PATCH", HttpRequest.BodyPublishers.ofString("{\"accountEnabled\":false}"))
                .build();
        requireSuccess(http.send(request, HttpResponse.BodyHandlers.ofString()));
        record.setDisabledAt(Instant.now());
        completePendingOperation(record, "DISABLE", "DISABLED");
    }

    private void executeRemoval(ExternalIdentityProvisioning record) throws Exception {
        requireManagedGuest(record);
        HttpResponse<String> response = http.send(graphRequest("/users/" + enc(record.getObjectId())).DELETE().build(), HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() != 404) requireSuccess(response);
        record.setObjectId(null);
        record.setInvitationId(null);
        record.setDisabledAt(Instant.now());
        completePendingOperation(record, "REMOVE", "REMOVED");
    }

    private ExternalIdentityProvisioningResponse enqueue(ExternalIdentityProvisioning record, String operation, String reason, String pendingStatus) {
        String previous = record.getStatus();
        record.setStatus(pendingStatus);
        record.setPendingOperation(operation);
        record.setPendingReason(reason == null ? null : reason.trim());
        record.setOperationRequestedAt(Instant.now());
        record.setNextAttemptAt(Instant.now());
        record.setLastErrorCode(null);
        record.setLastErrorMessage(null);
        repository.save(record);
        auditTrailService.log("USER", record.getUser().getFullName(), record.getUser().getId(), "EXTERNAL_IDENTITY_OPERATION_QUEUED",
                previous, pendingStatus, "Microsoft Entra operation " + operation + " queued" + (StringUtils.hasText(reason) ? " — Reason: " + reason : ""));
        publish(record);
        return toResponse(record);
    }

    private void completePendingOperation(ExternalIdentityProvisioning record, String operation, String completedStatus) {
        String previous = record.getStatus();
        record.setStatus(completedStatus);
        record.setPendingOperation(null);
        record.setPendingReason(null);
        record.setOperationRequestedAt(null);
        record.setNextAttemptAt(null);
        record.setLastErrorCode(null);
        record.setLastErrorMessage(null);
        repository.save(record);
        auditTrailService.logAs(resolveSystemActor(), "USER", record.getUser().getFullName(), record.getUser().getId(),
                "EXTERNAL_IDENTITY_OPERATION_COMPLETED", previous, completedStatus,
                "Microsoft Entra operation " + operation + " completed.");
    }

    private void publish(ExternalIdentityProvisioning record) {
        notificationRealtimeService.publishUserEvent(record.getUser().getId(), "external-identity-status-changed", toResponse(record));
        notificationRealtimeService.publishGlobalEvent("external-identity-status-changed");
    }

    private UserAccount requireActiveUser(UUID userId) {
        UserAccount user = userRepository.findById(userId).orElseThrow(() -> new IllegalArgumentException("User not found"));
        if (user.getStatus() != com.eqms.entity.UserStatus.Active) {
            throw new IllegalStateException("Microsoft Entra operations require an active EQMS user");
        }
        return user;
    }

    private ExternalIdentityProvisioning findOrCreateForUser(UserAccount user) {
        return repository.findByUser_Id(user.getId()).orElseGet(() -> {
            ExternalIdentityProvisioning record = new ExternalIdentityProvisioning();
            record.setUser(user);
            record.setEmailNormalized(user.getEmail().trim().toLowerCase());
            return record;
        });
    }

    private boolean hasPendingOperation(ExternalIdentityProvisioning record) {
        return StringUtils.hasText(record.getPendingOperation());
    }

    private void requireManagedGuest(ExternalIdentityProvisioning record) {
        if (!"EQMS_INVITED_GUEST".equals(record.getLifecycleOwnership()) || !"Guest".equalsIgnoreCase(record.getDirectoryUserType())) {
            throw new IllegalStateException("Microsoft Entra identity is not an EQMS-managed guest and cannot be changed");
        }
        if (!StringUtils.hasText(record.getObjectId())) {
            throw new IllegalStateException("Microsoft object ID is not available");
        }
    }

    private HttpRequest.Builder graphRequest(String path) throws Exception {
        return HttpRequest.newBuilder(URI.create(graphBase() + path)).timeout(Duration.ofSeconds(20))
                .header("Authorization", "Bearer " + token()).header("Accept", "application/json");
    }

    private void requireSuccess(HttpResponse<String> response) {
        if (response.statusCode() < 200 || response.statusCode() >= 300) {
            throw new IllegalStateException("Microsoft Graph request failed (HTTP " + response.statusCode() + ")");
        }
    }

    private String safeError(Exception error) {
        String message = error.getMessage();
        return StringUtils.hasText(message) ? message.substring(0, Math.min(message.length(), 1000)) : error.getClass().getSimpleName();
    }

    private ExternalIdentityProvisioningResponse notLinkedResponse(UUID userId) {
        UserAccount user = userRepository.findById(userId).orElseThrow(() -> new IllegalArgumentException("User not found"));
        return new ExternalIdentityProvisioningResponse(userId.toString(), user.getEmail(), PROVIDER, graphConfig().tenantId(), null, null,
                "NOT_LINKED", "Not linked", "slate", null, null, null, null, null, 0);
    }

    /**
     * Link Guest accounts that an administrator created directly in Entra before
     * EQMS provisioning was enabled. This only creates a local link; it never
     * sends an invitation or changes Microsoft permissions.
     */
    private synchronized void reconcileManualGuests(Collection<UUID> userIds) {
        // Reconcile the whole local directory, not just the currently visible
        // page. Otherwise an administrator would see “Not linked” until every
        // pagination page had been opened once.
        java.util.Set<UUID> linked = new java.util.HashSet<>(repository.findAllLinkedUserIds());
        List<UserAccount> candidates = userIds == null || userIds.isEmpty()
                ? userRepository.findAllByStatus(com.eqms.entity.UserStatus.Active)
                : userRepository.findAllById(userIds);
        List<UserAccount> missing = candidates.stream()
                .filter(u -> !linked.contains(u.getId()) && StringUtils.hasText(u.getEmail()))
                .toList();
        if (missing.isEmpty()) return;
        Instant now = Instant.now();
        if (lastManualReconciliationAt != null && Duration.between(lastManualReconciliationAt, now).getSeconds() < 60) return;
        lastManualReconciliationAt = now;
        final String graphToken;
        try { graphToken = token(); } catch (Exception ex) {
            log.warn("Microsoft Entra reconciliation skipped: {}", ex.getMessage());
            return;
        }
        try {
            // Read all directory pages and filter locally. This avoids relying on
            // tenant-specific OData filters and handles tenants larger than $top.
            List<JsonNode> directoryUsers = readDirectoryUsers(graphToken);
            log.info("Microsoft Entra reconciliation: {} local users missing a link, {} directory users loaded",
                    missing.size(), directoryUsers.size());
            for (UserAccount user : missing) {
                JsonNode guest = findGuest(directoryUsers, user.getEmail());
                if (guest == null) {
                    log.info("Microsoft Entra reconciliation: no directory-account match for {}", user.getEmail());
                    continue;
                }
                String email = user.getEmail().trim().toLowerCase();
                ExternalIdentityProvisioning record = new ExternalIdentityProvisioning();
                record.setUser(user); record.setEmailNormalized(email); record.setTenantId(graphConfig().tenantId());
                record.setObjectId(text(guest, "id"));
                boolean internalMember = "Member".equalsIgnoreCase(text(guest, "userType"));
                boolean acceptedGuest = "Accepted".equalsIgnoreCase(guest.path("externalUserState").asText());
                record.setDirectoryUserType(internalMember ? "Member" : "Guest");
                // Reconciliation only observes an account; it never proves EQMS created it.
                record.setLifecycleOwnership("EXTERNAL_LINKED");
                record.setStatus(internalMember ? "LINKED" : (acceptedGuest ? "REDEEMED" : "INVITED"));
                record.setInvitedAt(Instant.now()); record.setLastGraphCheckedAt(Instant.now());
                String changedAt = text(guest, "externalUserStateChangeDateTime");
                if ("REDEEMED".equals(record.getStatus()) || "LINKED".equals(record.getStatus())) record.setRedeemedAt(changedAt == null ? Instant.now() : Instant.parse(changedAt));
                try {
                    repository.save(record);
                    auditTrailService.logAs(resolveSystemActor(), "USER", user.getFullName(), user.getId(), "EXTERNAL_IDENTITY_RECONCILED", null,
                            record.getStatus(), "Existing Microsoft guest discovered and linked for " + email);
                    notificationRealtimeService.publishUserEvent(user.getId(), "external-identity-status-changed", toResponse(record));
                    notificationRealtimeService.publishGlobalEvent("external-identity-status-changed");
                } catch (Exception ignored) { /* another request may have linked it concurrently */ }
            }
        } catch (Exception ex) {
            // Reconciliation is best-effort, but retain a safe diagnostic so an
            // administrator can distinguish “not linked” from Graph auth/config errors.
            log.warn("Microsoft Entra reconciliation failed: {}", ex.getMessage());
        }
    }

    /**
     * Targeted single-email lookup used before sending a fresh invite — much cheaper than pulling
     * the whole directory (used by the background reconciliation job). Best-effort: any failure
     * (Graph unreachable, not configured, etc.) is swallowed so it never blocks a normal invite.
     */
    private JsonNode findExistingDirectoryUserSafely(String email) {
        try {
            String token = token();
            String filter = URLEncoder.encode("mail eq '" + email + "' or userPrincipalName eq '" + email + "'", StandardCharsets.UTF_8);
            HttpRequest request = HttpRequest.newBuilder(URI.create(graphBase()
                            + "/users?$filter=" + filter
                            + "&$select=id,mail,userPrincipalName,userType,externalUserState,externalUserStateChangeDateTime"))
                    .timeout(Duration.ofSeconds(20))
                    .header("Authorization", "Bearer " + token).header("Accept", "application/json").GET().build();
            HttpResponse<String> response = http.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() < 200 || response.statusCode() >= 300) return null;
            JsonNode values = mapper.readTree(response.body()).path("value");
            return values.isArray() && !values.isEmpty() ? values.get(0) : null;
        } catch (Exception ex) {
            log.debug("Pre-invite directory lookup skipped for {}: {}", email, ex.getMessage());
            return null;
        }
    }

    private List<JsonNode> readDirectoryUsers(String graphToken) throws Exception {
        List<JsonNode> users = new java.util.ArrayList<>();
        String next = graphBase() + "/users?$select=id,mail,userPrincipalName,userType,externalUserState,externalUserStateChangeDateTime,identities&$top=999";
        int pages = 0;
        while (StringUtils.hasText(next) && pages++ < 20) {
            HttpRequest request = HttpRequest.newBuilder(URI.create(next)).timeout(Duration.ofSeconds(20))
                    .header("Authorization", "Bearer " + graphToken).header("Accept", "application/json").GET().build();
            HttpResponse<String> response = http.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                log.warn("Microsoft Graph directory lookup failed with HTTP {}", response.statusCode());
                throw new IllegalStateException("Microsoft Graph directory lookup failed (HTTP " + response.statusCode() + ")");
            }
            JsonNode body = mapper.readTree(response.body());
            body.path("value").forEach(users::add);
            next = text(body, "@odata.nextLink");
        }
        return users;
    }

    private JsonNode findGuest(Collection<JsonNode> values, String email) {
        String normalized = email.trim().toLowerCase();
        String normalizedKey = normalized.replaceAll("[^a-z0-9]", "");
        for (JsonNode guest : values) {
            // Existing Entra identities can be internal Members or external
            // Guests. Both are valid links for an EQMS account.
            String userType = text(guest, "userType");
            if (StringUtils.hasText(userType)
                    && !"Guest".equalsIgnoreCase(userType)
                    && !"Member".equalsIgnoreCase(userType)) continue;
            String mail = text(guest, "mail");
            if (mail != null && normalizedKey.equals(mail.toLowerCase().replaceAll("[^a-z0-9]", ""))) return guest;
            String upn = text(guest, "userPrincipalName");
            String upnPrefix = upn == null ? null : upn.toLowerCase().split("#ext#", 2)[0];
            if (upnPrefix != null && normalizedKey.equals(upnPrefix.replaceAll("[^a-z0-9]", ""))) return guest;
            JsonNode identities = guest.path("identities");
            if (identities.isArray()) {
                for (JsonNode identity : identities) {
                    String assigned = text(identity, "issuerAssignedId");
                    if (assigned != null && normalizedKey.equals(assigned.toLowerCase().replaceAll("[^a-z0-9]", ""))) return guest;
                }
            }
        }
        return null;
    }

    /** Refresh pending invitations from Microsoft Graph at a bounded cadence. */
    private void refreshRedeemedState(List<ExternalIdentityProvisioning> records) {
        Instant now = Instant.now();
        List<ExternalIdentityProvisioning> pending = records.stream()
                .filter(r -> "INVITED".equals(r.getStatus()) && StringUtils.hasText(r.getObjectId()))
                .filter(r -> r.getLastGraphCheckedAt() == null
                        || Duration.between(r.getLastGraphCheckedAt(), now).getSeconds() >= 30)
                .toList();
        if (pending.isEmpty()) return;

        final String graphToken;
        try {
            graphToken = token();
        } catch (Exception ignored) {
            return;
        }
        for (ExternalIdentityProvisioning record : pending) {
            record.setLastGraphCheckedAt(now);
            try {
                HttpRequest request = HttpRequest.newBuilder(URI.create(graphBase() + "/users/" + enc(record.getObjectId())
                                + "?$select=id,externalUserState,externalUserStateChangeDateTime,accountEnabled,userType"))
                        .timeout(Duration.ofSeconds(20))
                        .header("Authorization", "Bearer " + graphToken)
                        .header("Accept", "application/json")
                        .GET().build();
                HttpResponse<String> response = http.send(request, HttpResponse.BodyHandlers.ofString());
                if (response.statusCode() >= 200 && response.statusCode() < 300) {
                    JsonNode user = mapper.readTree(response.body());
                    if ("Accepted".equalsIgnoreCase(user.path("externalUserState").asText())) {
                        record.setStatus("REDEEMED");
                        String changedAt = text(user, "externalUserStateChangeDateTime");
                        record.setRedeemedAt(changedAt == null ? now : Instant.parse(changedAt));
                        auditTrailService.logAs(resolveSystemActor(), "USER", record.getUser().getFullName(), record.getUser().getId(),
                                "EXTERNAL_INVITATION_REDEEMED", "INVITED", "REDEEMED",
                                "Microsoft guest accepted the invitation for " + record.getEmailNormalized());
                        notificationRealtimeService.publishUserEvent(record.getUser().getId(),
                                "external-identity-status-changed", toResponse(record));
                        notificationRealtimeService.publishGlobalEvent("external-identity-status-changed");
                        notifyAdminsOfRedemption(record.getUser(), record);
                    }
                }
                repository.save(record);
            } catch (Exception ignored) {
                // Keep the last known state on transient Graph failures.
                repository.save(record);
            }
        }
    }

    @Transactional
    public ExternalIdentityProvisioningResponse disable(UUID userId, ExternalIdentityActionRequest request) {
        requirePermission("users.disable_microsoft_access");
        ExternalIdentityProvisioning record = repository.findByUser_Id(userId).orElseThrow(() -> new IllegalArgumentException("External provisioning not found"));
        requireManagedGuest(record);
        if (hasPendingOperation(record) || !("INVITED".equals(record.getStatus()) || "REDEEMED".equals(record.getStatus()))) {
            throw new IllegalStateException("Microsoft access can only be disabled for an active EQMS-managed guest");
        }
        return enqueue(record, "DISABLE", request.reason(), "DISABLE_PENDING");
    }

    /**
     * Cascade hook for suspend/terminate (called from {@code UserManagementService.changeUserStatus}).
     * Unlike {@link #disable}, this skips the interactive permission check — the caller has
     * already authorized the status change via {@code settings.user.edit} — and no-ops instead
     * of throwing if the user was never provisioned to Microsoft or is already disabled/removed.
     */
    @Transactional
    public void disableForStatusChange(UUID userId) {
        ExternalIdentityProvisioning record = repository.findByUser_Id(userId).orElse(null);
        if (record == null || hasPendingOperation(record) || !"EQMS_INVITED_GUEST".equals(record.getLifecycleOwnership())
                || !"Guest".equalsIgnoreCase(record.getDirectoryUserType())
                || !("INVITED".equals(record.getStatus()) || "REDEEMED".equals(record.getStatus()))) {
            return;
        }
        enqueue(record, "DISABLE", "EQMS account status changed", "DISABLE_PENDING");
    }

    /**
     * Permanently deletes the guest object from Microsoft Entra (irreversible — unlike
     * {@link #disable}, which only revokes sign-in). The local record is retained for audit
     * history but reset so the user can be invited fresh afterward.
     */
    @Transactional
    public ExternalIdentityProvisioningResponse remove(UUID userId, ExternalIdentityActionRequest request) {
        requirePermission("users.remove_external_identity");
        ExternalIdentityProvisioning record = repository.findByUser_Id(userId).orElseThrow(() -> new IllegalArgumentException("External provisioning not found"));
        requireManagedGuest(record);
        if (hasPendingOperation(record) || !("DISABLED".equals(record.getStatus()) || "FAILED".equals(record.getStatus()))) {
            throw new IllegalStateException("An EQMS-managed guest must be disabled before it can be removed");
        }
        return enqueue(record, "REMOVE", request.reason(), "REMOVE_PENDING");
    }

    private JsonNode callInvitation(String email, boolean resetRedemption) throws Exception {
        String token = token();
        Map<String, Object> body = new java.util.LinkedHashMap<>(); body.put("invitedUserEmailAddress", email);
        body.put("inviteRedirectUrl", inviteRedirectUrl);
        body.put("sendInvitationMessage", true);
        if (resetRedemption) body.put("resetRedemption", true);
        HttpRequest request = HttpRequest.newBuilder(URI.create(graphBase() + "/invitations")).timeout(Duration.ofSeconds(20))
                .header("Authorization", "Bearer " + token).header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(mapper.writeValueAsString(body))).build();
        HttpResponse<String> response = http.send(request, HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() < 200 || response.statusCode() >= 300) throw new IllegalStateException(response.body());
        return mapper.readTree(response.body());
    }
    private String token() throws Exception {
        Instant now = Instant.now();
        if (StringUtils.hasText(cachedGraphToken) && cachedGraphTokenExpiresAt != null && cachedGraphTokenExpiresAt.isAfter(now.plusSeconds(60))) {
            return cachedGraphToken;
        }
        OfficeOnlineConfigurationService.OfficeOnlineConfiguration config = graphConfig();
        if (!StringUtils.hasText(config.tenantId()) || !StringUtils.hasText(config.clientId()) || !StringUtils.hasText(config.clientSecret())) throw new IllegalStateException("Microsoft Graph credentials are not configured");
        String form = "client_id=" + enc(config.clientId()) + "&client_secret=" + enc(config.clientSecret()) + "&scope=" + enc("https://graph.microsoft.com/.default") + "&grant_type=client_credentials";
        HttpRequest request = HttpRequest.newBuilder(URI.create("https://login.microsoftonline.com/" + enc(config.tenantId()) + "/oauth2/v2.0/token"))
                .timeout(Duration.ofSeconds(20)).header("Content-Type", "application/x-www-form-urlencoded").POST(HttpRequest.BodyPublishers.ofString(form)).build();
        HttpResponse<String> response = http.send(request, HttpResponse.BodyHandlers.ofString());
        JsonNode result = mapper.readTree(response.body());
        if (response.statusCode() < 200 || response.statusCode() >= 300 || !StringUtils.hasText(text(result, "access_token"))) {
            log.warn("Microsoft Graph token request failed with HTTP {} and error {}", response.statusCode(), text(result, "error"));
            throw new IllegalStateException("Microsoft Graph token request failed (HTTP " + response.statusCode() + ")");
        }
        cachedGraphToken = text(result, "access_token");
        cachedGraphTokenExpiresAt = now.plusSeconds(Math.max(60, result.path("expires_in").asLong(3600) - 60));
        return cachedGraphToken;
    }
    private OfficeOnlineConfigurationService.OfficeOnlineConfiguration graphConfig() { return officeOnlineConfigurationService.getEffectiveConfiguration(); }
    private String graphBase() { String baseUrl = graphConfig().graphBaseUrl(); return StringUtils.hasText(baseUrl) ? baseUrl.replaceAll("/$", "") : "https://graph.microsoft.com/v1.0"; }
    private String enc(String value) { return URLEncoder.encode(value, StandardCharsets.UTF_8); }
    private String text(JsonNode node, String key) { String value = node == null ? null : node.path(key).asText(null); return StringUtils.hasText(value) ? value : null; }
    private void requirePermission(String code) { if (!permissionEvaluationService.hasPermission(currentUserService.requireCurrentUser(), code)) throw new AccessDeniedException("Permission required: " + code); }
    private String instant(Instant value) { return value == null ? null : value.toString(); }
    private ExternalIdentityProvisioningResponse toResponse(ExternalIdentityProvisioning r) {
        String label = switch (r.getStatus()) {
            case "INVITE_PENDING" -> "Microsoft invitation is being processed";
            case "LINKED" -> "Microsoft account linked";
            case "REDEEMED" -> "Microsoft guest active";
            case "INVITED" -> "Microsoft invitation sent";
            case "FAILED" -> "Microsoft provisioning failed";
            case "DISABLED" -> "Microsoft access disabled";
            case "DISABLE_PENDING" -> "Microsoft access disable is being processed";
            case "REMOVED" -> "Microsoft guest removed";
            case "REMOVE_PENDING" -> "Microsoft guest removal is being processed";
            default -> "Not linked";
        };
        String color = switch (r.getStatus()) {
            case "LINKED" -> "emerald";
            case "REDEEMED" -> "emerald";
            case "INVITED" -> "blue";
            case "INVITE_PENDING", "DISABLE_PENDING", "REMOVE_PENDING" -> "amber";
            case "FAILED" -> "red";
            default -> "slate";
        };
        return new ExternalIdentityProvisioningResponse(r.getUser().getId().toString(), r.getEmailNormalized(), r.getProvider(), r.getTenantId(), r.getObjectId(), r.getInvitationId(), r.getStatus(), label, color, instant(r.getInvitedAt()), instant(r.getRedeemedAt()), instant(r.getDisabledAt()), r.getLastErrorCode(), r.getLastErrorMessage(), r.getAttemptCount());
    }
}
