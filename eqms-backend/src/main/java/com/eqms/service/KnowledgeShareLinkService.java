package com.eqms.service;

import com.eqms.auth.CurrentUserService;
import com.eqms.dto.audittrail.AuditTrailChangeResponse;
import com.eqms.dto.knowledge.KnowledgeSharingDtos.LinkCreated;
import com.eqms.dto.knowledge.KnowledgeSharingDtos.LinkRequest;
import com.eqms.dto.knowledge.KnowledgeSharingDtos.LinkRow;
import com.eqms.dto.knowledge.KnowledgeSharingDtos.LinkTarget;
import com.eqms.entity.BusinessUnit;
import com.eqms.entity.Department;
import com.eqms.entity.DocumentRecord;
import com.eqms.entity.DocumentRevisionRecord;
import com.eqms.entity.DocumentType;
import com.eqms.entity.KnowledgeCategoryHierarchy;
import com.eqms.entity.KnowledgeShareLink;
import com.eqms.entity.KnowledgeShareLinkRedemption;
import com.eqms.entity.UserAccount;
import com.eqms.enums.KnowledgeField;
import com.eqms.repository.DocumentRevisionRepository;
import com.eqms.repository.KnowledgeCategoryHierarchyRepository;
import com.eqms.repository.KnowledgeShareLinkRedemptionRepository;
import com.eqms.repository.KnowledgeShareLinkRepository;
import com.eqms.service.KnowledgeShareAuthorityService.Level;
import com.eqms.service.KnowledgeSharingService.Target;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Base64;
import java.util.HexFormat;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

/**
 * Links to the Knowledge Base: to the folder of a Business Unit, of a Department, of a Document Type of a Department, or to one document. A person
 * who opens a link signed in (and who holds the Knowledge permission) is given what the link points to until it expires or is revoked: the opening
 * is recorded as a redemption, and the visibility decision (KnowledgeVisibilityService) reads the usable links a user opened, so lists, search and
 * the preview all agree. The token is shown once, when the link is made; only its SHA-256 is stored. An exclusion of the Heads is never undone by a
 * link. Making, revoking and opening a link are written to the Audit Trail; a delegate who makes or revokes one tells the Head by e-mail.
 */
@Service
public class KnowledgeShareLinkService {
    static final Set<Integer> EXPIRY_DAYS = Set.of(1, 7, 30, 90);
    private static final DateTimeFormatter WHEN = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm").withZone(ZoneId.systemDefault());
    private static final SecureRandom RANDOM = new SecureRandom();

    private final KnowledgeShareLinkRepository linkRepository;
    private final KnowledgeShareLinkRedemptionRepository redemptionRepository;
    private final KnowledgeCategoryHierarchyRepository hierarchyRepository;
    private final DocumentRevisionRepository revisionRepository;
    private final KnowledgeSharingService sharingService;
    private final KnowledgeShareAuthorityService authority;
    private final KnowledgeShareNotifier notifier;
    private final CurrentUserService currentUserService;
    private final PermissionEvaluationService permissionEvaluationService;
    private final SystemConfigurationService systemConfigurationService;
    private final AuditTrailService auditTrailService;

    public KnowledgeShareLinkService(KnowledgeShareLinkRepository linkRepository, KnowledgeShareLinkRedemptionRepository redemptionRepository,
                                     KnowledgeCategoryHierarchyRepository hierarchyRepository, DocumentRevisionRepository revisionRepository,
                                     KnowledgeSharingService sharingService, KnowledgeShareAuthorityService authority, KnowledgeShareNotifier notifier,
                                     CurrentUserService currentUserService, PermissionEvaluationService permissionEvaluationService,
                                     SystemConfigurationService systemConfigurationService, AuditTrailService auditTrailService) {
        this.linkRepository = linkRepository;
        this.redemptionRepository = redemptionRepository;
        this.hierarchyRepository = hierarchyRepository;
        this.revisionRepository = revisionRepository;
        this.sharingService = sharingService;
        this.authority = authority;
        this.notifier = notifier;
        this.currentUserService = currentUserService;
        this.permissionEvaluationService = permissionEvaluationService;
        this.systemConfigurationService = systemConfigurationService;
        this.auditTrailService = auditTrailService;
    }

