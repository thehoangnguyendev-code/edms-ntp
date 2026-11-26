package com.eqms.service;

import com.eqms.util.DateTimeFormatUtils;
import com.eqms.auth.CurrentUserService;
import org.springframework.security.access.AccessDeniedException;
import com.eqms.dto.audittrail.AuditTrailReviewDtos.CampaignCompleteRequest;
import com.eqms.dto.audittrail.AuditTrailReviewDtos.CampaignCreateRequest;
import com.eqms.dto.audittrail.AuditTrailReviewDtos.CampaignDetailResponse;
import com.eqms.dto.audittrail.AuditTrailReviewDtos.CampaignSummaryResponse;
import com.eqms.dto.audittrail.AuditTrailReviewDtos.ItemDecisionRequest;
import com.eqms.dto.audittrail.AuditTrailReviewDtos.ItemResponse;
import com.eqms.entity.AuditLog;
import com.eqms.entity.AuditTrailReviewCampaign;
import com.eqms.entity.AuditTrailReviewItem;
import com.eqms.entity.ElectronicSignature;
import com.eqms.entity.UserAccount;
import com.eqms.repository.AuditLogRepository;
import com.eqms.repository.AuditTrailReviewCampaignRepository;
import com.eqms.repository.AuditTrailReviewItemRepository;
import com.eqms.dto.user.PageResponse;
import com.eqms.dto.user.PaginationResponse;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Periodic Audit Trail Review campaigns (EU-GMP Annex 11 §9 / MHRA Data Integrity
 * Guidance — audit trail must be actively reviewed by QA, not just retained).
 * A campaign snapshots every audit log entry created within a review period; each
 * item is reviewed and decided; completing the campaign requires an e-signature.
 * Modeled directly on AccessReviewService.
 */
@Service
public class AuditTrailReviewService {

    private static final String ENTITY_TYPE = "AUDIT_TRAIL_REVIEW";
    private static final String VIEW_PERMISSION = "audit.review.view";
    private static final String MANAGE_PERMISSION = "audit.review.manage";
    private static final Set<String> DECISIONS = Set.of("CONFIRMED", "FLAGGED", "PENDING");

    private final com.eqms.repository.UserAccountRepository userRepo;
    private final com.eqms.service.authorization.ShadowGuard shadow;
    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private ObjectNumberService numbers;
    private final AuditTrailReviewCampaignRepository campaignRepo;
    private final AuditTrailReviewItemRepository itemRepo;
    private final AuditLogRepository auditLogRepository;
    private final PermissionEvaluationService permissionEvaluationService;
    private final CurrentUserService currentUserService;
    private final AuditTrailService auditTrailService;
    private final SecurityChangeSignatureService securityChangeSignatureService;
    private final ElectronicSignatureService electronicSignatureService;

    /** Without the shadow of the Hybrid engine (the services are built this way in unit tests; Spring uses the constructor below). */
    public AuditTrailReviewService(
            com.eqms.repository.UserAccountRepository userRepo,
            AuditTrailReviewCampaignRepository campaignRepo,
            AuditTrailReviewItemRepository itemRepo,
            AuditLogRepository auditLogRepository,
            PermissionEvaluationService permissionEvaluationService,
            CurrentUserService currentUserService,
            AuditTrailService auditTrailService,
            SecurityChangeSignatureService securityChangeSignatureService,
            ElectronicSignatureService electronicSignatureService) {
        this(userRepo, campaignRepo, itemRepo, auditLogRepository, permissionEvaluationService, currentUserService, auditTrailService, securityChangeSignatureService, electronicSignatureService, new com.eqms.service.authorization.ShadowGuard(null));
    }

