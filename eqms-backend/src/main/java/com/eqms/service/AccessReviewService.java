package com.eqms.service;

import com.eqms.auth.CurrentUserService;
import org.springframework.security.access.AccessDeniedException;
import com.eqms.dto.user.AccessReviewDtos.CampaignCompleteRequest;
import com.eqms.dto.user.AccessReviewDtos.CampaignCreateRequest;
import com.eqms.dto.user.AccessReviewDtos.CampaignDetailResponse;
import com.eqms.dto.user.AccessReviewDtos.CampaignSummaryResponse;
import com.eqms.dto.user.AccessReviewDtos.CodeLabelResponse;
import com.eqms.dto.user.AccessReviewDtos.ItemDecisionRequest;
import com.eqms.dto.user.AccessReviewDtos.ItemResponse;
import com.eqms.entity.AccessReviewCampaign;
import com.eqms.entity.AccessReviewItem;
import com.eqms.entity.ElectronicSignature;
import com.eqms.entity.UserAccount;
import com.eqms.repository.AccessReviewCampaignRepository;
import com.eqms.repository.AccessReviewItemRepository;
import com.eqms.repository.UserAccessProfileRepository;
import com.eqms.repository.UserAccountRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.Instant;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Periodic access review campaigns (RBAC master plan section 17).
 * A campaign snapshots every active user's access state; each item is
 * reviewed and decided; completing the campaign requires an e-signature.
 */
@Service
public class AccessReviewService {

    private static final String ENTITY_TYPE = "ACCESS_REVIEW";
    private static final String VIEW_PERMISSION = "security.access_review.view";
    private static final String MANAGE_PERMISSION = "security.access_review.manage";
    private static final Set<String> DECISIONS = Set.of("CONFIRMED", "REVOKE_REQUESTED", "MODIFY_REQUESTED", "PENDING");

    private final AccessReviewCampaignRepository campaignRepo;
    private final AccessReviewItemRepository itemRepo;
    private final UserAccountRepository userRepo;
    private final UserAccessProfileRepository uapRepo;
    private final EffectivePermissionService effectivePermissionService;
    private final PermissionEvaluationService permissionEvaluationService;
    private final CurrentUserService currentUserService;
    private final AuditTrailService auditTrailService;
    private final SecurityChangeSignatureService securityChangeSignatureService;
    private final ElectronicSignatureService electronicSignatureService;

    public AccessReviewService(
            AccessReviewCampaignRepository campaignRepo,
            AccessReviewItemRepository itemRepo,
            UserAccountRepository userRepo,
            UserAccessProfileRepository uapRepo,
            EffectivePermissionService effectivePermissionService,
            PermissionEvaluationService permissionEvaluationService,
            CurrentUserService currentUserService,
            AuditTrailService auditTrailService,
            SecurityChangeSignatureService securityChangeSignatureService,
            ElectronicSignatureService electronicSignatureService) {
        this.campaignRepo = campaignRepo;
        this.itemRepo = itemRepo;
        this.userRepo = userRepo;
        this.uapRepo = uapRepo;
        this.effectivePermissionService = effectivePermissionService;
        this.permissionEvaluationService = permissionEvaluationService;
        this.currentUserService = currentUserService;
        this.auditTrailService = auditTrailService;
        this.securityChangeSignatureService = securityChangeSignatureService;
        this.electronicSignatureService = electronicSignatureService;
    }