    // ---- making and listing -----------------------------------------------------------------------------------------

    @Transactional
    public LinkCreated create(LinkRequest request) {
        UserAccount actor = currentUserService.requireCurrentUser();
        Target target = sharingService.requireTarget(actor, request.kind(), request.businessUnitId(), request.departmentId(), request.documentTypeId(), request.documentId());
        Level level = sharingService.levelOf(actor, target);
        Integer days = request.expiresInDays();
        if (days == null) {
            if (!level.atLeast(Level.DEPARTMENT_HEAD)) {
                throw new AccessDeniedException("A person who shares on behalf of a Head must give a link an expiry: only a Head can make a link that does not expire");
            }
        } else if (!EXPIRY_DAYS.contains(days)) {
            throw new IllegalArgumentException("A link expires after 1, 7, 30 or 90 days");
        }
        String token = newToken();
        KnowledgeShareLink link = new KnowledgeShareLink();
        link.setTokenHash(hash(token));
        link.setScopeKind(target.kind());
        if (target.kind().equals("BUSINESS_UNIT")) {
            link.setOwnerBusinessUnit(target.unit());
        } else {
            link.setOwnerDepartment(target.department());
            link.setDocumentType(target.type());
            link.setDocument(target.document());
        }
        link.setLabel(KnowledgeSharingService.nodeLabel(target));
        link.setCreatedBy(actor);
        link.setCreatedAuthority(level.name());
        link.setExpiresAt(days == null ? null : Instant.now().plus(days, ChronoUnit.DAYS));
        linkRepository.save(link);
        String expiry = link.getExpiresAt() == null ? "does not expire" : "expires " + WHEN.format(link.getExpiresAt());
        auditTrailService.logAs(actor, "KNOWLEDGE_SHARE_LINK", link.getLabel(), link.getId(), "CREATED", null, "Active",
                "Made a link to " + link.getLabel() + " in the Knowledge Base (" + expiry + ")"
                        + (level == Level.DELEGATE ? " (made by a person who may share on behalf of the Head)" : ""),
                List.of(new AuditTrailChangeResponse("Item", null, link.getLabel()), new AuditTrailChangeResponse("Expiry", null, expiry)));
        if (level == Level.DELEGATE) {
            notifier.tell(target.department() != null ? authority.headsToTell(target.department()) : authority.headsToTell(target.unit()), actor,
                    "a delegate made a link", "made a link to " + link.getLabel() + " in the Knowledge Base", link.getLabel(),
                    target.department() != null ? "Department " + target.department().getName() : "Business Unit " + target.unit().getName(),
                    "The link " + expiry + ". Anyone signed in who opens it sees what it points to until it is revoked.");
        }
        return new LinkCreated(toRow(link, target.rank(), actor), token);
    }

    /** The links that reach an item: on the item itself, and the wider ones it inherits. */
    @Transactional(readOnly = true)
    public List<LinkRow> list(String kind, UUID businessUnitId, UUID departmentId, UUID documentTypeId, UUID documentId) {
        UserAccount actor = currentUserService.requireCurrentUser();
        Target target = sharingService.requireTarget(actor, kind, businessUnitId, departmentId, documentTypeId, documentId);
        List<KnowledgeShareLink> links = new ArrayList<>();
        if (target.department() != null) {
            links.addAll(linkRepository.findAllByOwnerDepartment_IdOrderByCreatedAtDesc(target.department().getId()));
        }
        if (target.unit() != null) {
            links.addAll(linkRepository.findAllByOwnerBusinessUnit_IdOrderByCreatedAtDesc(target.unit().getId()));
        }
        return links.stream()
                .filter(l -> covers(l, target))
                .sorted(java.util.Comparator.comparing(KnowledgeShareLink::getCreatedAt).reversed())
                .map(l -> toRow(l, target.rank(), actor))
                .toList();
    }

