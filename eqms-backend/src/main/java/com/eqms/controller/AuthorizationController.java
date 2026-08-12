package com.eqms.controller;

import com.eqms.auth.CurrentUserService;
import com.eqms.dto.security.AuthorizationEvaluateRequest;
import com.eqms.dto.security.AuthorizationRelationDefinitionResponse;
import com.eqms.dto.user.PageResponse;
import com.eqms.entity.AuthorizationRelationDefinition;
import com.eqms.entity.UserAccount;
import com.eqms.repository.AuthorizationRelationDefinitionRepository;
import com.eqms.repository.UserAccountRepository;
import com.eqms.service.PermissionEvaluationService;
import com.eqms.service.authorization.AuthorizationDecision;
import com.eqms.service.authorization.AuthorizationEngineService;
import com.eqms.service.authorization.AuthorizationRequest;
import com.eqms.util.PagedList;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.*;

import java.util.Comparator;
import java.util.List;
import java.util.Locale;

/**
 * New unified authorization API (SECURITY_AUTHORIZATION_HYBRID_REFACTOR_PLAN.md §5.2), running
 * alongside the existing {@code /security/*} endpoints -- not a replacement. Scoped to what is
 * actually useful before any {@code ResourceAuthorizationAdapter} exists: the admin simulator
 * (so the engine's permission+scope+relation logic can already be exercised and shadow-tested
 * once module adapters land in Phase 1-2+) and read access to the relation catalog from Phase 0.3.
 * CRUD for access-profiles/permission-sets/scope-rules/object-grants/workflow-policies/sod-rules
 * already exists under {@code /security/*} and is deliberately NOT duplicated here yet -- that
 * consolidation belongs to the Phase 4 Authorization Console cutover, not Phase 0 scaffolding.
 */
@RestController
@RequestMapping("/authorization")
public class AuthorizationController {

    private final AuthorizationEngineService engine;
    private final AuthorizationRelationDefinitionRepository relationDefinitionRepository;
    private final CurrentUserService currentUserService;
    private final PermissionEvaluationService permissionEvaluationService;
    private final UserAccountRepository userAccountRepository;

    public AuthorizationController(
            AuthorizationEngineService engine,
            AuthorizationRelationDefinitionRepository relationDefinitionRepository,
            CurrentUserService currentUserService,
            PermissionEvaluationService permissionEvaluationService,
            UserAccountRepository userAccountRepository
    ) {
        this.engine = engine;
        this.relationDefinitionRepository = relationDefinitionRepository;
        this.currentUserService = currentUserService;
        this.permissionEvaluationService = permissionEvaluationService;
        this.userAccountRepository = userAccountRepository;
    }

    /** Admin simulator -- evaluates a decision without executing any mutation. */
    @PostMapping("/evaluate")
    public AuthorizationDecision evaluate(@RequestBody AuthorizationEvaluateRequest request) {
        UserAccount caller = currentUserService.requireCurrentUser();
        // Same governance-scope gate as the pre-existing EffectiveAccessDiagnosisService
        // simulator -- this is its successor entry point, not a separate feature with looser
        // access.
        if (!permissionEvaluationService.hasPermission(caller, "security.access_profiles.update")) {
            throw new AccessDeniedException("Access profile management permission required");
        }
        UserAccount subject = userAccountRepository.findById(request.subjectUserId())
                .orElseThrow(() -> new IllegalArgumentException("Subject user not found"));
        return engine.authorize(new AuthorizationRequest(
                subject, request.resourceType(), request.resourceId(), request.actionCode(), request.context()));
    }

    /** Read-only relation catalog (SECURITY_AUTHORIZATION_HYBRID_REFACTOR_PLAN.md §5.3 "Relation Definitions"). */
    @GetMapping("/relation-definitions")
    public List<AuthorizationRelationDefinitionResponse> relationDefinitions(
            @RequestParam(required = false) String resourceType
    ) {
        UserAccount caller = currentUserService.requireCurrentUser();
        // Uses the actually-deployed permission code, not the target catalog's
        // "security.workflow_policies.*" (SECURITY_AUTHORIZATION_HYBRID_REFACTOR_PLAN.md §1.1
        // rule 7: never rename a deployed permission just to match the document).
        if (!permissionEvaluationService.hasAnyPermission(caller,
                "security.workflow_authorization.view", "security.workflow_authorization.manage")) {
            throw new AccessDeniedException("Workflow authorization view permission required");
        }
        var rows = StringUtils.hasText(resourceType)
                ? relationDefinitionRepository.findAllByResourceTypeAndActiveTrueOrderByCodeAsc(resourceType)
                : relationDefinitionRepository.findAllByOrderByResourceTypeAscCodeAsc();
        return rows.stream().map(AuthorizationRelationDefinitionResponse::from).toList();
    }