    /** Server-side list: search, status filter, sort and pagination resolved here. */
    @Transactional
    public com.eqms.dto.user.PageResponse<CampaignSummaryResponse> listPaged(
            int page, int limit, String search, String status, String createdFrom, String createdTo,
            String updatedFrom, String updatedTo, String sortBy, String sortDir) {
        java.util.List<CampaignSummaryResponse> filtered = listCampaigns().stream()
                .filter(c -> {
                    if (org.springframework.util.StringUtils.hasText(status)
                            && !"ALL".equalsIgnoreCase(status) && !c.status().equalsIgnoreCase(status)) return false;
                    if (!com.eqms.util.DateRangeFilter.matches(c.createdAt(), createdFrom, createdTo)) return false;
                    if (!com.eqms.util.DateRangeFilter.matches(c.updatedAt(), updatedFrom, updatedTo)) return false;
                    String q = search == null ? "" : search.trim().toLowerCase(java.util.Locale.ROOT);
                    if (q.isEmpty()) return true;
                    return (c.name() + " " + (c.description() == null ? "" : c.description()) + " "
                            + (c.reviewerName() == null ? "" : c.reviewerName()))
                            .toLowerCase(java.util.Locale.ROOT).contains(q);
                })
                .collect(java.util.stream.Collectors.toList());
        java.util.Comparator<CampaignSummaryResponse> cmp = switch (sortBy == null ? "createdAt" : sortBy) {
            case "name" -> java.util.Comparator.comparing(CampaignSummaryResponse::name, String.CASE_INSENSITIVE_ORDER);
            case "status" -> java.util.Comparator.comparing(CampaignSummaryResponse::status);
            case "totalItems" -> java.util.Comparator.comparingLong(CampaignSummaryResponse::totalItems);
            case "pendingItems" -> java.util.Comparator.comparingLong(CampaignSummaryResponse::pendingItems);
            case "updatedAt" -> java.util.Comparator.comparing(CampaignSummaryResponse::updatedAt,
                    java.util.Comparator.nullsLast(java.util.Comparator.naturalOrder()));
            default -> java.util.Comparator.comparing(CampaignSummaryResponse::createdAt,
                    java.util.Comparator.nullsLast(java.util.Comparator.naturalOrder()));
        };
        if (!"asc".equalsIgnoreCase(sortDir)) cmp = cmp.reversed();
        filtered.sort(cmp);
        return com.eqms.util.PagedList.paginate(filtered, page, limit);
    }

    /** Dropdown values for the Access Review list filters. */
    public java.util.Map<String, java.util.List<CodeLabelResponse>> getListOptions() {
        requireView();
        return java.util.Map.of("statuses",
                java.util.List.of("IN_PROGRESS", "COMPLETED", "CANCELLED").stream()
                        .map(value -> new CodeLabelResponse(value, displayLabel(value)))
                        .toList());
    }

    @Transactional(readOnly = true)
    public List<CampaignSummaryResponse> listCampaigns() {
        requireView();
        return campaignRepo.findAllByOrderByCreatedAtDesc().stream()
                .map(this::toSummary)
                .toList();
    }

    @Transactional(readOnly = true)
    public CampaignDetailResponse getCampaign(UUID id) {
        requireView();
        AccessReviewCampaign campaign = require(id);
        List<ItemResponse> items = itemRepo.findByCampaign_IdOrderByUsernameAsc(id).stream()
                .map(this::toItemResponse)
                .toList();
        return new CampaignDetailResponse(toSummary(campaign), items);
    }

    @Transactional(readOnly = true)
    public CampaignSummaryResponse getCampaignSummary(UUID id) {
        requireView();
        return toSummary(require(id));
    }

    @Transactional(readOnly = true)
    public com.eqms.dto.user.PageResponse<ItemResponse> listItemsPaged(
            UUID campaignId, int page, int limit, String search, String userStatus,
            String decision, String sortBy, String sortDir) {
        requireView();
        require(campaignId);
        String query = search == null ? "" : search.trim().toLowerCase(Locale.ROOT);
        List<ItemResponse> filtered = itemRepo.findByCampaign_IdOrderByUsernameAsc(campaignId).stream()
                .map(this::toItemResponse)
                .filter(item -> !StringUtils.hasText(userStatus)
                        || "ALL".equalsIgnoreCase(userStatus)
                        || userStatus.equalsIgnoreCase(item.userStatus()))
                .filter(item -> !StringUtils.hasText(decision)
                        || "ALL".equalsIgnoreCase(decision)
                        || decision.equalsIgnoreCase(item.decision()))
                .filter(item -> query.isEmpty() || (item.username() + " "
                        + Objects.toString(item.fullName(), "") + " "
                        + Objects.toString(item.accessProfiles(), ""))
                        .toLowerCase(Locale.ROOT).contains(query))
                .collect(Collectors.toList());
        java.util.Comparator<ItemResponse> comparator = switch (sortBy == null ? "username" : sortBy) {
            case "userStatus" -> java.util.Comparator.comparing(
                    item -> Objects.toString(item.userStatus(), ""), String.CASE_INSENSITIVE_ORDER);
            case "permissionCount" -> java.util.Comparator.comparingInt(ItemResponse::permissionCount);
            case "decision" -> java.util.Comparator.comparing(ItemResponse::decision);
            case "decidedAt" -> java.util.Comparator.comparing(ItemResponse::decidedAt,
                    java.util.Comparator.nullsLast(java.util.Comparator.naturalOrder()));
            default -> java.util.Comparator.comparing(ItemResponse::username, String.CASE_INSENSITIVE_ORDER);
        };
        if (!"asc".equalsIgnoreCase(sortDir)) comparator = comparator.reversed();
        filtered.sort(comparator);
        return com.eqms.util.PagedList.paginate(filtered, page, limit);
    }