    /** One page of the links that reach an item, searched by what they point to or who made them. */
    @Transactional(readOnly = true)
    public com.eqms.dto.knowledge.KnowledgeSharingDtos.Paged<LinkRow> page(String kind, UUID businessUnitId, UUID departmentId, UUID documentTypeId,
                                                                           UUID documentId, String search, int offset, int limit) {
        String q = search == null ? "" : search.trim().toLowerCase(Locale.ROOT);
        List<LinkRow> all = list(kind, businessUnitId, departmentId, documentTypeId, documentId).stream()
                .filter(l -> q.isEmpty() || (l.label() != null && l.label().toLowerCase(Locale.ROOT).contains(q))
                        || (l.createdBy() != null && l.createdBy().toLowerCase(Locale.ROOT).contains(q)))
                .toList();
        int from = Math.max(0, Math.min(offset, all.size()));
        return new com.eqms.dto.knowledge.KnowledgeSharingDtos.Paged<>(all.subList(from, Math.min(all.size(), from + Math.max(1, Math.min(limit, 50)))), all.size());
    }

    @Transactional
    public void revoke(UUID linkId) {
        UserAccount actor = currentUserService.requireCurrentUser();
        KnowledgeShareLink link = linkRepository.findById(linkId).orElseThrow(() -> new IllegalArgumentException("Link not found"));
        Level mine = levelOverOwner(actor, link);
        if (!authority.mayRemove(actor, mine, link.getCreatedAuthority(), link.getCreatedBy())) {
            throw new AccessDeniedException("You may not revoke this link: it was made by "
                    + Level.ofStored(link.getCreatedAuthority()).name().toLowerCase(Locale.ROOT).replace('_', ' ')
                    + ", and only somebody of the same or a higher level (and, for a delegate, only its maker) can revoke it");
        }
        if (link.getRevokedAt() != null) {
            return;
        }
        link.setRevokedAt(Instant.now());
        link.setRevokedBy(actor);
        linkRepository.save(link);
        auditTrailService.logAs(actor, "KNOWLEDGE_SHARE_LINK", link.getLabel(), link.getId(), "REVOKED", "Active", "Revoked",
                "Revoked the link to " + link.getLabel() + ": it no longer opens anything" + (mine == Level.DELEGATE ? " (by a person who may share on behalf of the Head)" : ""),
                List.of(new AuditTrailChangeResponse("Status", "Active", "Revoked")));
        if (mine == Level.DELEGATE) {
            List<UserAccount> heads = link.getOwnerDepartment() != null ? authority.headsToTell(link.getOwnerDepartment()) : authority.headsToTell(link.getOwnerBusinessUnit());
            notifier.tell(heads, actor, "a delegate revoked a link", "revoked a link he or she had made in the Knowledge Base", link.getLabel(),
                    link.getOwnerDepartment() != null ? "Department " + link.getOwnerDepartment().getName() : "Business Unit " + link.getOwnerBusinessUnit().getName(),
                    "The link no longer opens anything.");
        }
    }

    // ---- opening ------------------------------------------------------------------------------------------------------

