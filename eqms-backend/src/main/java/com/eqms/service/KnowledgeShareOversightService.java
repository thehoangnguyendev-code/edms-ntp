package com.eqms.service;

import com.eqms.auth.CurrentUserService;
import com.eqms.dto.knowledge.KnowledgeShareOversightDtos.DocumentRef;
import com.eqms.dto.knowledge.KnowledgeShareOversightDtos.Explanation;
import com.eqms.dto.knowledge.KnowledgeShareOversightDtos.LinkAdminRow;
import com.eqms.dto.knowledge.KnowledgeShareOversightDtos.ShareRow;
import com.eqms.dto.knowledge.KnowledgeSharingDtos.GranteeUser;
import com.eqms.dto.security.EffectiveAccessDiagnosisLayer;
import com.eqms.dto.user.PageResponse;
import com.eqms.entity.DocumentRecord;
import com.eqms.entity.KnowledgeShareLink;
import com.eqms.entity.ObjectAccessRule;
import com.eqms.entity.UserAccount;
import com.eqms.repository.DocumentRecordRepository;
import com.eqms.repository.DocumentRevisionRepository;
import com.eqms.repository.KnowledgeShareLinkRedemptionRepository;
import com.eqms.repository.KnowledgeShareLinkRepository;
import com.eqms.repository.ObjectAccessRuleRepository;
import com.eqms.repository.UserAccountRepository;
import com.eqms.util.PagedList;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

/**
 * What the administrator sees of the Knowledge Base shares the Department Heads made (Security & Authorization > Access Review >
 * Knowledge Shares), and the "why" of one user and one document (Effective Access of the Knowledge Base). Viewing needs
 * security.access_review.view; taking a share away on behalf of a Department Head needs security.object_rules.manage and goes through
 * {@link KnowledgeSharingService#revoke}, which writes it to the Audit Trail with the name of the person who is not the Department Head.
 */
@Service
public class KnowledgeShareOversightService {
    private static final String VIEW_PERMISSION = "security.access_review.view";
    private static final String MANAGE_PERMISSION = "security.object_rules.manage";

    private final ObjectAccessRuleRepository ruleRepository;
    private final UserAccountRepository userRepository;
    private final DocumentRecordRepository documentRepository;
    private final DocumentRevisionRepository revisionRepository;
    private final KnowledgeVisibilityService visibilityService;
    private final KnowledgeSharingService sharingService;
    private final DocumentAuthorizationService documentAuthorizationService;
    private final SystemConfigurationService systemConfigurationService;
    private final DocumentService documentService;
    private final CurrentUserService currentUserService;
    private final PermissionEvaluationService permissionEvaluationService;
    private final KnowledgeShareLinkRepository linkRepository;
    private final KnowledgeShareLinkRedemptionRepository redemptionRepository;
    private final KnowledgeShareLinkService linkService;

    public KnowledgeShareOversightService(
            ObjectAccessRuleRepository ruleRepository, UserAccountRepository userRepository,
            DocumentRecordRepository documentRepository, DocumentRevisionRepository revisionRepository,
            KnowledgeVisibilityService visibilityService, KnowledgeSharingService sharingService,
            DocumentAuthorizationService documentAuthorizationService, SystemConfigurationService systemConfigurationService,
            DocumentService documentService, CurrentUserService currentUserService,
            PermissionEvaluationService permissionEvaluationService, KnowledgeShareLinkRepository linkRepository,
            KnowledgeShareLinkRedemptionRepository redemptionRepository, KnowledgeShareLinkService linkService) {
        this.linkRepository = linkRepository;
        this.redemptionRepository = redemptionRepository;
        this.linkService = linkService;
        this.ruleRepository = ruleRepository;
        this.userRepository = userRepository;
        this.documentRepository = documentRepository;
        this.revisionRepository = revisionRepository;
        this.visibilityService = visibilityService;
        this.sharingService = sharingService;
        this.documentAuthorizationService = documentAuthorizationService;
        this.systemConfigurationService = systemConfigurationService;
        this.documentService = documentService;
        this.currentUserService = currentUserService;
        this.permissionEvaluationService = permissionEvaluationService;
    }

    // ---- the list ------------------------------------------------------------------------------------------------