    @Transactional
    public CampaignDetailResponse createCampaign(CampaignCreateRequest request) {
        UserAccount actor = requireManage();
        if (request == null || !StringUtils.hasText(request.name())) {
            throw new IllegalArgumentException("Campaign name is required");
        }

        AccessReviewCampaign campaign = new AccessReviewCampaign();
        campaign.setName(request.name().trim());
        campaign.setDescription(request.description());
        campaign.setReviewPeriodStart(request.reviewPeriodStart());
        campaign.setReviewPeriodEnd(request.reviewPeriodEnd());
        campaign.setStatus("IN_PROGRESS");
        campaign.setReviewer(actor);
        campaign.setCreatedBy(actor);
        campaign.setUpdatedBy(actor);
        campaign = campaignRepo.save(campaign);

        // Snapshot all users' access state at campaign creation time
        int count = 0;
        for (UserAccount user : userRepo.findAll()) {
            AccessReviewItem item = new AccessReviewItem();
            item.setCampaign(campaign);
            item.setUserId(user.getId());
            item.setEmployeeCode(user.getEmployeeCode());
            item.setUsername(user.getUsername());
            item.setFullName(user.getFullName());
            item.setUserStatus(user.getStatus() != null ? user.getStatus().name() : null);
            String profiles = uapRepo.findByUserId(user.getId()).stream()
                    .map(a -> a.getAccessProfile() != null ? a.getAccessProfile().getName() : null)
                    .filter(Objects::nonNull)
                    .sorted()
                    .collect(Collectors.joining(", "));
            item.setAccessProfiles(profiles);
            var effective = effectivePermissionService.getEffectivePermissionResult(user);
            item.setPermissionCount(effective.systemSuperAdmin() ? -1 : effective.permissionCodes().size());
            item.setSuperAdmin(effective.systemSuperAdmin());
            itemRepo.save(item);
            count++;
        }

        auditTrailService.logAs(actor, ENTITY_TYPE, campaign.getName(), campaign.getId(),
                "ACCESS_REVIEW_CAMPAIGN_CREATED", null, "In Progress",
                "Created access review campaign with " + count + " user snapshots");
        return getCampaignInternal(campaign.getId());
    }

    @Transactional
    public ItemResponse decideItem(UUID campaignId, UUID itemId, ItemDecisionRequest request) {
        UserAccount actor = requireManage();
        AccessReviewCampaign campaign = require(campaignId);
        if (!"IN_PROGRESS".equals(campaign.getStatus())) {
            throw new IllegalStateException("Decisions can only be recorded on an in-progress campaign");
        }
        AccessReviewItem item = itemRepo.findById(itemId)
                .orElseThrow(() -> new IllegalArgumentException("Review item not found: " + itemId));
        if (item.getCampaign() == null || !campaignId.equals(item.getCampaign().getId())) {
            throw new IllegalArgumentException("Review item does not belong to this campaign");
        }
        String decision = request != null && StringUtils.hasText(request.decision())
                ? request.decision().trim().toUpperCase(Locale.ROOT) : null;
        if (decision == null || !DECISIONS.contains(decision)) {
            throw new IllegalArgumentException("Invalid decision. Allowed: CONFIRMED, REVOKE_REQUESTED, MODIFY_REQUESTED, PENDING");
        }
        String oldDecision = item.getDecision();
        item.setDecision(decision);
        item.setDecisionNote(request.note());
        item.setDecidedBy("PENDING".equals(decision) ? null : actor.getId());
        item.setDecidedAt("PENDING".equals(decision) ? null : Instant.now());
        itemRepo.save(item);

        auditTrailService.logAs(actor, ENTITY_TYPE, campaign.getName(), campaign.getId(),
                "ACCESS_REVIEW_ITEM_DECIDED", oldDecision, decision,
                "Review decision for user " + item.getUsername()
                        + (StringUtils.hasText(request.note()) ? ": " + request.note() : ""));
        return toItemResponse(item);
    }