    @org.springframework.beans.factory.annotation.Autowired
    public AuditTrailReviewService(
            com.eqms.repository.UserAccountRepository userRepo,
            AuditTrailReviewCampaignRepository campaignRepo,
            AuditTrailReviewItemRepository itemRepo,
            AuditLogRepository auditLogRepository,
            PermissionEvaluationService permissionEvaluationService,
            CurrentUserService currentUserService,
            AuditTrailService auditTrailService,
            SecurityChangeSignatureService securityChangeSignatureService,
            ElectronicSignatureService electronicSignatureService,
            com.eqms.service.authorization.ShadowGuard shadow) {
        this.shadow = shadow;
        this.userRepo = userRepo;
        this.campaignRepo = campaignRepo;
        this.itemRepo = itemRepo;
        this.auditLogRepository = auditLogRepository;
        this.permissionEvaluationService = permissionEvaluationService;
        this.currentUserService = currentUserService;
        this.auditTrailService = auditTrailService;
        this.securityChangeSignatureService = securityChangeSignatureService;
        this.electronicSignatureService = electronicSignatureService;
    }

    @Transactional(readOnly = true)
    public List<CampaignSummaryResponse> listCampaigns() {
        requireView();
        return campaignRepo.findAllByOrderByCreatedAtDesc().stream()
                .map(this::toSummary)
                .toList();
    }

    /** Server-side campaign query. The UI never filters or paginates a full campaign list. */
    @Transactional(readOnly = true)
    public PageResponse<CampaignSummaryResponse> listCampaignsPaged(
            int page, int limit, String search, String status, String sortBy, String sortDirection) {
        return listCampaignsPaged(page, limit, search, status, false, sortBy, sortDirection);
    }

    /** {@code waitingForMe}: only the campaigns still in progress whose reviewer is the person who asks. */
    @Transactional(readOnly = true)
    public PageResponse<CampaignSummaryResponse> listCampaignsPaged(
            int page, int limit, String search, String status, boolean waitingForMe, String sortBy, String sortDirection) {
        requireView();
        Page<AuditTrailReviewCampaign> results = campaignRepo.search(
                normalizeSearch(search), normalizeStatus(status), waitingForMe,
                waitingForMe ? currentUserService.requireCurrentUser().getId() : new UUID(0, 0),
                PageRequest.of(normalizePage(page), normalizeLimit(limit), campaignSort(sortBy, sortDirection)));
        return page(results, this::toSummary);
    }

    @Transactional(readOnly = true)
    public CampaignSummaryResponse getCampaignSummary(UUID id) {
        requireView();
        return toSummary(require(id));
    }

    /** Server-side item query for a campaign detail page. */
    @Transactional(readOnly = true)
    public PageResponse<ItemResponse> listCampaignItemsPaged(
            UUID campaignId, int page, int limit, String search, String decision, String sortBy, String sortDirection) {
        return listCampaignItemsPaged(campaignId, page, limit, search, decision, null, null, null, null, null, sortBy, sortDirection);
    }

    /** Same query with the Module, Action, e-signature and timestamp-range filters. Dates are inclusive days in the system time zone. */
    @Transactional(readOnly = true)
    public PageResponse<ItemResponse> listCampaignItemsPaged(
            UUID campaignId, int page, int limit, String search, String decision,
            String module, String action, String signed, java.time.LocalDate from, java.time.LocalDate to,
            String sortBy, String sortDirection) {
        requireView();
        require(campaignId);
        if (from != null && to != null && to.isBefore(from)) {
            throw new IllegalArgumentException("The end date must not be before the start date");
        }
        Instant start = from != null ? from.atStartOfDay(DateTimeFormatUtils.ZONE).toInstant() : Instant.EPOCH;
        Instant end = to != null ? to.plusDays(1).atStartOfDay(DateTimeFormatUtils.ZONE).toInstant() : Instant.parse("9999-01-01T00:00:00Z");
        Page<AuditTrailReviewItem> results = itemRepo.search(
                campaignId, normalizeSearch(search), normalizeDecision(decision),
                StringUtils.hasText(module) ? module.trim() : "",
                StringUtils.hasText(action) ? action.trim() : "",
                normalizeSigned(signed), start, end,
                PageRequest.of(normalizePage(page), normalizeLimit(limit), itemSort(sortBy, sortDirection)));
        return page(results, this::toItemResponse);
    }

    /** The values the detail page offers in its Module and Action filters. */
    @Transactional(readOnly = true)
    public ItemFilterOptions listItemFilterOptions(UUID campaignId) {
        requireView();
        require(campaignId);
        return new ItemFilterOptions(itemRepo.distinctModules(campaignId), itemRepo.distinctActions(campaignId));
    }