    @Transactional(readOnly = true)
    public PageResponse<ShareRow> list(int page, int limit, String search, UUID departmentId, String effect, String sortBy, String sortDir) {
        requireView();
        String q = search == null ? "" : search.trim().toLowerCase(Locale.ROOT);
        List<ShareRow> rows = new ArrayList<>(ruleRepository.findAllByOwnerDepartmentIsNotNullOrOwnerBusinessUnitIsNotNullOrderByCreatedAtDesc().stream()
                .filter(KnowledgeVisibilityService::isKnowledgeShare)
                .filter(r -> departmentId == null || (r.getOwnerDepartment() != null && departmentId.equals(r.getOwnerDepartment().getId())))
                .filter(r -> !StringUtils.hasText(effect) || "ALL".equalsIgnoreCase(effect) || r.getEffect().equalsIgnoreCase(effect))
                .map(this::toRow)
                .filter(r -> q.isEmpty() || (r.departmentName() + " " + r.scopeLabel() + " " + String.join(" ", r.grantees()) + " "
                        + (r.createdBy() == null ? "" : r.createdBy())).toLowerCase(Locale.ROOT).contains(q))
                .toList());
        Comparator<ShareRow> cmp = switch (sortBy == null ? "createdAt" : sortBy) {
            case "department" -> Comparator.comparing(ShareRow::departmentName, String.CASE_INSENSITIVE_ORDER);
            case "scope" -> Comparator.comparing(ShareRow::scopeLabel, String.CASE_INSENSITIVE_ORDER);
            case "effect" -> Comparator.comparing(ShareRow::effect);
            case "createdBy" -> Comparator.comparing(r -> r.createdBy() == null ? "" : r.createdBy(), String.CASE_INSENSITIVE_ORDER);
            default -> Comparator.comparing(ShareRow::createdAt, Comparator.nullsLast(Comparator.naturalOrder()));
        };
        rows.sort("asc".equalsIgnoreCase(sortDir) ? cmp : cmp.reversed());
        return PagedList.paginate(rows, page, limit);
    }

    /** Takes a share away on behalf of the Department Head. The Audit Trail says it was an administrator. */
    @Transactional
    public void revoke(UUID ruleId) {
        UserAccount actor = currentUserService.requireCurrentUser();
        if (!permissionEvaluationService.hasPermission(actor, MANAGE_PERMISSION)) {
            throw new AccessDeniedException("Permission to manage object access rules is required to remove a share for a Department Head");
        }
        sharingService.revoke(ruleId);
    }

    // ---- links ----------------------------------------------------------------------------------------------------

    /** Every link of every Department and Business Unit, newest first (status: ACTIVE, EXPIRED, REVOKED or ALL). */
    @Transactional(readOnly = true)
    public PageResponse<LinkAdminRow> listLinks(int page, int limit, String search, String status, String sortBy, String sortDir) {
        requireView();
        String q = search == null ? "" : search.trim().toLowerCase(Locale.ROOT);
        Instant now = Instant.now();
        List<LinkAdminRow> rows = new ArrayList<>(linkRepository.findAllByOrderByCreatedAtDesc().stream()
                .map(l -> toLinkRow(l, now))
                .filter(r -> !StringUtils.hasText(status) || "ALL".equalsIgnoreCase(status) || r.status().equalsIgnoreCase(status))
                .filter(r -> q.isEmpty() || (r.ownerName() + " " + r.label() + " " + r.scopeLabel() + " " + (r.createdBy() == null ? "" : r.createdBy()))
                        .toLowerCase(Locale.ROOT).contains(q))
                .toList());
        Comparator<LinkAdminRow> cmp = switch (sortBy == null ? "createdAt" : sortBy) {
            case "owner" -> Comparator.comparing(LinkAdminRow::ownerName, String.CASE_INSENSITIVE_ORDER);
            case "item" -> Comparator.comparing(LinkAdminRow::label, String.CASE_INSENSITIVE_ORDER);
            case "status" -> Comparator.comparing(LinkAdminRow::status);
            case "opens" -> Comparator.comparingLong(LinkAdminRow::opens);
            case "expiresAt" -> Comparator.comparing(LinkAdminRow::expiresAt, Comparator.nullsLast(Comparator.naturalOrder()));
            case "createdBy" -> Comparator.comparing(r -> r.createdBy() == null ? "" : r.createdBy(), String.CASE_INSENSITIVE_ORDER);
            default -> Comparator.comparing(LinkAdminRow::createdAt, Comparator.nullsLast(Comparator.naturalOrder()));
        };
        rows.sort("asc".equalsIgnoreCase(sortDir) ? cmp : cmp.reversed());
        return PagedList.paginate(rows, page, limit);
    }