    @Transactional
    public CampaignDetailResponse completeCampaign(UUID id, CampaignCompleteRequest request) {
        UserAccount actor = requireManage();
        String token = request != null ? request.signatureToken() : null;
        String reason = request != null ? request.reason() : null;
        // Validate signature BEFORE any state change (denied action has no side effect)
        securityChangeSignatureService.requireValidToken(actor, token);

        AccessReviewCampaign campaign = require(id);
        if (!"IN_PROGRESS".equals(campaign.getStatus())) {
            throw new IllegalStateException("Only in-progress campaigns can be completed");
        }
        long pending = itemRepo.countByCampaign_IdAndDecision(id, "PENDING");
        if (pending > 0) {
            throw new IllegalStateException(pending + " review item(s) are still pending a decision");
        }

        campaign.setStatus("COMPLETED");
        campaign.setSignedAt(Instant.now());
        campaign.setReviewer(actor);
        campaign.setUpdatedBy(actor);

        ElectronicSignature signature = electronicSignatureService.createEntitySignature(
                "access_review_campaigns", campaign.getId(), campaign.getName(),
                actor, token,
                SecurityChangeSignatureService.MEANING_SECURITY_CONFIGURATION_CHANGE,
                reason, null, "In Progress", "Completed");
        campaign.setSignatureId(signature.getId());
        campaignRepo.save(campaign);

        auditTrailService.logAs(actor, ENTITY_TYPE, campaign.getName(), campaign.getId(),
                "ACCESS_REVIEW_CAMPAIGN_COMPLETED", "In Progress", "Completed",
                "Completed access review campaign. Signature: " + signature.getSignatureId());
        return getCampaignInternal(id);
    }

    @Transactional
    public CampaignDetailResponse cancelCampaign(UUID id) {
        UserAccount actor = requireManage();
        AccessReviewCampaign campaign = require(id);
        if (!"IN_PROGRESS".equals(campaign.getStatus())) {
            throw new IllegalStateException("Only in-progress campaigns can be cancelled");
        }
        campaign.setStatus("CANCELLED");
        campaign.setUpdatedBy(actor);
        campaignRepo.save(campaign);
        auditTrailService.logAs(actor, ENTITY_TYPE, campaign.getName(), campaign.getId(),
                "ACCESS_REVIEW_CAMPAIGN_CANCELLED", "In Progress", "Cancelled",
                "Cancelled access review campaign");
        return getCampaignInternal(id);
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    private CampaignDetailResponse getCampaignInternal(UUID id) {
        AccessReviewCampaign campaign = require(id);
        List<ItemResponse> items = itemRepo.findByCampaign_IdOrderByUsernameAsc(id).stream()
                .map(this::toItemResponse)
                .toList();
        return new CampaignDetailResponse(toSummary(campaign), items);
    }

    private AccessReviewCampaign require(UUID id) {
        return campaignRepo.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Access review campaign not found: " + id));
    }

    private void requireView() {
        UserAccount u = currentUserService.requireCurrentUser();
        if (!permissionEvaluationService.isSuperAdmin(u)
                && !permissionEvaluationService.hasAnyPermission(u, VIEW_PERMISSION, MANAGE_PERMISSION)) {
            throw new AccessDeniedException("Access review view permission required");
        }
    }

    private UserAccount requireManage() {
        UserAccount u = currentUserService.requireCurrentUser();
        if (!permissionEvaluationService.isSuperAdmin(u)
                && !permissionEvaluationService.hasPermission(u, MANAGE_PERMISSION)) {
            throw new AccessDeniedException("Access review management permission required");
        }
        return u;
    }

    private CampaignSummaryResponse toSummary(AccessReviewCampaign c) {
        long total = itemRepo.findByCampaign_IdOrderByUsernameAsc(c.getId()).size();
        long pending = itemRepo.countByCampaign_IdAndDecision(c.getId(), "PENDING");
        return new CampaignSummaryResponse(
                c.getId(), c.getName(), c.getDescription(),
                c.getReviewPeriodStart(), c.getReviewPeriodEnd(), c.getStatus(),
                displayLabel(c.getStatus()),
                c.getReviewer() != null ? c.getReviewer().getFullName() : null,
                c.getSignedAt(), c.getSignatureId(),
                total, pending, c.getCreatedAt(), c.getUpdatedAt());
    }

    private ItemResponse toItemResponse(AccessReviewItem i) {
        return new ItemResponse(
                i.getId(), i.getUserId(), i.getEmployeeCode(), i.getUsername(), i.getFullName(),
                i.getUserStatus(), displayLabel(i.getUserStatus()), i.getAccessProfiles(),
                i.getPermissionCount(), i.isSuperAdmin(),
                i.getDecision(), displayLabel(i.getDecision()), i.getDecisionNote(), i.getDecidedAt());
    }

    private String displayLabel(String code) {
        if (!StringUtils.hasText(code)) {
            return null;
        }
        return Arrays.stream(code.toLowerCase(Locale.ROOT).split("_"))
                .filter(StringUtils::hasText)
                .map(word -> Character.toUpperCase(word.charAt(0)) + word.substring(1))
                .collect(Collectors.joining(" "));
    }
}