    public record ItemFilterOptions(List<String> modules, List<String> actions) {}

    @Transactional(readOnly = true)
    public CampaignDetailResponse getCampaign(UUID id) {
        requireView();
        return getCampaignInternal(id);
    }

    @Transactional
    public CampaignDetailResponse createCampaign(CampaignCreateRequest request) {
        UserAccount actor = requireManage();
        if (request == null || !StringUtils.hasText(request.name())) {
            throw new IllegalArgumentException("Campaign name is required");
        }
        if (request.reviewPeriodStart() == null || request.reviewPeriodEnd() == null) {
            throw new IllegalArgumentException("Review period start and end are required");
        }
        if (request.reviewPeriodEnd().isBefore(request.reviewPeriodStart())) {
            throw new IllegalArgumentException("Review period end must not be before start");
        }

        AuditTrailReviewCampaign campaign = new AuditTrailReviewCampaign();
        if (numbers != null) campaign.setCampaignNumber(numbers.allocate(ObjectNumberService.AUDIT_TRAIL_CAMPAIGN));
        campaign.setName(request.name().trim());
        campaign.setDescription(request.description());
        campaign.setReviewPeriodStart(request.reviewPeriodStart());
        campaign.setReviewPeriodEnd(request.reviewPeriodEnd());
        campaign.setStatus("IN_PROGRESS");
        UserAccount reviewer = resolveReviewer(actor, request.reviewerUserId());
        campaign.setReviewer(reviewer);
        campaign.setCreatedBy(actor);
        campaign.setUpdatedBy(actor);
        campaign = campaignRepo.save(campaign);

        Instant from = request.reviewPeriodStart().atStartOfDay(DateTimeFormatUtils.ZONE).toInstant();
        Instant to = request.reviewPeriodEnd().plusDays(1).atStartOfDay(DateTimeFormatUtils.ZONE).toInstant();
        List<AuditLog> logs = auditLogRepository.findAllByCreatedAtBetweenOrderByCreatedAtAsc(from, to);

        int count = 0;
        for (AuditLog log : logs) {
            AuditTrailReviewItem item = new AuditTrailReviewItem();
            item.setCampaign(campaign);
            item.setAuditLog(log);
            itemRepo.save(item);
            count++;
        }

        auditTrailService.logAs(actor, ENTITY_TYPE, auditCode(campaign), campaign.getId(),
                "AUDIT_TRAIL_REVIEW_CAMPAIGN_CREATED", null, "In Progress",
                "Created audit trail review campaign \"" + campaign.getName() + "\" with " + count + " log entries for period "
                        + request.reviewPeriodStart() + " to " + request.reviewPeriodEnd()
                        + (reviewer.getId().equals(actor.getId()) ? "" : ". Reviewer: " + reviewer.getFullName()),
                java.util.List.of(new com.eqms.dto.audittrail.AuditTrailChangeResponse("Campaign Name", null, campaign.getName()), new com.eqms.dto.audittrail.AuditTrailChangeResponse("Log Entries to Review", null, String.valueOf(count)),
                        new com.eqms.dto.audittrail.AuditTrailChangeResponse("Review Period", null, request.reviewPeriodStart() + " to " + request.reviewPeriodEnd()),
                        new com.eqms.dto.audittrail.AuditTrailChangeResponse("Reviewer", null, reviewer.getFullName())));
        return getCampaignInternal(campaign.getId());
    }

    @Transactional
    public ItemResponse decideItem(UUID campaignId, UUID itemId, ItemDecisionRequest request) {
        UserAccount actor = currentUserService.requireCurrentUser();
        // Two asks of the engine: the campaign (permission, state) and the ITEM (a person kept apart from this item, V820; the id of an item is understood by the adapter of the campaign).
        return shadow.around(actor, "AUDIT_REVIEW_CAMPAIGN", campaignId, "DECIDE_ITEM", com.eqms.service.authorization.ShadowGuard::isDenial,
                () -> shadow.around(actor, "AUDIT_REVIEW_CAMPAIGN", itemId, "DECIDE_ITEM", com.eqms.service.authorization.ShadowGuard::isDenial, () -> decideItemInner(campaignId, itemId, request)));
    }