    /** Paginated/sortable/searchable variant of {@link #relationDefinitions} for the Relation
     * Definitions tab (Workflow Security). Same access gate; filtering/sorting/paging happens
     * server-side here instead of in the browser. */
    @GetMapping("/relation-definitions/paged")
    public PageResponse<AuthorizationRelationDefinitionResponse> relationDefinitionsPaged(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int limit,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String resourceType,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String updatedFrom,
            @RequestParam(required = false) String updatedTo,
            @RequestParam(defaultValue = "resourceType") String sortBy,
            @RequestParam(defaultValue = "asc") String sortDir
    ) {
        UserAccount caller = currentUserService.requireCurrentUser();
        if (!permissionEvaluationService.hasAnyPermission(caller,
                "security.workflow_authorization.view", "security.workflow_authorization.manage")) {
            throw new AccessDeniedException("Workflow authorization view permission required");
        }
        List<AuthorizationRelationDefinition> rows = relationDefinitionRepository.findAllByOrderByResourceTypeAscCodeAsc();
        if (StringUtils.hasText(resourceType)) {
            rows = rows.stream().filter(d -> resourceType.equalsIgnoreCase(d.getResourceType())).toList();
        }
        if (StringUtils.hasText(status) && !"ALL".equalsIgnoreCase(status)) {
            boolean wantActive = "ACTIVE".equalsIgnoreCase(status);
            rows = rows.stream().filter(d -> d.isActive() == wantActive).toList();
        }
        if (StringUtils.hasText(updatedFrom)) {
            java.time.Instant from = java.time.LocalDate.parse(updatedFrom).atStartOfDay(java.time.ZoneOffset.UTC).toInstant();
            rows = rows.stream().filter(d -> d.getUpdatedAt() != null && !d.getUpdatedAt().isBefore(from)).toList();
        }
        if (StringUtils.hasText(updatedTo)) {
            java.time.Instant to = java.time.LocalDate.parse(updatedTo).plusDays(1).atStartOfDay(java.time.ZoneOffset.UTC).toInstant();
            rows = rows.stream().filter(d -> d.getUpdatedAt() != null && d.getUpdatedAt().isBefore(to)).toList();
        }
        if (StringUtils.hasText(search)) {
            String needle = search.trim().toLowerCase(Locale.ROOT);
            rows = rows.stream().filter(d ->
                    (d.getCode() != null && d.getCode().toLowerCase(Locale.ROOT).contains(needle))
                            || (d.getDisplayName() != null && d.getDisplayName().toLowerCase(Locale.ROOT).contains(needle))
                            || (d.getResolverCode() != null && d.getResolverCode().toLowerCase(Locale.ROOT).contains(needle))
            ).toList();
        }

        List<AuthorizationRelationDefinitionResponse> flat = rows.stream()
                .map(AuthorizationRelationDefinitionResponse::from)
                .collect(java.util.stream.Collectors.toCollection(java.util.ArrayList::new));

        Comparator<AuthorizationRelationDefinitionResponse> comparator = switch (sortBy == null ? "resourceType" : sortBy) {
            case "code" -> Comparator.comparing(AuthorizationRelationDefinitionResponse::code, String.CASE_INSENSITIVE_ORDER);
            case "resolverCode" -> Comparator.comparing(AuthorizationRelationDefinitionResponse::resolverCode, String.CASE_INSENSITIVE_ORDER);
            case "active" -> Comparator.comparing(AuthorizationRelationDefinitionResponse::active);
            case "updatedAt" -> Comparator.comparing(
                    AuthorizationRelationDefinitionResponse::updatedAt, Comparator.nullsFirst(Comparator.naturalOrder()));
            default -> Comparator.comparing(AuthorizationRelationDefinitionResponse::resourceType, String.CASE_INSENSITIVE_ORDER)
                    .thenComparing(AuthorizationRelationDefinitionResponse::code, String.CASE_INSENSITIVE_ORDER);
        };
        if ("desc".equalsIgnoreCase(sortDir)) comparator = comparator.reversed();
        flat.sort(comparator);

        return PagedList.paginate(flat, page, limit);
    }
}