    /** Revokes a link on behalf of whoever made it. The Audit Trail names the administrator; the link stops opening anything at once. */
    @Transactional
    public void revokeLink(UUID linkId) {
        UserAccount actor = currentUserService.requireCurrentUser();
        if (!permissionEvaluationService.hasPermission(actor, MANAGE_PERMISSION)) {
            throw new AccessDeniedException("Permission to manage object access rules is required to revoke a link for a Head");
        }
        linkService.revoke(linkId);
    }

    private LinkAdminRow toLinkRow(KnowledgeShareLink l, Instant now) {
        String status = l.getRevokedAt() != null ? "REVOKED" : l.isUsable(now) ? "ACTIVE" : "EXPIRED";
        String owner = l.getOwnerBusinessUnit() != null ? l.getOwnerBusinessUnit().getName() + " (Business Unit)"
                : l.getOwnerDepartment() == null ? "" : l.getOwnerDepartment().getName();
        String scope = switch (l.getScopeKind()) {
            case "BUSINESS_UNIT" -> "Whole Business Unit";
            case "DEPARTMENT" -> "Whole Department";
            case "DOCUMENT_TYPE" -> "Document Type: " + (l.getDocumentType() == null ? "" : l.getDocumentType().getName());
            default -> "Document";
        };
        return new LinkAdminRow(l.getId(), owner, l.getScopeKind(), scope, l.getLabel(), status,
                l.getCreatedBy() == null ? null : l.getCreatedBy().getFullName(), KnowledgeShareAuthorityService.Level.ofStored(l.getCreatedAuthority()).name(),
                l.getCreatedAt(), l.getExpiresAt(), l.getRevokedAt(), l.getRevokedBy() == null ? null : l.getRevokedBy().getFullName(),
                redemptionRepository.countById_LinkId(l.getId()));
    }

    // ---- pickers for the "why" ---------------------------------------------------------------------------------

    @Transactional(readOnly = true)
    public List<GranteeUser> searchUsers(String search, int limit) {
        requireView();
        return sharingService.searchActiveUsers(search, limit);
    }

    @Transactional(readOnly = true)
    public List<DocumentRef> searchDocuments(String search, int limit) {
        requireView();
        String q = search == null ? "" : search.trim().toLowerCase(Locale.ROOT);
        int size = Math.max(1, Math.min(limit, 30));
        org.springframework.data.jpa.domain.Specification<DocumentRecord> spec = (root, query, cb) -> {
            List<Predicate> p = new ArrayList<>();
            if (!q.isEmpty()) {
                String like = "%" + q.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%";
                p.add(cb.or(cb.like(cb.lower(root.get("documentNumber")), like, '\\'), cb.like(cb.lower(root.get("documentName")), like, '\\')));
            }
            return cb.and(p.toArray(Predicate[]::new));
        };
        return documentRepository.findAll(spec, PageRequest.of(0, size, Sort.by("documentNumber"))).stream()
                .map(d -> new DocumentRef(d.getId(), d.getDocumentNumber(), d.getDocumentName(), d.getDepartment() == null ? null : d.getDepartment().getName()))
                .toList();
    }

    // ---- effective access of the Knowledge Base ------------------------------------------------------------------