    private ItemResponse decideItemInner(UUID campaignId, UUID itemId, ItemDecisionRequest request) {
        // who may do this is decided by the Hybrid engine (ShadowGuard, campaign type of this service)
        UserAccount actor = currentUserService.requireCurrentUser();
        AuditTrailReviewCampaign campaign = require(campaignId);
        if (!"IN_PROGRESS".equals(campaign.getStatus())) {
            throw new IllegalStateException("Decisions can only be recorded on an in-progress campaign");
        }
        AuditTrailReviewItem item = itemRepo.findById(itemId)
                .orElseThrow(() -> new IllegalArgumentException("Review item not found"));
        if (item.getCampaign() == null || !campaignId.equals(item.getCampaign().getId())) {
            throw new IllegalArgumentException("Review item does not belong to this campaign");
        }
        String decision = request != null && StringUtils.hasText(request.decision())
                ? request.decision().trim().toUpperCase(Locale.ROOT) : null;
        if (decision == null || !DECISIONS.contains(decision)) {
            throw new IllegalArgumentException("Invalid decision. Allowed: CONFIRMED, FLAGGED, PENDING");
        }
        String oldDecision = item.getDecision();
        item.setDecision(decision);
        item.setDecisionNote(request.note());
        item.setDecidedBy("PENDING".equals(decision) ? null : actor.getId());
        item.setDecidedAt("PENDING".equals(decision) ? null : Instant.now());
        itemRepo.save(item);

        auditTrailService.logAs(actor, ENTITY_TYPE, auditCode(campaign), campaign.getId(),
                "AUDIT_TRAIL_REVIEW_ITEM_DECIDED", oldDecision, decision,
                "Review decision for audit log entry (" + item.getAuditLog().getAction() + " on " + item.getAuditLog().getEntityName() + ")"
                        + (StringUtils.hasText(request.note()) ? ": " + request.note() : ""),
                StringUtils.hasText(request.note())
                        ? java.util.List.of(new com.eqms.dto.audittrail.AuditTrailChangeResponse("Entry (" + item.getAuditLog().getAction() + " on " + item.getAuditLog().getEntityName() + ") \u203a Decision", oldDecision, decision), new com.eqms.dto.audittrail.AuditTrailChangeResponse("Reviewer Note", null, request.note()))
                        : java.util.List.of(new com.eqms.dto.audittrail.AuditTrailChangeResponse("Entry (" + item.getAuditLog().getAction() + " on " + item.getAuditLog().getEntityName() + ") \u203a Decision", oldDecision, decision)));
        return toItemResponse(item);
    }

    @Transactional
    public CampaignDetailResponse completeCampaign(UUID id, CampaignCompleteRequest request) {
        return shadow.around(currentUserService.requireCurrentUser(), "AUDIT_REVIEW_CAMPAIGN", id, "COMPLETE", com.eqms.service.authorization.ShadowGuard::isDenial, () -> completeCampaignInner(id, request));
    }

    private CampaignDetailResponse completeCampaignInner(UUID id, CampaignCompleteRequest request) {
        // who may do this is decided by the Hybrid engine (ShadowGuard, campaign type of this service)
        UserAccount actor = currentUserService.requireCurrentUser();
        String token = request != null ? request.signatureToken() : null;
        String reason = request != null ? request.reason() : null;
        securityChangeSignatureService.requireValidToken(actor, token);

        AuditTrailReviewCampaign campaign = require(id);
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
                "audit_trail_review_campaigns", campaign.getId(), campaign.getName(),
                actor, token,
                SecurityChangeSignatureService.MEANING_AUDIT_TRAIL_REVIEW,
                reason, null, "In Progress", "Completed");
        campaign.setSignatureId(signature.getId());
        campaignRepo.save(campaign);