    /**
     * A signed-in user opens a link. The answer is the same for a token that never existed, one that was revoked and one that expired, so the
     * answer tells nothing about which tokens exist.
     */
    @Transactional
    public LinkTarget redeem(String token) {
        UserAccount actor = currentUserService.requireCurrentUser();
        KnowledgeShareLink link = token == null || token.isBlank() ? null : linkRepository.findByTokenHash(hash(token.trim())).orElse(null);
        if (link == null || !link.isUsable(Instant.now())) {
            throw new IllegalArgumentException("This link is not valid, has expired or was revoked");
        }
        if (!permissionEvaluationService.hasPermission(actor, KnowledgeVisibilityService.KNOWLEDGE_VIEW_PERMISSION)) {
            throw new AccessDeniedException("You need the Knowledge permission to open this link");
        }
        if (!SystemConfigurationService.KNOWLEDGE_VISIBILITY_SHARING.equals(systemConfigurationService.getKnowledgeVisibilityMode())) {
            throw new IllegalArgumentException("Sharing is not switched on for the Knowledge Base, so this link cannot open anything yet");
        }
        KnowledgeShareLinkRedemption.Key key = new KnowledgeShareLinkRedemption.Key(link.getId(), actor.getId());
        KnowledgeShareLinkRedemption redemption = redemptionRepository.findById(key).orElse(null);
        if (redemption == null) {
            redemptionRepository.save(new KnowledgeShareLinkRedemption(link.getId(), actor.getId()));
        } else {
            redemption.opened();
            redemptionRepository.save(redemption);
        }
        auditTrailService.logAs(actor, "KNOWLEDGE_SHARE_LINK", link.getLabel(), link.getId(), "LINK_OPENED", null, null,
                "Opened the link to " + link.getLabel() + " in the Knowledge Base", List.of());
        return describe(link);
    }

    // ---- helpers ------------------------------------------------------------------------------------------------------

    private LinkTarget describe(KnowledgeShareLink link) {
        if (link.getScopeKind().equals("DOCUMENT")) {
            DocumentRecord d = link.getDocument();
            String revision = revisionRepository.findAllByDocument_IdInAndStatus_CodeInOrderByDocument_IdAscCreatedAtDesc(List.of(d.getId()), List.of("EFFECTIVE"))
                    .stream().findFirst().map(DocumentRevisionRecord::getRevisionNumber).orElse(null);
            return new LinkTarget("DOCUMENT", link.getLabel(), d.getId(), d.getDocumentNumber(), d.getDocumentName(), revision,
                    d.getDepartment() == null ? null : d.getDepartment().getName(), null, null, null, List.of());
        }
        // a folder: the explorer is opened at it when the hierarchy can express it (the Business Unit, Department and Document Type must follow each other)
        List<KnowledgeCategoryHierarchy> active = hierarchyRepository.findAllByActiveTrueOrderByNameAsc();
        KnowledgeCategoryHierarchy hierarchy = active.stream().filter(KnowledgeCategoryHierarchy::isDefaultHierarchy).findFirst()
                .orElse(active.isEmpty() ? null : active.get(0));
        if (hierarchy == null) {
            return new LinkTarget(link.getScopeKind(), link.getLabel(), null, null, null, null, null, null, null, null, List.of());
        }
        BusinessUnit unit = link.getOwnerBusinessUnit() != null ? link.getOwnerBusinessUnit()
                : link.getOwnerDepartment() == null ? null : link.getOwnerDepartment().getBusinessUnit();
        Department department = link.getOwnerDepartment();
        DocumentType type = link.getDocumentType();
        KnowledgeField deepest = link.getScopeKind().equals("BUSINESS_UNIT") ? KnowledgeField.BUSINESS_UNIT
                : link.getScopeKind().equals("DEPARTMENT") ? KnowledgeField.DEPARTMENT : KnowledgeField.DOCUMENT_TYPE;
        List<String> fieldCodes = new ArrayList<>();
        fieldCodes.add(hierarchy.getDeterminatorField());
        hierarchy.getLevels().forEach(l -> fieldCodes.add(l.getFieldCode()));
        List<String> keys = new ArrayList<>();
        String firstLabel = null;
        boolean reached = false;
        for (String code : fieldCodes) {
            KnowledgeField field = KnowledgeField.parse(code).orElse(null);
            String key = null;
            String label = null;
            if (field == KnowledgeField.BUSINESS_UNIT && unit != null) {
                key = unit.getId().toString();
                label = unit.getName();
            } else if (field == KnowledgeField.DEPARTMENT && department != null) {
                key = department.getId().toString();
                label = department.getName();
            } else if (field == KnowledgeField.DOCUMENT_TYPE && type != null) {
                key = type.getId().toString();
                label = type.getName();
            }
            if (key == null) {
                break;
            }
            keys.add(key);
            if (firstLabel == null) {
                firstLabel = label;
            }
            if (field == deepest) {
                reached = true;
                break;
            }
        }
        if (!reached || keys.isEmpty()) {
            return new LinkTarget(link.getScopeKind(), link.getLabel(), null, null, null, null, null, hierarchy.getId(), null, null, List.of());
        }
        return new LinkTarget(link.getScopeKind(), link.getLabel(), null, null, null, null, null, hierarchy.getId(), keys.get(0), firstLabel,
                keys.subList(1, keys.size()));
    }

