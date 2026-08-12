package com.eqms.service;

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

    private final AuditTrailReviewCampaignRepository campaignRepo;
    private final AuditTrailReviewItemRepository itemRepo;
    private final AuditLogRepository auditLogRepository;
    private final PermissionEvaluationService permissionEvaluationService;
    private final CurrentUserService currentUserService;
    private final AuditTrailService auditTrailService;
    private final SecurityChangeSignatureService securityChangeSignatureService;
    private final ElectronicSignatureService electronicSignatureService;

    public AuditTrailReviewService(
            AuditTrailReviewCampaignRepository campaignRepo,
            AuditTrailReviewItemRepository itemRepo,
            AuditLogRepository auditLogRepository,
            PermissionEvaluationService permissionEvaluationService,
            CurrentUserService currentUserService,
            AuditTrailService auditTrailService,
            SecurityChangeSignatureService securityChangeSignatureService,
            ElectronicSignatureService electronicSignatureService) {
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
        requireView();
        Page<AuditTrailReviewCampaign> results = campaignRepo.search(
                normalizeSearch(search), normalizeStatus(status),
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
        requireView();
        require(campaignId);
        Page<AuditTrailReviewItem> results = itemRepo.search(
                campaignId, normalizeSearch(search), normalizeDecision(decision),
                PageRequest.of(normalizePage(page), normalizeLimit(limit), itemSort(sortBy, sortDirection)));
        return page(results, this::toItemResponse);
    }

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
        campaign.setName(request.name().trim());
        campaign.setDescription(request.description());
        campaign.setReviewPeriodStart(request.reviewPeriodStart());
        campaign.setReviewPeriodEnd(request.reviewPeriodEnd());
        campaign.setStatus("IN_PROGRESS");
        campaign.setReviewer(actor);
        campaign.setCreatedBy(actor);
        campaign.setUpdatedBy(actor);
        campaign = campaignRepo.save(campaign);

        Instant from = request.reviewPeriodStart().atStartOfDay(ZoneOffset.UTC).toInstant();
        Instant to = request.reviewPeriodEnd().plusDays(1).atStartOfDay(ZoneOffset.UTC).toInstant();
        List<AuditLog> logs = auditLogRepository.findAllByCreatedAtBetweenOrderByCreatedAtAsc(from, to);

        int count = 0;
        for (AuditLog log : logs) {
            AuditTrailReviewItem item = new AuditTrailReviewItem();
            item.setCampaign(campaign);
            item.setAuditLog(log);
            itemRepo.save(item);
            count++;
        }

        auditTrailService.logAs(actor, ENTITY_TYPE, campaign.getName(), campaign.getId(),
                "AUDIT_TRAIL_REVIEW_CAMPAIGN_CREATED", null, "In Progress",
                "Created audit trail review campaign with " + count + " log entries for period "
                        + request.reviewPeriodStart() + " to " + request.reviewPeriodEnd());
        return getCampaignInternal(campaign.getId());
    }

    @Transactional
    public ItemResponse decideItem(UUID campaignId, UUID itemId, ItemDecisionRequest request) {
        UserAccount actor = requireManage();
        AuditTrailReviewCampaign campaign = require(campaignId);
        if (!"IN_PROGRESS".equals(campaign.getStatus())) {
            throw new IllegalStateException("Decisions can only be recorded on an in-progress campaign");
        }
        AuditTrailReviewItem item = itemRepo.findById(itemId)
                .orElseThrow(() -> new IllegalArgumentException("Review item not found: " + itemId));
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

        auditTrailService.logAs(actor, ENTITY_TYPE, campaign.getName(), campaign.getId(),
                "AUDIT_TRAIL_REVIEW_ITEM_DECIDED", oldDecision, decision,
                "Review decision for audit log " + item.getAuditLog().getId()
                        + (StringUtils.hasText(request.note()) ? ": " + request.note() : ""));
        return toItemResponse(item);
    }

    @Transactional
    public CampaignDetailResponse completeCampaign(UUID id, CampaignCompleteRequest request) {
        UserAccount actor = requireManage();
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

        auditTrailService.logAs(actor, ENTITY_TYPE, campaign.getName(), campaign.getId(),
                "AUDIT_TRAIL_REVIEW_CAMPAIGN_COMPLETED", "In Progress", "Completed",
                "Completed audit trail review campaign. Signature: " + signature.getSignatureId());
        return getCampaignInternal(id);
    }

    @Transactional
    public CampaignDetailResponse cancelCampaign(UUID id) {
        UserAccount actor = requireManage();
        AuditTrailReviewCampaign campaign = require(id);
        if (!"IN_PROGRESS".equals(campaign.getStatus())) {
            throw new IllegalStateException("Only in-progress campaigns can be cancelled");
        }
        campaign.setStatus("CANCELLED");
        campaign.setUpdatedBy(actor);
        campaignRepo.save(campaign);
        auditTrailService.logAs(actor, ENTITY_TYPE, campaign.getName(), campaign.getId(),
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
                .orElseThrow(() -> new IllegalArgumentException("Audit trail review campaign not found: " + id));
    }

    private void requireView() {
        UserAccount u = currentUserService.requireCurrentUser();
        if (!permissionEvaluationService.isSuperAdmin(u)
                && !permissionEvaluationService.hasAnyPermission(u, VIEW_PERMISSION, MANAGE_PERMISSION)) {
            throw new AccessDeniedException("Audit trail review view permission required");
        }
    }

    private UserAccount requireManage() {
        UserAccount u = currentUserService.requireCurrentUser();
        if (!permissionEvaluationService.isSuperAdmin(u)
                && !permissionEvaluationService.hasPermission(u, MANAGE_PERMISSION)) {
            throw new AccessDeniedException("Audit trail review management permission required");
        }
        return u;
    }

    private CampaignSummaryResponse toSummary(AuditTrailReviewCampaign c) {
        long total = itemRepo.findByCampaign_IdOrderByAuditLog_CreatedAtAsc(c.getId()).size();
        long pending = itemRepo.countByCampaign_IdAndDecision(c.getId(), "PENDING");
        return new CampaignSummaryResponse(
                c.getId(), c.getName(), c.getDescription(),
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

    private static String normalizeDecision(String decision) {
        return StringUtils.hasText(decision) && !"ALL".equalsIgnoreCase(decision)
                ? decision.trim().toUpperCase(Locale.ROOT) : null;
    }

    private static Sort campaignSort(String sortBy, String sortDirection) {
        String property = switch (sortBy == null ? "createdAt" : sortBy) {
            case "name", "status", "reviewPeriodStart", "reviewPeriodEnd", "signedAt" -> sortBy;
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
