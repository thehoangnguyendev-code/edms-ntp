package com.eqms.service;

import com.eqms.auth.CurrentUserService;
import com.eqms.auth.TokenService;
import com.eqms.auth.UnauthorizedException;
import com.eqms.dto.user.CancelTimeLimitedUserGrantRequest;
import com.eqms.dto.user.CreateTimeLimitedUserGrantRequest;
import com.eqms.dto.user.PageResponse;
import com.eqms.dto.user.PaginationResponse;
import com.eqms.dto.user.TimeLimitedUserGrantResponse;
import com.eqms.dto.user.UpdateTimeLimitedUserGrantRequest;
import com.eqms.entity.ElectronicSignature;
import com.eqms.entity.TimeLimitedUserGrant;
import com.eqms.entity.UserAccount;
import com.eqms.entity.UserStatus;
import com.eqms.repository.TimeLimitedUserGrantRepository;
import com.eqms.repository.UserAccountRepository;
import jakarta.persistence.criteria.Predicate;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * "Time-Limited User": restricts one or many user accounts to being login-eligible only within a
 * chosen [startDate, endDate] window, with an optional expiry e-mail. One grant row per user, even
 * when several users are selected in a single "Create" submission -- the list screen must show the
 * correct record count, never a merged row.
 *
 * Enforcement reuses {@link UserStatus#Suspended} (via {@link UserManagementService#changeUserStatus})
 * rather than introducing a new account status or touching the two login-gate checks in
 * {@code AuthService}/{@code AuthTokenFilter}, which already correctly block any non-Active user.
 * {@link UserAccount#getTimeLimitedGrantId()} marks which grant (if any) is the reason a user is
 * currently Suspended, so the scheduler only ever auto-reinstates a user it auto-suspended itself --
 * a user suspended manually by an admin for an unrelated reason is never touched.
 */
@Service
public class TimeLimitedUserGrantService {

    private static final String SIGNATURE_MEANING = "TIME_LIMITED_USER_GRANT";

    private final TimeLimitedUserGrantRepository grantRepository;
    private final UserAccountRepository userRepository;
    private final CurrentUserService currentUserService;
    private final TokenService tokenService;
    private final ElectronicSignatureService electronicSignatureService;
    private final AuthAuditService auditService;
    private final AuditTrailService auditTrailService;
    private final UserManagementService userManagementService;
    private final NotificationDispatcher notificationDispatcher;

    public TimeLimitedUserGrantService(
            TimeLimitedUserGrantRepository grantRepository,
            UserAccountRepository userRepository,
            CurrentUserService currentUserService,
            TokenService tokenService,
            ElectronicSignatureService electronicSignatureService,
            AuthAuditService auditService,
            AuditTrailService auditTrailService,
            UserManagementService userManagementService,
            NotificationDispatcher notificationDispatcher
    ) {
        this.grantRepository = grantRepository;
        this.userRepository = userRepository;
        this.currentUserService = currentUserService;
        this.tokenService = tokenService;
        this.electronicSignatureService = electronicSignatureService;
        this.auditService = auditService;
        this.auditTrailService = auditTrailService;
        this.userManagementService = userManagementService;
        this.notificationDispatcher = notificationDispatcher;
    }

    // ── List (server-side filter/search/sort/pagination) ───────────────────────

    @Transactional(readOnly = true)
    public PageResponse<TimeLimitedUserGrantResponse> getGrants(
            int page, int limit, String search, String status, String sortBy, String sortDirection,
            String startDateFrom, String startDateTo,
            String endDateFrom, String endDateTo,
            String createdFrom, String createdTo
    ) {
        int safePage = Math.max(page, 1);
        int safeLimit = Math.min(Math.max(limit, 1), 200);
        Sort.Direction direction = "asc".equalsIgnoreCase(sortDirection) ? Sort.Direction.ASC : Sort.Direction.DESC;
        String sortProperty = resolveSortProperty(sortBy);
        var pageable = PageRequest.of(safePage - 1, safeLimit, Sort.by(direction, sortProperty));
        var spec = buildSpecification(search, status, startDateFrom, startDateTo, endDateFrom, endDateTo, createdFrom, createdTo);
        var result = grantRepository.findAll(spec, pageable);
        List<TimeLimitedUserGrantResponse> data = result.getContent().stream().map(this::toResponse).toList();
        return new PageResponse<>(data, new PaginationResponse(safePage, safeLimit, result.getTotalElements(), result.getTotalPages()));
    }

    /** Returns the current grant record for an independent detail/edit screen. */
    @Transactional(readOnly = true)
    public TimeLimitedUserGrantResponse getGrant(UUID grantId) {
        return toResponse(grantRepository.findById(grantId)
                .orElseThrow(() -> new IllegalArgumentException("Grant not found")));
    }

    /** All filters (search/status/date-ranges) run server-side; the FE only forwards params and
     *  renders what comes back. Start/End Date Range filters and Created Range are date-only
     *  ("yyyy-MM-dd", inclusive of the whole "to" day) even though the grant's own startAt/endAt
     *  columns now carry a time-of-day -- filtering stays day-granularity, matching every other
     *  date-range filter in this feature area. */
    private Specification<TimeLimitedUserGrant> buildSpecification(
            String search, String status,
            String startDateFrom, String startDateTo,
            String endDateFrom, String endDateTo,
            String createdFrom, String createdTo
    ) {
        return (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (StringUtils.hasText(status)) {
                predicates.add(cb.equal(root.get("status"), status.toUpperCase()));
            }
            if (StringUtils.hasText(search)) {
                String like = "%" + search.trim().toLowerCase() + "%";
                var userJoin = root.join("user");
                predicates.add(cb.or(
                        cb.like(cb.lower(userJoin.get("fullName")), like),
                        cb.like(cb.lower(userJoin.get("username")), like),
                        cb.like(cb.lower(userJoin.get("email")), like),
                        cb.like(cb.lower(cb.coalesce(userJoin.get("employeeCode"), "")), like)
                ));
            }
            if (StringUtils.hasText(startDateFrom)) {
                parseLocalDate(startDateFrom).ifPresent(d -> predicates.add(cb.greaterThanOrEqualTo(root.get("startAt"), startOfDayUtc(d))));
            }
            if (StringUtils.hasText(startDateTo)) {
                parseLocalDate(startDateTo).ifPresent(d -> predicates.add(cb.lessThanOrEqualTo(root.get("startAt"), endOfDayUtc(d))));
            }
            if (StringUtils.hasText(endDateFrom)) {
                parseLocalDate(endDateFrom).ifPresent(d -> predicates.add(cb.greaterThanOrEqualTo(root.get("endAt"), startOfDayUtc(d))));
            }
            if (StringUtils.hasText(endDateTo)) {
                parseLocalDate(endDateTo).ifPresent(d -> predicates.add(cb.lessThanOrEqualTo(root.get("endAt"), endOfDayUtc(d))));
            }
            if (StringUtils.hasText(createdFrom)) {
                parseLocalDate(createdFrom).ifPresent(d -> predicates.add(cb.greaterThanOrEqualTo(root.get("createdAt"), startOfDayUtc(d))));
            }
            if (StringUtils.hasText(createdTo)) {
                parseLocalDate(createdTo).ifPresent(d -> predicates.add(cb.lessThanOrEqualTo(root.get("createdAt"), endOfDayUtc(d))));
            }
            return cb.and(predicates.toArray(new Predicate[0]));
        };
    }

    private Instant startOfDayUtc(LocalDate d) {
        return d.atStartOfDay(java.time.ZoneOffset.UTC).toInstant();
    }

    private Instant endOfDayUtc(LocalDate d) {
        return d.plusDays(1).atStartOfDay(java.time.ZoneOffset.UTC).minusNanos(1).toInstant();
    }

    private java.util.Optional<LocalDate> parseLocalDate(String value) {
        try {
            return java.util.Optional.of(LocalDate.parse(value.trim()));
        } catch (Exception ex) {
            return java.util.Optional.empty();
        }
    }

    private String resolveSortProperty(String sortBy) {
        if (sortBy == null) return "createdAt";
        return switch (sortBy) {
            case "fullName" -> "user.fullName";
            case "username" -> "user.username";
            case "email" -> "user.email";
            case "startDate" -> "startAt";
            case "endDate" -> "endAt";
            case "status" -> "status";
            default -> "createdAt";
        };
    }

    private TimeLimitedUserGrantResponse toResponse(TimeLimitedUserGrant grant) {
        UserAccount user = grant.getUser();
        Instant now = Instant.now();
        String windowState;
        if ("CANCELLED".equals(grant.getStatus())) {
            windowState = "CANCELLED";
        } else if ("EXPIRED".equals(grant.getStatus()) || now.isAfter(grant.getEndAt())) {
            windowState = "EXPIRED";
        } else if (now.isBefore(grant.getStartAt())) {
            windowState = "PENDING";
        } else {
            windowState = "IN_WINDOW";
        }
        return new TimeLimitedUserGrantResponse(
                grant.getId(), user.getId(), user.getEmployeeCode(), user.getFullName(), user.getUsername(), user.getEmail(),
                grant.getStartAt(), grant.getEndAt(), grant.isNotifyEmailOnExpiry(), grant.getNotifiedAt(), grant.getReason(),
                grant.getStatus(), windowState,
                grant.getCreatedBy() != null ? grant.getCreatedBy().getFullName() : null, grant.getCreatedAt(),
                grant.getCancelledBy() != null ? grant.getCancelledBy().getFullName() : null, grant.getCancelledAt(),
                grant.getCancelReason()
        );
    }

    // ── Create (bulk -- one row per selected user, never merged) ───────────────

    @Transactional
    public List<TimeLimitedUserGrantResponse> createGrants(CreateTimeLimitedUserGrantRequest request, HttpServletRequest httpRequest) {
        if (request.endAt().isBefore(request.startAt())) {
            throw new IllegalArgumentException("End date/time must be on or after start date/time");
        }
        UserAccount actor = currentUserService.requireCurrentUser();
        requireValidActionSignature(actor, request.signatureToken());

        List<UUID> distinctUserIds = request.userIds().stream().distinct().toList();
        List<UserAccount> targets = userRepository.findAllById(distinctUserIds);
        if (targets.size() != distinctUserIds.size()) {
            throw new IllegalArgumentException("One or more selected users could not be found");
        }
        if (targets.stream().anyMatch(target -> grantRepository.existsByUser_IdAndStatus(
                target.getId(), TimeLimitedUserGrant.STATUS_ACTIVE))) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "One or more selected users already have an active time-limited access grant");
        }

        // One electronic signature covers the whole bulk action (the token is single-use); every
        // grant row created from this submission references that same signature.
        UUID batchAnchorId = UUID.randomUUID();
        ElectronicSignature signature = electronicSignatureService.createEntitySignature(
                "TIME_LIMITED_USER_GRANT_BATCH", batchAnchorId, "Time-Limited User grant (" + targets.size() + " user(s))",
                actor, request.signatureToken(), SIGNATURE_MEANING,
                request.reason(), null, null,
                request.startAt() + " to " + request.endAt()
        );

        List<TimeLimitedUserGrantResponse> created = new ArrayList<>();
        for (UserAccount target : targets) {
            TimeLimitedUserGrant grant = new TimeLimitedUserGrant();
            grant.setUser(target);
            grant.setStartAt(request.startAt());
            grant.setEndAt(request.endAt());
            grant.setNotifyEmailOnExpiry(request.notifyEmailOnExpiry());
            grant.setReason(request.reason());
            grant.setStatus(TimeLimitedUserGrant.STATUS_ACTIVE);
            grant.setSignatureId(signature == null ? null : signature.getId());
            grant.setCreatedBy(actor);
            grant = grantRepository.save(grant);

            auditService.log("time_limited_user_grant_created", target, Map.of(
                    "grantId", grant.getId().toString(),
                    "startAt", grant.getStartAt().toString(),
                    "endAt", grant.getEndAt().toString(),
                    "notifyEmailOnExpiry", grant.isNotifyEmailOnExpiry()
            ), clientIp(httpRequest), userAgent(httpRequest));
            auditTrailService.logAs(
                    actor, "USER", target.getFullName(), target.getId(), "TIME_LIMITED_USER_GRANT_CREATED",
                    null, TimeLimitedUserGrant.STATUS_ACTIVE,
                    "Time-limited access window: " + grant.getStartAt() + " to " + grant.getEndAt(),
                    List.of(), signature == null ? null : signature.getId()
            );

            // Applies immediately if "now" already falls outside the window (e.g. a future start
            // date) instead of waiting for the next scheduler tick.
            applyWindowState(grant, target);
            created.add(toResponse(grant));
        }
        return created;
    }

    // ── Cancel (early revoke -- status change only, never deleted, GMP data integrity) ─────────

    @Transactional
    public TimeLimitedUserGrantResponse cancelGrant(UUID grantId, CancelTimeLimitedUserGrantRequest request, HttpServletRequest httpRequest) {
        UserAccount actor = currentUserService.requireCurrentUser();
        requireValidActionSignature(actor, request.signatureToken());

        TimeLimitedUserGrant grant = grantRepository.findById(grantId)
                .orElseThrow(() -> new IllegalArgumentException("Grant not found"));
        if (!TimeLimitedUserGrant.STATUS_ACTIVE.equals(grant.getStatus())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Only an active grant can be cancelled");
        }
        UserAccount target = grant.getUser();

        ElectronicSignature signature = electronicSignatureService.createEntitySignature(
                "TIME_LIMITED_USER_GRANT", grant.getId(), target.getFullName(), actor, request.signatureToken(),
                SIGNATURE_MEANING, request.reason(), null, TimeLimitedUserGrant.STATUS_ACTIVE, TimeLimitedUserGrant.STATUS_CANCELLED
        );

        grant.setStatus(TimeLimitedUserGrant.STATUS_CANCELLED);
        grant.setCancelledBy(actor);
        grant.setCancelledAt(Instant.now());
        grant.setCancelReason(request.reason());
        grant = grantRepository.save(grant);

        auditService.log("time_limited_user_grant_cancelled", target, Map.of(
                "grantId", grant.getId().toString(), "reason", request.reason()
        ), clientIp(httpRequest), userAgent(httpRequest));
        auditTrailService.logAs(
                actor, "USER", target.getFullName(), target.getId(), "TIME_LIMITED_USER_GRANT_CANCELLED",
                TimeLimitedUserGrant.STATUS_ACTIVE, TimeLimitedUserGrant.STATUS_CANCELLED,
                "Cancelled: " + request.reason(), List.of(), signature == null ? null : signature.getId()
        );

        // If this exact grant is the reason the user is currently suspended, reinstate them now
        // rather than waiting for the nightly scheduler -- an admin manually-suspended user is
        // never touched here (marker only matches when the scheduler itself set it).
        if (target.getTimeLimitedGrantId() != null && target.getTimeLimitedGrantId().equals(grant.getId())
                && target.getStatus() == UserStatus.Suspended) {
            target.setTimeLimitedGrantId(null);
            userManagementService.changeUserStatus(target, UserStatus.Active);
            userRepository.save(target);
        }
        return toResponse(grant);
    }

    /**
     * Amend an active grant's effective window. The signature, grant mutation, audit entries and
     * immediate account-state re-evaluation are one transaction so a signed change cannot leave
     * the access window and account status out of sync.
     */
    @Transactional
    public TimeLimitedUserGrantResponse updateGrant(UUID grantId, UpdateTimeLimitedUserGrantRequest request, HttpServletRequest httpRequest) {
        if (request.endAt().isBefore(request.startAt())) {
            throw new IllegalArgumentException("End date/time must be on or after start date/time");
        }
        UserAccount actor = currentUserService.requireCurrentUser();
        requireValidActionSignature(actor, request.signatureToken());

        TimeLimitedUserGrant grant = grantRepository.findById(grantId)
                .orElseThrow(() -> new IllegalArgumentException("Grant not found"));
        if (!TimeLimitedUserGrant.STATUS_ACTIVE.equals(grant.getStatus())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Only an active grant can be updated");
        }

        UserAccount target = grant.getUser();
        Instant previousStartAt = grant.getStartAt();
        Instant previousEndAt = grant.getEndAt();
        boolean previousNotifyOnExpiry = grant.isNotifyEmailOnExpiry();
        ElectronicSignature signature = electronicSignatureService.createEntitySignature(
                "TIME_LIMITED_USER_GRANT", grant.getId(), target.getFullName(), actor, request.signatureToken(),
                SIGNATURE_MEANING, request.reason(), null, TimeLimitedUserGrant.STATUS_ACTIVE, TimeLimitedUserGrant.STATUS_ACTIVE
        );

        grant.setStartAt(request.startAt());
        grant.setEndAt(request.endAt());
        grant.setNotifyEmailOnExpiry(request.notifyEmailOnExpiry());
        grant.setReason(request.reason());
        // A previous expiry notification describes the old window and must not suppress the
        // notification for a newly amended window.
        if (!previousEndAt.equals(request.endAt())) {
            grant.setNotifiedAt(null);
        }
        grant = grantRepository.save(grant);

        auditService.log("time_limited_user_grant_updated", target, Map.of(
                "grantId", grant.getId().toString(),
                "previousStartAt", previousStartAt.toString(),
                "previousEndAt", previousEndAt.toString(),
                "startAt", grant.getStartAt().toString(),
                "endAt", grant.getEndAt().toString(),
                "previousNotifyEmailOnExpiry", previousNotifyOnExpiry,
                "notifyEmailOnExpiry", grant.isNotifyEmailOnExpiry()
        ), clientIp(httpRequest), userAgent(httpRequest));
        auditTrailService.logAs(
                actor, "USER", target.getFullName(), target.getId(), "TIME_LIMITED_USER_GRANT_UPDATED",
                TimeLimitedUserGrant.STATUS_ACTIVE, TimeLimitedUserGrant.STATUS_ACTIVE,
                "Time-limited access window amended: " + previousStartAt + " to " + previousEndAt
                        + " → " + grant.getStartAt() + " to " + grant.getEndAt(),
                List.of(), signature == null ? null : signature.getId()
        );

        applyWindowState(grant, target);
        return toResponse(grant);
    }

    /** Suspends/reinstates {@code target} immediately if "now" already falls outside/inside the
     *  grant's window -- used right after creation so the effect isn't deferred to the next
     *  scheduler tick. Package-private so {@link TimeLimitedUserGrantScheduler} can reuse the
     *  exact same rule for its nightly pass. */
    void applyWindowState(TimeLimitedUserGrant grant, UserAccount user) {
        Instant now = Instant.now();
        boolean inWindow = !now.isBefore(grant.getStartAt()) && !now.isAfter(grant.getEndAt());
        boolean expired = now.isAfter(grant.getEndAt());

        if (expired) {
            if (TimeLimitedUserGrant.STATUS_ACTIVE.equals(grant.getStatus())) {
                grant.setStatus(TimeLimitedUserGrant.STATUS_EXPIRED);
                grantRepository.save(grant);
            }
            suspendForGrant(user, grant);
            if (grant.isNotifyEmailOnExpiry() && grant.getNotifiedAt() == null) {
                notificationDispatcher.dispatch("user.time_limited_access_expired", List.of(user), Map.<String, String>of(
                        "endDate", grant.getEndAt().toString()
                ));
                grant.setNotifiedAt(Instant.now());
                grantRepository.save(grant);
            }
            return;
        }
        if (!inWindow) {
            // Before the window opens.
            suspendForGrant(user, grant);
            return;
        }
        // Inside the window -- reinstate only if this exact grant is the reason the user is
        // currently suspended (never touches a manual/unrelated suspension).
        if (user.getTimeLimitedGrantId() != null && user.getTimeLimitedGrantId().equals(grant.getId())
                && user.getStatus() == UserStatus.Suspended) {
            user.setTimeLimitedGrantId(null);
            userManagementService.changeUserStatus(user, UserStatus.Active);
            userRepository.save(user);
        }
    }

    private void suspendForGrant(UserAccount user, TimeLimitedUserGrant grant) {
        if (user.getStatus() == UserStatus.Suspended) {
            // A pre-existing suspension is not owned by this grant.  In particular, do not add
            // a marker to a manually suspended account: a later in-window pass must never
            // auto-reinstate it. A matching marker simply means this grant already suspended it.
            return;
        }
        if (user.getStatus() != UserStatus.Active) {
            // Inactive/Pending/Terminated -- outside this feature's scope, leave untouched.
            return;
        }
        user.setTimeLimitedGrantId(grant.getId());
        userManagementService.changeUserStatus(user, UserStatus.Suspended);
        user.setSuspendReason("Time-limited access window (" + grant.getStartAt() + " to " + grant.getEndAt() + ")");
        userRepository.save(user);
    }

    private void requireValidActionSignature(UserAccount actor, String signatureToken) {
        if (signatureToken == null || signatureToken.isBlank()) {
            throw new IllegalArgumentException("Signature token is required");
        }
        var claims = tokenService.parseSignatureToken(signatureToken)
                .orElseThrow(() -> new UnauthorizedException("Invalid signature token"));
        if (!claims.principal().userId().equals(actor.getId())) {
            throw new UnauthorizedException("Signature token does not belong to current user");
        }
    }

    private String clientIp(HttpServletRequest request) {
        if (request == null) return null;
        String forwarded = request.getHeader("X-Forwarded-For");
        return StringUtils.hasText(forwarded) ? forwarded.split(",")[0].trim() : request.getRemoteAddr();
    }

    private String userAgent(HttpServletRequest request) {
        return request == null ? null : request.getHeader("User-Agent");
    }
}