    /**
     * Why the user can or cannot see the document in the Knowledge Base. The same rules as DocumentService#visibleKnowledgeEntries: the
     * document must be Active with an Effective revision and not a template; a holder of the view-all permission sees every such document;
     * otherwise Own Department compares the Departments, and Sharing asks the decision of the Department Heads' shares.
     */
    @Transactional(readOnly = true)
    public Explanation explain(UUID userId, UUID documentId) {
        requireView();
        UserAccount subject = userRepository.findById(userId).orElseThrow(() -> new IllegalArgumentException("User not found"));
        DocumentRecord document = documentRepository.findById(documentId).orElseThrow(() -> new IllegalArgumentException("Document not found"));
        List<EffectiveAccessDiagnosisLayer> layers = new ArrayList<>();

        boolean active = subject.getStatus() != null && "Active".equalsIgnoreCase(subject.getStatus().name());
        layers.add(new EffectiveAccessDiagnosisLayer("USER_ACTIVE", active, active ? null : "USER_INACTIVE",
                active ? "The user account is active." : "The user account is not active."));

        boolean documentActive = document.getStatus() != null && "ACTIVE".equalsIgnoreCase(document.getStatus().getCode());
        boolean hasEffective = !revisionRepository.findAllByDocument_IdInAndStatus_CodeInOrderByDocument_IdAscCreatedAtDesc(
                List.of(document.getId()), List.of("EFFECTIVE")).isEmpty();
        boolean listed = documentActive && hasEffective && !document.isTemplate();
        layers.add(new EffectiveAccessDiagnosisLayer("DOCUMENT_IN_KNOWLEDGE_BASE", listed, listed ? null : "NOT_LISTED",
                listed ? "The document is Active with an Effective revision, so the Knowledge Base lists it."
                        : "The Knowledge Base lists only Active documents that have an Effective revision, and no template."));

        boolean viewAll = permissionEvaluationService.hasPermission(subject, KnowledgeVisibilityService.KNOWLEDGE_VIEW_ALL_PERMISSION);
        layers.add(new EffectiveAccessDiagnosisLayer("VIEW_ALL", viewAll, viewAll ? null : "NOT_VIEW_ALL",
                viewAll ? "The user holds View All Documents in the Knowledge Base, which shows every Effective document whatever a Head shared or excluded."
                        : "The user does not hold View All Documents in the Knowledge Base."));

        String mode = systemConfigurationService.getKnowledgeVisibilityMode();
        boolean sharing = SystemConfigurationService.KNOWLEDGE_VISIBILITY_SHARING.equals(mode);
        boolean wholeUnit = SystemConfigurationService.KNOWLEDGE_VISIBILITY_OWN_BUSINESS_UNIT.equals(mode);
        boolean everything = SystemConfigurationService.KNOWLEDGE_VISIBILITY_ALL.equals(mode);
        layers.add(new EffectiveAccessDiagnosisLayer("KNOWLEDGE_VISIBILITY_MODE", true, null,
                sharing ? "Knowledge Base visibility is Sharing: only what the Department Head shared is visible."
                        : wholeUnit ? "Knowledge Base visibility is Own Business Unit: a user sees the Effective documents of every Department of their Business Unit."
                        : everything ? "Knowledge Base visibility is All: a user sees every Effective document."
                        : "Knowledge Base visibility is Own Department: a user sees the Effective documents of their own Department."));

        ShareRow deciding = null;
        boolean visible;
        String summary;
        if (!listed) {
            visible = false;
            summary = "The Knowledge Base does not list this document at all.";
        } else if (viewAll) {
            visible = true;
            summary = "Visible: the user holds View All Documents in the Knowledge Base.";
        } else if (everything) {
            visible = true;
            summary = "Visible: the Knowledge Base shows every Effective document to everyone.";
        } else if (wholeUnit) {
            java.util.UUID subjectUnit = documentService.resolveUserBusinessUnitId(subject);
            java.util.UUID documentUnit = document.getDepartment() == null || document.getDepartment().getBusinessUnit() == null
                    ? null : document.getDepartment().getBusinessUnit().getId();
            visible = subjectUnit != null && subjectUnit.equals(documentUnit);
            layers.add(new EffectiveAccessDiagnosisLayer("OWN_BUSINESS_UNIT", visible, visible ? null : "OTHER_BUSINESS_UNIT",
                    visible ? "The document belongs to the user's own Business Unit." : "The document does not belong to the user's own Business Unit."));
            summary = visible ? "Visible: the document is of the user's own Business Unit." : "Not visible: the document is of another Business Unit.";
        } else if (!sharing) {
            java.util.UUID subjectDepartment = documentService.resolveUserDepartmentId(subject);
            java.util.UUID documentDepartment = document.getDepartment() == null ? null : document.getDepartment().getId();
            visible = subjectDepartment != null && subjectDepartment.equals(documentDepartment);
            layers.add(new EffectiveAccessDiagnosisLayer("OWN_DEPARTMENT", visible, visible ? null : "OTHER_DEPARTMENT",
                    visible ? "The document belongs to the user's own Department." : "The document does not belong to the user's own Department."));
            summary = visible ? "Visible: the document is of the user's own Department." : "Not visible: the document is of another Department.";
        } else {
            KnowledgeVisibilityService.Decision decision = visibilityService.decide(subject, KnowledgeVisibilityService.Facts.of(document));
            visible = decision.visible();
            boolean permission = !"NO_PERMISSION".equals(decision.reason());
            layers.add(new EffectiveAccessDiagnosisLayer("KNOWLEDGE_PERMISSION", permission, permission ? null : "MISSING_PERMISSION",
                    permission ? "The user holds the Knowledge permission." : "The user does not hold the Knowledge permission (self_service.knowledge.view)."));
            if (decision.rule() != null) {
                deciding = toRow(decision.rule());
            }
            boolean head = "HEAD".equals(decision.reason()) || "UNIT_HEAD".equals(decision.reason());
            layers.add(new EffectiveAccessDiagnosisLayer("DEPARTMENT_HEAD", head, head ? null : "NOT_THE_HEAD",
                    "UNIT_HEAD".equals(decision.reason()) ? "The user is the Head of Unit of the document's Business Unit, who sees all of it."
                            : head ? "The user is the Department Head of the document's Department, who sees all of it."
                            : "The user is neither the Head of Unit nor the Department Head of the document."));
            boolean shared = "SHARED".equals(decision.reason());
            boolean excluded = "EXCLUDED".equals(decision.reason());
            boolean link = "LINK".equals(decision.reason());
            layers.add(new EffectiveAccessDiagnosisLayer("SHARE", shared || head || link, shared || head || link ? null : excluded ? "EXCLUDED" : "NO_SHARE",
                    shared ? "A share reaches the user: " + deciding.scopeLabel() + " (" + String.join(", ", deciding.grantees()) + ")."
                            : excluded ? "An exclusion keeps the user out: " + deciding.scopeLabel() + " (" + String.join(", ", deciding.grantees()) + ")."
                            : link ? "The user opened a link that covers the document: " + decision.link().getLabel() + "."
                            : head ? "Not needed: the user is a Head."
                            : "No share of a Head reaches the user."));
            summary = switch (decision.reason()) {
                case "HEAD" -> "Visible: the user is the Department Head of this Department.";
                case "UNIT_HEAD" -> "Visible: the user is the Head of Unit of this Business Unit.";
                case "LINK" -> "Visible: the user opened a link that covers it (and the link is still usable).";
                case "SHARED" -> "Visible: the Department Head shared it with the user.";
                case "EXCLUDED" -> "Not visible: the Department Head excluded the user.";
                case "NO_PERMISSION" -> "Not visible: the user does not hold the Knowledge permission.";
                case "NO_DEPARTMENT" -> "Not visible: the document has no Department, so nobody can share it.";
                default -> "Not visible: nothing the Department Head shared reaches the user (closed by default).";
            };
        }
        return new Explanation(subject.getId(), subject.getFullName(), document.getId(),
                document.getDocumentNumber() + " - " + document.getDocumentName(), visible, summary, layers, deciding);
    }

    // ---- helpers -------------------------------------------------------------------------------------------------

    private ShareRow toRow(ObjectAccessRule rule) {
        boolean unit = rule.getOwnerBusinessUnit() != null;
        return new ShareRow(rule.getId(), unit ? rule.getOwnerBusinessUnit().getId() : rule.getOwnerDepartment().getId(),
                unit ? rule.getOwnerBusinessUnit().getName() + " (Business Unit)" : rule.getOwnerDepartment().getName(),
                rule.getResourceType(), KnowledgeSharingService.scopeLabel(rule), rule.getEffect(),
                KnowledgeSharingService.granteeLabels(rule), rule.getCreatedBy() == null ? null : rule.getCreatedBy().getFullName(),
                rule.getCreatedAt(), rule.isActive());
    }

    private void requireView() {
        UserAccount actor = currentUserService.requireCurrentUser();
        if (!permissionEvaluationService.hasAnyPermission(actor, VIEW_PERMISSION, MANAGE_PERMISSION)) {
            throw new AccessDeniedException("Access review view permission required");
        }
    }
}