        auditTrailService.logAs(actor, ENTITY_TYPE, auditCode(campaign), campaign.getId(),
                "AUDIT_TRAIL_REVIEW_CAMPAIGN_COMPLETED", "In Progress", "Completed",
                "Completed audit trail review campaign. Signature: " + signature.getSignatureId(),
                List.of(), signature.getId());
        return getCampaignInternal(id);
    }

    @Transactional
    public CampaignDetailResponse cancelCampaign(UUID id) {
        return shadow.around(currentUserService.requireCurrentUser(), "AUDIT_REVIEW_CAMPAIGN", id, "CANCEL", com.eqms.service.authorization.ShadowGuard::isDenial, () -> cancelCampaignInner(id));
    }

    private CampaignDetailResponse cancelCampaignInner(UUID id) {
        // who may do this is decided by the Hybrid engine (ShadowGuard, campaign type of this service)
        UserAccount actor = currentUserService.requireCurrentUser();
        AuditTrailReviewCampaign campaign = require(id);
        if (!"IN_PROGRESS".equals(campaign.getStatus())) {
            throw new IllegalStateException("Only in-progress campaigns can be cancelled");
        }
        campaign.setStatus("CANCELLED");
        campaign.setUpdatedBy(actor);
        campaignRepo.save(campaign);
        auditTrailService.logAs(actor, ENTITY_TYPE, auditCode(campaign), campaign.getId(),
                "AUDIT_TRAIL_REVIEW_CAMPAIGN_CANCELLED", "In Progress", "Cancelled",
                "Cancelled audit trail review campaign");
        return getCampaignInternal(id);
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    private CampaignDetailResponse getCampaignInternal(UUID id) {
        AuditTrailReviewCampaign campaign = require(id);
        List<ItemResponse> items = itemRepo.findByCampaign_IdOrderByAuditLog_CreatedAtAsc(id).stream()
                .map(this::toItemResponse)
                .toList();
        return new CampaignDetailResponse(toSummary(campaign), items);
    }

    private AuditTrailReviewCampaign require(UUID id) {
        return campaignRepo.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Audit trail review campaign not found"));
    }

    private void requireView() {
        UserAccount u = currentUserService.requireCurrentUser();
        if (!permissionEvaluationService.hasAnyPermission(u, VIEW_PERMISSION, MANAGE_PERMISSION)) {
            throw new AccessDeniedException("Audit trail review view permission required");
        }
    }

    /** The person who reviews a campaign: the one the creator names, or the creator. A person named must be an active user who may manage audit trail reviews (they decide the items). */
    private UserAccount resolveReviewer(UserAccount actor, java.util.UUID reviewerUserId) {
        if (reviewerUserId == null || reviewerUserId.equals(actor.getId())) return actor;
        UserAccount reviewer = userRepo.findById(reviewerUserId).orElseThrow(() -> new IllegalArgumentException("The reviewer was not found."));
        if (reviewer.getStatus() != com.eqms.entity.UserStatus.Active || !permissionEvaluationService.hasPermission(reviewer, MANAGE_PERMISSION)) {
            throw new IllegalArgumentException("The reviewer must be an active user who may manage audit trail reviews.");
        }
        return reviewer;
    }

    /** The people who may be given a campaign: the active users who may manage audit trail reviews. */
    @Transactional(readOnly = true)
    public List<com.eqms.dto.audittrail.AuditTrailReviewDtos.ReviewerOption> reviewers() {
        requireManage();
        return userRepo.findAllByStatus(com.eqms.entity.UserStatus.Active).stream()
                .filter(user -> permissionEvaluationService.hasPermission(user, MANAGE_PERMISSION))
                .sorted(java.util.Comparator.comparing(user -> user.getFullName() == null ? "" : user.getFullName(), String.CASE_INSENSITIVE_ORDER))
                .map(user -> new com.eqms.dto.audittrail.AuditTrailReviewDtos.ReviewerOption(user.getId(), user.getFullName()))
                .toList();
    }

    private UserAccount requireManage() {
        UserAccount u = currentUserService.requireCurrentUser();
        if (!permissionEvaluationService.hasPermission(u, MANAGE_PERMISSION)) {
            throw new AccessDeniedException("Audit trail review management permission required");
        }
        return u;
    }

    /** What the Audit Trail shows as the Object Code of a campaign: its number (its name where an old record has none). */
    private static String auditCode(AuditTrailReviewCampaign c) {
        return c.getCampaignNumber() != null ? c.getCampaignNumber() : c.getName();
    }

    private CampaignSummaryResponse toSummary(AuditTrailReviewCampaign c) {
        long total = itemRepo.findByCampaign_IdOrderByAuditLog_CreatedAtAsc(c.getId()).size();
        long pending = itemRepo.countByCampaign_IdAndDecision(c.getId(), "PENDING");
        return new CampaignSummaryResponse(
                c.getId(), c.getCampaignNumber(), c.getName(), c.getDescription(),
                c.getReviewPeriodStart(), c.getReviewPeriodEnd(), c.getStatus(),
                displayLabel(c.getStatus()),
                c.getReviewer() != null ? c.getReviewer().getFullName() : null,
                c.getSignedAt(), c.getSignatureId(),
                total, pending, c.getCreatedAt());
    }

    private ItemResponse toItemResponse(AuditTrailReviewItem i) {
        AuditLog log = i.getAuditLog();
        return new ItemResponse(
                i.getId(), log.getId(),
                log.getCreatedAt() != null ? log.getCreatedAt().toString() : null,
                log.getUserFullName(), log.getEmployeeCode(),
                log.getEntityType(), log.getAction() != null ? log.getAction() : log.getActionType(),
                log.getEntityName() != null ? log.getEntityName() : log.getEntityType(),
                log.isElectronicSignatureApplied(),
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

    private static int normalizePage(int page) {
        return Math.max(0, page - 1);
    }

    private static int normalizeLimit(int limit) {
        return Math.min(Math.max(limit, 1), 100);
    }

    private static String normalizeSearch(String search) {
        // Bind an empty String rather than null. PostgreSQL otherwise infers an untyped null
        // used by LOWER/LIKE as bytea, which makes the initial paged list fail with lower(bytea).
        return StringUtils.hasText(search) ? search.trim() : "";
    }

    private static String normalizeStatus(String status) {
        return StringUtils.hasText(status) && !"ALL".equalsIgnoreCase(status)
                ? status.trim().toUpperCase(Locale.ROOT) : null;
    }

    private static String normalizeSigned(String signed) {
        String value = StringUtils.hasText(signed) ? signed.trim().toUpperCase(Locale.ROOT) : "ALL";
        if (!java.util.Set.of("ALL", "YES", "NO").contains(value)) throw new IllegalArgumentException("Invalid e-signature filter. Allowed: ALL, YES, NO");
        return value;
    }

    private static String normalizeDecision(String decision) {
        return StringUtils.hasText(decision) && !"ALL".equalsIgnoreCase(decision)
                ? decision.trim().toUpperCase(Locale.ROOT) : null;
    }

    private static Sort campaignSort(String sortBy, String sortDirection) {
        String property = switch (sortBy == null ? "createdAt" : sortBy) {
            case "campaignNumber", "name", "status", "reviewPeriodStart", "reviewPeriodEnd", "signedAt" -> sortBy;
            default -> "createdAt";
        };
        return Sort.by("asc".equalsIgnoreCase(sortDirection) ? Sort.Direction.ASC : Sort.Direction.DESC, property);
    }

    private static Sort itemSort(String sortBy, String sortDirection) {
        String property = switch (sortBy == null ? "timestamp" : sortBy) {
            case "timestamp" -> "auditLog.createdAt";
            case "userFullName" -> "auditLog.userFullName";
            case "module" -> "auditLog.entityType";
            case "action" -> "auditLog.action";
            case "decision" -> "decision";
            default -> "auditLog.createdAt";
        };
        return Sort.by("asc".equalsIgnoreCase(sortDirection) ? Sort.Direction.ASC : Sort.Direction.DESC, property);
    }

    private static <T, R> PageResponse<R> page(Page<T> source, java.util.function.Function<T, R> mapper) {
        return new PageResponse<>(source.getContent().stream().map(mapper).toList(),
                new PaginationResponse(source.getNumber() + 1, source.getSize(), source.getTotalElements(), source.getTotalPages()));
    }
}