    private Level levelOverOwner(UserAccount actor, KnowledgeShareLink link) {
        return link.getOwnerBusinessUnit() != null ? authority.levelOver(actor, link.getOwnerBusinessUnit()) : authority.levelOver(actor, link.getOwnerDepartment());
    }

    /** Whether a link reaches the item: the same or a wider item. */
    private static boolean covers(KnowledgeShareLink link, Target target) {
        return switch (link.getScopeKind()) {
            case "BUSINESS_UNIT" -> target.unit() != null && link.getOwnerBusinessUnit() != null && Objects.equals(link.getOwnerBusinessUnit().getId(), target.unit().getId());
            case "DEPARTMENT" -> target.rank() >= 1;
            case "DOCUMENT_TYPE" -> target.rank() >= 2 && link.getDocumentType() != null && (target.type() != null
                    ? Objects.equals(link.getDocumentType().getId(), target.type().getId())
                    : target.document() != null && target.document().getDocumentType() != null
                            && Objects.equals(link.getDocumentType().getId(), target.document().getDocumentType().getId()));
            default -> target.rank() == 3 && link.getDocument() != null && Objects.equals(link.getDocument().getId(), target.document().getId());
        };
    }

    private static int rank(KnowledgeShareLink link) {
        return switch (link.getScopeKind()) {
            case "BUSINESS_UNIT" -> 0;
            case "DEPARTMENT" -> 1;
            case "DOCUMENT_TYPE" -> 2;
            default -> 3;
        };
    }

    private LinkRow toRow(KnowledgeShareLink link, int targetRank, UserAccount actor) {
        Instant now = Instant.now();
        String status = link.getRevokedAt() != null ? "REVOKED" : link.isUsable(now) ? "ACTIVE" : "EXPIRED";
        boolean revocable = "ACTIVE".equals(status)
                && authority.mayRemove(actor, levelOverOwner(actor, link), link.getCreatedAuthority(), link.getCreatedBy());
        String scopeLabel = switch (link.getScopeKind()) {
            case "BUSINESS_UNIT" -> "Whole Business Unit";
            case "DEPARTMENT" -> "Whole Department";
            case "DOCUMENT_TYPE" -> "Document Type: " + (link.getDocumentType() == null ? "" : link.getDocumentType().getName());
            default -> "Document";
        };
        return new LinkRow(link.getId(), link.getScopeKind(), scopeLabel, link.getLabel(), rank(link) < targetRank, status,
                link.getCreatedBy() == null ? null : link.getCreatedBy().getFullName(), Level.ofStored(link.getCreatedAuthority()).name(),
                WHEN.format(link.getCreatedAt()), link.getExpiresAt() == null ? null : WHEN.format(link.getExpiresAt()),
                link.getRevokedAt() == null ? null : WHEN.format(link.getRevokedAt()),
                link.getRevokedBy() == null ? null : link.getRevokedBy().getFullName(), redemptionRepository.countById_LinkId(link.getId()), revocable);
    }

    static String newToken() {
        byte[] bytes = new byte[32];
        RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    static String hash(String token) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(token.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException ex) {
            throw new IllegalStateException(ex);
        }
    }
}
