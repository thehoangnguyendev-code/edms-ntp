package com.eqms.service;

import com.eqms.auth.CurrentUserService;
import com.eqms.dto.audittrail.AuditTrailChangeResponse;
import com.eqms.dto.audittrail.AuditTrailDetailResponse;
import com.eqms.dto.audittrail.AuditTrailRecordResponse;
import com.eqms.dto.audittrail.AuditTrailUserOptionResponse;
import com.eqms.dto.audittrail.AuditTrailUserResponse;
import com.eqms.config.AuditRequestTimingFilter;
import com.eqms.dto.user.PageResponse;
import com.eqms.dto.user.PaginationResponse;
import com.eqms.entity.AuditLogChange;
import com.eqms.entity.AuditLog;
import com.eqms.entity.DocumentRecord;
import com.eqms.entity.DocumentRevisionRecord;
import com.eqms.entity.ControlledCopyRecord;
import com.eqms.entity.ControlledCopyDistributionBatch;
import com.eqms.entity.UserAccount;
import com.eqms.repository.AuditLogChangeRepository;
import com.eqms.repository.AuditLogRepository;
import com.eqms.repository.DocumentRecordRepository;
import com.eqms.repository.DocumentRevisionRepository;
import com.eqms.repository.ControlledCopyRepository;
import com.eqms.repository.ControlledCopyDistributionBatchRepository;
import com.eqms.repository.UserAccountRepository;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.persistence.criteria.Expression;
import jakarta.persistence.criteria.Join;
import jakarta.persistence.criteria.JoinType;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.context.request.RequestAttributes;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.io.BufferedWriter;
import java.io.IOException;
import java.io.OutputStream;
import java.io.OutputStreamWriter;
import java.io.Writer;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import java.util.stream.Stream;

@Service
public class AuditTrailService {

    private static final DateTimeFormatter FORMATTER = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm:ss")
            .withZone(ZoneId.systemDefault());
    private static final UUID AUDIT_TRAIL_SYSTEM_ENTITY_ID = UUID.nameUUIDFromBytes(
            "EQMS_AUDIT_TRAIL".getBytes(java.nio.charset.StandardCharsets.UTF_8));
    private static final String AUDIT_VIEW_PERMISSION = "audit.view";
    private static final String AUDIT_EXPORT_PERMISSION = "audit.export";

    private final AuditLogRepository auditLogRepository;
    private final AuditLogChangeRepository auditLogChangeRepository;
    private final CurrentUserService currentUserService;
    private final UserAccountRepository userAccountRepository;
    private final DocumentRecordRepository documentRecordRepository;
    private final DocumentRevisionRepository documentRevisionRepository;
    private final ControlledCopyRepository controlledCopyRepository;
    private final ControlledCopyDistributionBatchRepository controlledCopyDistributionBatchRepository;
    private final PermissionEvaluationService permissionEvaluationService;
    /**
     * Resolve lazily because document authorization itself records/reads audit
     * information.  Eager constructor injection creates a Spring bean cycle
     * during startup (AuditTrailService -> DocumentAuthorizationService ->
     * workflow policy -> AuditTrailService).
     */
    private final ObjectProvider<DocumentAuthorizationService> documentAuthorizationServiceProvider;

    @org.springframework.beans.factory.annotation.Autowired
    private com.eqms.auth.TokenService tokenService;

    // @Lazy breaks the circular dependency: ElectronicSignatureService's constructor already
    // depends on AuditTrailService.
    @org.springframework.beans.factory.annotation.Autowired
    @org.springframework.context.annotation.Lazy
    private ElectronicSignatureService electronicSignatureService;

    public AuditTrailService(
            AuditLogRepository auditLogRepository,
            AuditLogChangeRepository auditLogChangeRepository,
            CurrentUserService currentUserService,
            UserAccountRepository userAccountRepository,
            DocumentRecordRepository documentRecordRepository,
            DocumentRevisionRepository documentRevisionRepository,
            ControlledCopyRepository controlledCopyRepository,
            ControlledCopyDistributionBatchRepository controlledCopyDistributionBatchRepository,
            PermissionEvaluationService permissionEvaluationService,
            ObjectProvider<DocumentAuthorizationService> documentAuthorizationServiceProvider
    ) {
        this.auditLogRepository = auditLogRepository;
        this.auditLogChangeRepository = auditLogChangeRepository;
        this.currentUserService = currentUserService;
        this.userAccountRepository = userAccountRepository;
        this.documentRecordRepository = documentRecordRepository;
        this.documentRevisionRepository = documentRevisionRepository;
        this.controlledCopyRepository = controlledCopyRepository;
        this.controlledCopyDistributionBatchRepository = controlledCopyDistributionBatchRepository;
        this.permissionEvaluationService = permissionEvaluationService;
        this.documentAuthorizationServiceProvider = documentAuthorizationServiceProvider;
    }

    @Transactional(readOnly = true)
    public PageResponse<AuditTrailRecordResponse> list(
            String search,
            String module,
            String action,
            String user,
            String severity,
            String documentNumber,
            String entityId,
            String status,
            String ipAddress,
            Boolean eSignatureOnly,
            String dateFrom,
            String dateTo,
            String sortBy,
            String sortDirection,
            int page,
            int limit
    ) {
        if (StringUtils.hasText(entityId) && StringUtils.hasText(module)
                && ("DOCUMENT".equalsIgnoreCase(module) || "REVISION".equalsIgnoreCase(module))) {
            requireScopedEntityView(module, entityId);
        } else {
            requireAuditView();
        }
        return listQuery(search, module, action, user, severity, documentNumber, entityId, status, ipAddress,
                eSignatureOnly, dateFrom, dateTo, sortBy, sortDirection, page, limit);
    }

    /**
     * Shared database query for the interactive register and an authorized
     * export. Authorization is deliberately performed by the public caller:
     * {@code audit.export} is a distinct entitlement and must not be silently
     * made dependent on {@code audit.view} while retaining the same data scope.
     */
    private PageResponse<AuditTrailRecordResponse> listQuery(
            String search,
            String module,
            String action,
            String user,
            String severity,
            String documentNumber,
            String entityId,
            String status,
            String ipAddress,
            Boolean eSignatureOnly,
            String dateFrom,
            String dateTo,
            String sortBy,
            String sortDirection,
            int page,
            int limit
    ) {
        AuditTrailDateRange resolvedDateRange = resolveAuditTrailDateRange(dateFrom, dateTo);
        String sortProperty;
        String key = StringUtils.hasText(sortBy) ? sortBy.trim().toLowerCase(Locale.ROOT) : "timestamp";
        switch (key) {
            case "user":
            case "fullname":
                sortProperty = "actedBy.fullName";
                break;
            case "module":
                sortProperty = "entityType";
                break;
            case "action":
                sortProperty = "actionType";
                break;
            case "entityid":
                sortProperty = "entityId";
                break;
            case "description":
                sortProperty = "comment";
                break;
            default:
                sortProperty = "createdAt";
                break;
        }

        Sort.Direction direction = "desc".equalsIgnoreCase(sortDirection) ? Sort.Direction.DESC : Sort.Direction.ASC;
        Sort sort = Sort.by(direction, sortProperty);
        if (!"createdAt".equals(sortProperty)) {
            sort = sort.and(Sort.by(Sort.Direction.DESC, "createdAt"));
        }

        int safePage = Math.max(page, 1);
        int safeLimit = Math.max(limit, 1);
        Pageable pageable = PageRequest.of(safePage - 1, safeLimit, sort);

        Specification<AuditLog> spec = (root, query, builder) -> {
            List<Predicate> predicates = new ArrayList<>();

            // 1. Search filter
            if (StringUtils.hasText(search)) {
                String likePattern = "%" + search.toLowerCase(Locale.ROOT) + "%";
                List<Predicate> searchPredicates = new ArrayList<>();
                searchPredicates.add(builder.like(builder.lower(root.get("entityType")), likePattern));
                searchPredicates.add(builder.like(builder.lower(root.get("actionType")), likePattern));
                searchPredicates.add(builder.like(builder.lower(root.get("comment")), likePattern));
                searchPredicates.add(builder.like(builder.lower(root.get("fromStatus")), likePattern));
                searchPredicates.add(builder.like(builder.lower(root.get("toStatus")), likePattern));
                
                Join<AuditLog, UserAccount> actedByJoin = root.join("actedBy", JoinType.LEFT);
                searchPredicates.add(builder.like(builder.lower(actedByJoin.get("fullName")), likePattern));
                searchPredicates.add(builder.like(builder.lower(actedByJoin.get("username")), likePattern));
                searchPredicates.add(builder.like(builder.lower(actedByJoin.get("employeeCode")), likePattern));
                
                predicates.add(builder.or(searchPredicates.toArray(new Predicate[0])));
            }

            // 2. Module filter
            if (StringUtils.hasText(module) && !"All".equalsIgnoreCase(module)) {
                String normalizedModule = module.trim().toUpperCase(Locale.ROOT);
                Expression<String> entityTypeUpper = builder.upper(root.get("entityType"));
                switch (normalizedModule) {
                    case "DOCUMENT":
                        predicates.add(builder.equal(entityTypeUpper, "DOCUMENT"));
                        break;
                    case "REVISION":
                        predicates.add(builder.equal(entityTypeUpper, "REVISION"));
                        break;
                    case "USER":
                        predicates.add(entityTypeUpper.in("USER", "USER_ACCOUNT"));
                        break;
                    case "ROLE":
                        predicates.add(builder.equal(entityTypeUpper, "ROLE"));
                        break;
                    case "PROMPT":
                        predicates.add(entityTypeUpper.in("PROMPT_SPECIFICATION", "PROMPT_GENERATION_RUN", "GENERATED_ARTIFACT"));
                        break;
                    case "CAPA":
                        predicates.add(builder.equal(entityTypeUpper, "CAPA"));
                        break;
                    case "DEVIATION":
                        predicates.add(builder.equal(entityTypeUpper, "DEVIATION"));
                        break;
                    case "TRAINING":
                        predicates.add(builder.equal(entityTypeUpper, "TRAINING"));
                        break;
                    case "CONTROLLED COPY":
                        predicates.add(builder.equal(entityTypeUpper, "CONTROLLED_COPY"));
                        break;
                    case "SETTINGS":
                        predicates.add(entityTypeUpper.in("SETTINGS", "SYSTEM_CONFIGURATION", "SYSTEM"));
                        break;
                    case "SYSTEM":
                        predicates.add(builder.or(
                            entityTypeUpper.in("SESSION", "AUTH", "AUTHENTICATION"),
                            builder.isNull(root.get("entityType")),
                            builder.equal(root.get("entityType"), "")
                        ));
                        break;
                    default:
                        predicates.add(builder.equal(entityTypeUpper, normalizedModule));
                        break;
                }
            }

            // 3. Action filter
            if (StringUtils.hasText(action) && !"All".equalsIgnoreCase(action)) {
                String normalizedAction = action.trim().toUpperCase(Locale.ROOT);
                Expression<String> actionTypeUpper = builder.upper(root.get("actionType"));
                switch (normalizedAction) {
                    case "CREATE":
                        predicates.add(builder.equal(actionTypeUpper, "CREATE"));
                        break;
                    case "UPDATE":
                        predicates.add(builder.or(
                            builder.equal(actionTypeUpper, "UPDATE"),
                            builder.isNull(root.get("actionType")),
                            builder.equal(root.get("actionType"), "")
                        ));
                        break;
                    case "DELETE":
                        predicates.add(builder.equal(actionTypeUpper, "DELETE"));
                        break;
                    case "REPLACE":
                        predicates.add(builder.equal(actionTypeUpper, "REPLACE"));
                        break;
                    case "APPROVE":
                        predicates.add(actionTypeUpper.in("APPROVE_COMPLETE", "APPROVE"));
                        break;
                    case "REJECT":
                        predicates.add(actionTypeUpper.in("APPROVE_REJECT", "REJECT"));
                        break;
                    case "REVIEW":
                        predicates.add(actionTypeUpper.in("REVIEW_COMPLETE", "REVIEW"));
                        break;
                    case "PUBLISH":
                        predicates.add(actionTypeUpper.in("PUBLISH", "PUBLISH_TO_EFFECTIVE"));
                        break;
                    case "ARCHIVE":
                        predicates.add(builder.equal(actionTypeUpper, "ARCHIVE"));
                        break;
                    case "RESTORE":
                        predicates.add(builder.equal(actionTypeUpper, "RESTORE"));
                        break;
                    case "LOGIN":
                        predicates.add(builder.equal(actionTypeUpper, "LOGIN"));
                        break;
                    case "LOGOUT":
                        predicates.add(builder.equal(actionTypeUpper, "LOGOUT"));
                        break;
                    case "EXPORT":
                        predicates.add(builder.equal(actionTypeUpper, "EXPORT"));
                        break;
                    case "DOWNLOAD":
                        predicates.add(builder.equal(actionTypeUpper, "DOWNLOAD"));
                        break;
                    case "VIEW":
                        predicates.add(actionTypeUpper.in("VIEW", "OPEN", "PREVIEW", "OPEN_PREVIEW", "VIEW_PAGE"));
                        break;
                    case "OPEN":
                        predicates.add(actionTypeUpper.in("OPEN", "VIEW", "OPEN_PREVIEW", "OPEN_EDIT_ONLINE", "OPEN_PUBLISHING_WORKSPACE"));
                        break;
                    case "PREVIEW":
                        predicates.add(actionTypeUpper.in("PREVIEW", "VIEW", "OPEN_PREVIEW", "GENERATE_PUBLISHING_PREVIEW"));
                        break;
                    case "OPEN PREVIEW":
                        predicates.add(actionTypeUpper.in("OPEN_PREVIEW", "PREVIEW", "VIEW"));
                        break;
                    case "VIEW PAGE":
                        predicates.add(builder.equal(actionTypeUpper, "VIEW_PAGE"));
                        break;
                    case "CLOSE PREVIEW":
                        predicates.add(builder.equal(actionTypeUpper, "CLOSE_PREVIEW"));
                        break;
                    case "UPLOAD":
                        predicates.add(actionTypeUpper.in("UPLOAD", "UPLOAD_FILE", "REVISION_SOURCE_FILE_UPLOADED", "UPLOAD_TO_OFFICE_ONLINE", "EDIT_ONLINE_SYNCED_BACK_TO_MINIO", "REVIEW_PDF_GENERATED"));
                        break;
                    case "UPLOAD TO OFFICE ONLINE":
                        predicates.add(builder.equal(actionTypeUpper, "UPLOAD_TO_OFFICE_ONLINE"));
                        break;
                    case "GENERATE":
                        predicates.add(actionTypeUpper.in("GENERATE", "GENERATE_PUBLISHING_PREVIEW", "REVIEW_PDF_GENERATED"));
                        break;
                    case "ASSIGN":
                        predicates.add(builder.equal(actionTypeUpper, "ASSIGN"));
                        break;
                    case "UNASSIGN":
                        predicates.add(builder.equal(actionTypeUpper, "UNASSIGN"));
                        break;
                    case "ENABLE":
                        predicates.add(builder.equal(actionTypeUpper, "ENABLE"));
                        break;
                    case "DISABLE":
                        predicates.add(builder.equal(actionTypeUpper, "DISABLE"));
                        break;
                    case "CANCEL":
                        predicates.add(builder.equal(actionTypeUpper, "CANCEL"));
                        break;
                    case "OBSOLETE":
                        predicates.add(builder.equal(actionTypeUpper, "OBSOLETE"));
                        break;
                    case "E-SIGNATURE SUCCESS":
                        predicates.add(builder.equal(actionTypeUpper, "SIGNATURE_SUCCESS"));
                        break;
                    case "E-SIGNATURE FAILED":
                        predicates.add(builder.equal(actionTypeUpper, "SIGNATURE_FAILED"));
                        break;
                    case "CHANGE PERMISSION":
                        predicates.add(builder.equal(actionTypeUpper, "CHANGE_PERMISSION"));
                        break;
                    case "CHANGE SYSTEM CONFIGURATION":
                        predicates.add(builder.equal(actionTypeUpper, "CHANGE_CONFIGURATION"));
                        break;
                    case "SUBMIT":
                        predicates.add(actionTypeUpper.in("SUBMIT", "SUBMIT_FOR_REVIEW", "SUBMIT_REVIEW"));
                        break;
                    case "FAILED LOGIN":
                        predicates.add(builder.equal(actionTypeUpper, "FAILED_LOGIN"));
                        break;
                    case "REPLACE FILE":
                        predicates.add(builder.equal(actionTypeUpper, "REPLACE_FILE"));
                        break;
                    case "UPDATE METADATA":
                        predicates.add(builder.equal(actionTypeUpper, "UPDATE_METADATA"));
                        break;
                    case "ADD WORKING NOTE":
                        predicates.add(builder.equal(actionTypeUpper, "ADD_WORKING_NOTE"));
                        break;
                    case "DELETE WORKING NOTE":
                        predicates.add(builder.equal(actionTypeUpper, "DELETE_WORKING_NOTE"));
                        break;
                    case "DOWNLOAD EVIDENCE":
                        predicates.add(builder.equal(actionTypeUpper, "DOWNLOAD_EVIDENCE"));
                        break;
                    default:
                        predicates.add(builder.equal(actionTypeUpper, normalizedAction));
                        break;
                }
            }

            // 4. User filter
            if (StringUtils.hasText(user)) {
                String likePattern = "%" + user.toLowerCase(Locale.ROOT) + "%";
                Join<AuditLog, UserAccount> actedByJoin = root.join("actedBy", JoinType.LEFT);
                predicates.add(builder.or(
                    builder.like(builder.lower(actedByJoin.get("fullName")), likePattern),
                    builder.like(builder.lower(actedByJoin.get("username")), likePattern),
                    builder.like(builder.lower(actedByJoin.get("employeeCode")), likePattern)
                ));
            }

            // 5. Severity filter
            if (StringUtils.hasText(severity) && !"All".equalsIgnoreCase(severity)) {
                String normalizedSeverity = severity.trim().toUpperCase(Locale.ROOT);
                Expression<String> actionTypeUpper = builder.upper(root.get("actionType"));
                List<String> highActionTypes = List.of("DELETE", "APPROVE_REJECT", "REJECT", "DISABLE", "CANCEL");
                List<String> mediumActionTypes = List.of(
                    "APPROVE_COMPLETE", "APPROVE", "PUBLISH", "ENABLE", "CREATE", "UPDATE",
                    "UPLOAD", "UPLOAD_FILE", "REVISION_SOURCE_FILE_UPLOADED", "UPLOAD_TO_OFFICE_ONLINE", "EDIT_ONLINE_SYNCED_BACK_TO_MINIO", "REVIEW_PDF_GENERATED",
                    "ASSIGN", "REVIEW_COMPLETE", "REVIEW", "GENERATE", "OPEN_EDIT_ONLINE"
                );
                
                if ("HIGH".equals(normalizedSeverity)) {
                    predicates.add(actionTypeUpper.in(highActionTypes));
                } else if ("MEDIUM".equals(normalizedSeverity)) {
                    predicates.add(builder.or(
                        actionTypeUpper.in(mediumActionTypes),
                        builder.isNull(root.get("actionType")),
                        builder.equal(root.get("actionType"), "")
                    ));
                } else if ("LOW".equals(normalizedSeverity)) {
                    predicates.add(builder.not(
                        builder.or(
                            actionTypeUpper.in(highActionTypes),
                            actionTypeUpper.in(mediumActionTypes),
                            builder.isNull(root.get("actionType")),
                            builder.equal(root.get("actionType"), "")
                        )
                    ));
                }
            }

            // 6. Document Number filter (entityName, entityId, comment, documentNumber)
            if (StringUtils.hasText(documentNumber)) {
                String likePattern = "%" + documentNumber.toLowerCase(Locale.ROOT) + "%";
                List<Predicate> documentPredicates = new ArrayList<>();
                documentPredicates.add(builder.like(builder.lower(root.get("entityName")), likePattern));
                documentPredicates.add(builder.like(builder.lower(root.get("comment")), likePattern));
                documentPredicates.add(builder.like(builder.lower(root.get("documentNumber")), likePattern));
                try {
                    UUID parsedEntityId = UUID.fromString(documentNumber.trim());
                    documentPredicates.add(builder.equal(root.get("entityId"), parsedEntityId));
                } catch (IllegalArgumentException ignored) {
                    // Not a UUID, skip entityId match.
                }
                predicates.add(builder.or(
                    documentPredicates.toArray(new Predicate[0])
                ));
            }

            // 6b. Entity ID filter
            if (StringUtils.hasText(entityId)) {
                try {
                    UUID parsedEntityId = UUID.fromString(entityId.trim());
                    predicates.add(builder.equal(root.get("entityId"), parsedEntityId));
                } catch (IllegalArgumentException ignored) {
                    // Ignore invalid UUID values to keep filtering resilient.
                }
            }

            // 7. Status filter
            if (StringUtils.hasText(status)) {
                String likePattern = "%" + status.toLowerCase(Locale.ROOT) + "%";
                predicates.add(builder.or(
                    builder.like(builder.lower(root.get("fromStatus")), likePattern),
                    builder.like(builder.lower(root.get("toStatus")), likePattern),
                    builder.like(builder.lower(root.get("comment")), likePattern)
                ));
            }

            // 8. IP Address filter
            if (StringUtils.hasText(ipAddress)) {
                String likePattern = "%" + ipAddress.toLowerCase(Locale.ROOT) + "%";
                predicates.add(builder.like(builder.lower(root.get("ipAddress")), likePattern));
            }

            // 9. E-Signature Only filter
            if (eSignatureOnly != null) {
                predicates.add(eSignatureOnly
                        ? builder.isTrue(root.get("electronicSignatureApplied"))
                        : builder.isFalse(root.get("electronicSignatureApplied")));
            }

            // 10. Date boundary filters
            if (resolvedDateRange.from() != null) {
                Instant from = resolvedDateRange.from();
                if (from != null) {
                    predicates.add(builder.greaterThanOrEqualTo(root.get("createdAt"), from));
                }
            }
            if (resolvedDateRange.to() != null) {
                Instant to = resolvedDateRange.to();
                if (to != null) {
                    predicates.add(builder.lessThanOrEqualTo(root.get("createdAt"), to));
                }
            }

            return builder.and(predicates.toArray(new Predicate[0]));
        };

        Page<AuditLog> pageResult = auditLogRepository.findAll(spec, pageable);
        List<AuditTrailRecordResponse> data = pageResult.getContent().stream()
                .map(this::toResponse)
                .toList();

        return new PageResponse<>(
                data,
                new PaginationResponse(safePage, safeLimit, pageResult.getTotalElements(), pageResult.getTotalPages())
        );
    }

    @Transactional(readOnly = true)
    public AuditTrailDetailResponse getById(UUID id) {
        requireAuditView();
        return auditLogRepository.findById(id)
                .map(this::toDetailResponse)
                .orElseThrow(() -> new IllegalArgumentException("Audit trail record not found"));
    }

    @Transactional(readOnly = true)
    public List<AuditTrailRecordResponse> getByEntity(String module, UUID entityId) {
        requireEntityAuditView(module, entityId);
        return getByEntityForAuthorizedDocument(module, entityId);
    }

    /**
     * Detail audit tabs are object-scoped. Users who can view a controlled copy
     * must not also need the global audit.view permission just to inspect that
     * copy's history.
     */
    private void requireEntityAuditView(String module, UUID entityId) {
        if (module == null || entityId == null) {
            throw new AccessDeniedException("Invalid audit entity reference");
        }
        String normalized = module.trim().toUpperCase(Locale.ROOT).replace('_', ' ');
        UserAccount actor = currentUserService.requireCurrentUser();
        if (normalized.equals("CONTROLLED COPY") || normalized.equals("CONTROLLED COPY DISTRIBUTION BATCH")) {
            if (normalized.equals("CONTROLLED COPY")) {
                ControlledCopyRecord copy = controlledCopyRepository.findById(entityId)
                        .orElseThrow(() -> new AccessDeniedException("Controlled copy audit access denied"));
                DocumentAuthorizationService authorization = documentAuthorizationServiceProvider.getObject();
                boolean canViewDocument = copy.getDocument() != null
                        && authorization.canAccessControlledCopy(actor, copy.getDocument());
                boolean canViewRevision = copy.getRevision() != null
                        && authorization.canAccessControlledCopy(actor, copy.getRevision());
                if (!canViewDocument && !canViewRevision && !matchesControlledCopyViewer(actor, copy)) {
                    throw new AccessDeniedException("Controlled copy audit access denied");
                }
            } else {
                ControlledCopyDistributionBatch batch = controlledCopyDistributionBatchRepository.findById(entityId)
                        .orElseThrow(() -> new AccessDeniedException("Controlled copy batch audit access denied"));
                DocumentAuthorizationService authorization = documentAuthorizationServiceProvider.getObject();
                boolean canViewDocument = batch.getDocument() != null
                        && authorization.canAccessControlledCopy(actor, batch.getDocument());
                boolean canViewRevision = batch.getRevision() != null
                        && authorization.canAccessControlledCopy(actor, batch.getRevision());
                if (!canViewDocument && !canViewRevision && !matchesControlledCopyBatchViewer(actor, batch)) {
                    throw new AccessDeniedException("Controlled copy batch audit access denied");
                }
            }
            return;
        }
        requireAuditView();
        requireScopedEntityView(module, entityId.toString());
    }

    /**
     * Audit access must use the same object scope as the controlled-copy detail
     * endpoint. A recipient can legitimately open their assigned copy even when
     * they are not a document workflow participant; that recipient must also be
     * able to inspect the copy's audit/signature tabs.
     */
    private boolean matchesControlledCopyViewer(UserAccount actor, ControlledCopyRecord copy) {
        if (actor == null || actor.getId() == null || copy == null) {
            return false;
        }
        return sameUser(actor, copy.getRecipientUser())
                || matchesReference(actor, copy.getRecipientName())
                || sameUser(actor, copy.getRequestedBy())
                || sameUser(actor, copy.getApprovedBy())
                || sameUser(actor, copy.getPrintedBy())
                || sameUser(actor, copy.getDistributedBy())
                || sameUser(actor, copy.getRecalledBy())
                || sameUser(actor, copy.getDestroyedBy())
                || sameUser(actor, copy.getCancelledBy())
                || sameUser(actor, copy.getObsoletedBy());
    }

    private boolean matchesControlledCopyBatchViewer(UserAccount actor, ControlledCopyDistributionBatch batch) {
        if (actor == null || actor.getId() == null || batch == null) {
            return false;
        }
        if (sameUser(actor, batch.getRequestedBy()) || sameUser(actor, batch.getDistributedBy())) {
            return true;
        }
        return matchesReference(actor, batch.getDistributionList())
                || matchesReference(actor, batch.getExternalRecipients());
    }

    private boolean sameUser(UserAccount left, UserAccount right) {
        return left != null && right != null && left.getId() != null && left.getId().equals(right.getId());
    }

    private boolean matchesReference(UserAccount actor, String reference) {
        if (actor == null || actor.getId() == null || !StringUtils.hasText(reference)) {
            return false;
        }
        String normalized = reference.trim();
        for (String value : normalized.split("[,;\\n]")) {
            String candidate = value.trim();
            if ((StringUtils.hasText(actor.getFullName()) && candidate.equalsIgnoreCase(actor.getFullName()))
                    || (StringUtils.hasText(actor.getUsername()) && candidate.equalsIgnoreCase(actor.getUsername()))
                    || (StringUtils.hasText(actor.getEmail()) && candidate.equalsIgnoreCase(actor.getEmail()))) {
                return true;
            }
        }
        return false;
    }

    /**
     * DocumentService performs object-level authorization before calling this method. Keeping this
     * separate prevents the document detail audit tab from becoming a system-wide audit permission.
     */
    List<AuditTrailRecordResponse> getByEntityForAuthorizedDocument(String module, UUID entityId) {
        return auditLogRepository.findAllByNormalizedEntityTypeAndEntityId(module, entityId)
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<AuditTrailUserOptionResponse> listUsers(String module, String documentNumber, String entityId) {
        requireAuditView();
        Sort sort = Sort.by(Sort.Direction.DESC, "createdAt");
        Specification<AuditLog> spec = (root, query, builder) -> {
            List<Predicate> predicates = new ArrayList<>();

            if (StringUtils.hasText(module) && !"All".equalsIgnoreCase(module)) {
                String normalizedModule = module.trim().toUpperCase(Locale.ROOT);
                Expression<String> entityTypeUpper = builder.upper(root.get("entityType"));
                switch (normalizedModule) {
                    case "DOCUMENT" -> predicates.add(builder.equal(entityTypeUpper, "DOCUMENT"));
                    case "REVISION" -> predicates.add(builder.equal(entityTypeUpper, "REVISION"));
                    case "USER" -> predicates.add(entityTypeUpper.in("USER", "USER_ACCOUNT"));
                    case "ROLE" -> predicates.add(builder.equal(entityTypeUpper, "ROLE"));
                    case "PROMPT" -> predicates.add(entityTypeUpper.in("PROMPT_SPECIFICATION", "PROMPT_GENERATION_RUN", "GENERATED_ARTIFACT"));
                    case "CAPA" -> predicates.add(builder.equal(entityTypeUpper, "CAPA"));
                    case "DEVIATION" -> predicates.add(builder.equal(entityTypeUpper, "DEVIATION"));
                    case "TRAINING" -> predicates.add(builder.equal(entityTypeUpper, "TRAINING"));
                    case "CONTROLLED COPY" -> predicates.add(builder.equal(entityTypeUpper, "CONTROLLED_COPY"));
                    case "SETTINGS" -> predicates.add(entityTypeUpper.in("SETTINGS", "SYSTEM_CONFIGURATION", "SYSTEM"));
                    case "SYSTEM" -> predicates.add(builder.or(
                            entityTypeUpper.in("SESSION", "AUTH", "AUTHENTICATION"),
                            builder.isNull(root.get("entityType")),
                            builder.equal(root.get("entityType"), "")
                    ));
                    default -> predicates.add(builder.equal(entityTypeUpper, normalizedModule));
                }
            }

            if (StringUtils.hasText(documentNumber)) {
                String likePattern = "%" + documentNumber.toLowerCase(Locale.ROOT) + "%";
                List<Predicate> documentPredicates = new ArrayList<>();
                documentPredicates.add(builder.like(builder.lower(root.get("entityName")), likePattern));
                documentPredicates.add(builder.like(builder.lower(root.get("comment")), likePattern));
                documentPredicates.add(builder.like(builder.lower(root.get("documentNumber")), likePattern));
                try {
                    UUID parsedEntityId = UUID.fromString(documentNumber.trim());
                    documentPredicates.add(builder.equal(root.get("entityId"), parsedEntityId));
                } catch (IllegalArgumentException ignored) {
                    // ignore invalid UUID
                }
                predicates.add(builder.or(documentPredicates.toArray(new Predicate[0])));
            }

            if (StringUtils.hasText(entityId)) {
                try {
                    UUID parsedEntityId = UUID.fromString(entityId.trim());
                    predicates.add(builder.equal(root.get("entityId"), parsedEntityId));
                } catch (IllegalArgumentException ignored) {
                    // ignore invalid UUID
                }
            }

            return builder.and(predicates.toArray(new Predicate[0]));
        };

        List<AuditLog> logs = auditLogRepository.findAll(spec, sort);
        Map<String, AuditTrailUserOptionResponse> unique = new LinkedHashMap<>();
        for (AuditLog log : logs) {
            AuditActorSnapshot snapshot = resolveActorSnapshot(log);
            String value = firstNonBlank(
                    snapshot.employeeCode(),
                    snapshot.username(),
                    snapshot.fullName(),
                    log.getEmployeeCode(),
                    log.getUsername(),
                    log.getUserFullName(),
                    log.getUserId() == null ? null : log.getUserId().toString()
            );
            if (!StringUtils.hasText(value)) {
                continue;
            }
            String label = firstNonBlank(
                    formatUserLabel(snapshot.employeeCode(), snapshot.fullName()),
                    formatUserLabel(log.getEmployeeCode(), log.getUserFullName()),
                    snapshot.fullName(),
                    log.getUserFullName(),
                    snapshot.username(),
                    log.getUsername(),
                    value
            );
            unique.putIfAbsent(value.trim().toLowerCase(Locale.ROOT), new AuditTrailUserOptionResponse(label, value));
        }
        return unique.values().stream()
                .sorted(Comparator.comparing(AuditTrailUserOptionResponse::label, String.CASE_INSENSITIVE_ORDER))
                .toList();
    }

    /**
     * Validates the export's electronic signature synchronously, before the controller commits
     * to a StreamingResponseBody -- once that body starts writing, the 200 response status is
     * already locked in, so a token failure discovered mid-stream can't be surfaced as a proper
     * HTTP error (the client would just see an incomplete "successful" download).
     */
    @Transactional(readOnly = true)
    public void requireValidExportSignature(String signatureToken) {
        UserAccount actor = requireAuditExport();
        if (!StringUtils.hasText(signatureToken)) {
            throw new IllegalArgumentException("Electronic signature is required to export the audit trail");
        }
        var parsedSignature = tokenService.parseSignatureToken(signatureToken)
                .orElseThrow(() -> new org.springframework.security.access.AccessDeniedException("Electronic signature is invalid or expired"));
        if (!parsedSignature.principal().userId().equals(actor.getId())) {
            throw new org.springframework.security.access.AccessDeniedException("Electronic signature must belong to the current user");
        }
    }

    @Transactional
    public void writeExport(
            String search,
            String module,
            String action,
            String user,
            String severity,
            String documentNumber,
            String entityId,
            String status,
            String ipAddress,
            Boolean eSignatureOnly,
            String dateFrom,
            String dateTo,
            String sortBy,
            String sortDirection,
            String reason,
            String signatureToken,
            OutputStream output
    ) throws IOException {
        UserAccount actor = requireAuditExport();
        if (!StringUtils.hasText(signatureToken)) {
            throw new IllegalArgumentException("Electronic signature is required to export the audit trail");
        }
        var parsedSignature = tokenService.parseSignatureToken(signatureToken)
                .orElseThrow(() -> new org.springframework.security.access.AccessDeniedException("Electronic signature is invalid or expired"));
        if (!parsedSignature.principal().userId().equals(actor.getId())) {
            throw new org.springframework.security.access.AccessDeniedException("Electronic signature must belong to the current user");
        }
        Writer writer = new BufferedWriter(new OutputStreamWriter(output, java.nio.charset.StandardCharsets.UTF_8));
        writer.write("id,timestamp,user,module,action,entityId,entityName,description,severity\n");

        final int exportPageSize = 500;
        int pageNumber = 1;
        long exportedCount = 0;
        PageResponse<AuditTrailRecordResponse> result;
        do {
            result = listQuery(search, module, action, user, severity, documentNumber, entityId, status, ipAddress,
                    eSignatureOnly, dateFrom, dateTo, sortBy, sortDirection, pageNumber, exportPageSize);
            for (AuditTrailRecordResponse row : result.data()) {
                writer.write(String.join(",",
                        csv(row.id()),
                        csv(row.timestamp()),
                        csv(row.user() == null ? "" : row.user().fullName()),
                        csv(row.module()),
                        csv(row.action()),
                        csv(row.entityId()),
                        csv(row.entityName()),
                        csv(row.description()),
                        csv(row.severity())
                ));
                writer.write('\n');
                exportedCount++;
            }
            writer.flush();
            pageNumber++;
        } while (result.pagination().page() < result.pagination().totalPages());

        String exportSummary = "Exported " + exportedCount + " audit trail record(s). " + summarizeExportFilters(
                module, action, user, severity, documentNumber, entityId, status, ipAddress, eSignatureOnly, dateFrom, dateTo);
        electronicSignatureService.createEntitySignature("AuditTrail", AUDIT_TRAIL_SYSTEM_ENTITY_ID, "System Audit Trail", actor, signatureToken, "AUDIT_RECORD_EXPORTED", reason, null, null, exportSummary);
        logAs(
                actor,
                "AUDIT_TRAIL",
                "System Audit Trail",
                AUDIT_TRAIL_SYSTEM_ENTITY_ID,
                "EXPORT",
                null,
                null,
                exportSummary
        );
        writer.flush();
    }

    @Transactional
    public void log(String entityType, UUID entityId, String actionType, String fromStatus, String toStatus, String comment) {
        log(entityType, null, entityId, actionType, fromStatus, toStatus, comment);
    }

    @Transactional
    public void log(String entityType, String entityName, UUID entityId, String actionType, String fromStatus, String toStatus, String comment) {
        persistAudit(currentUserService.requireCurrentUser(), entityType, entityName, entityId, actionType, fromStatus, toStatus, comment, null, null, null, null);
    }

    @Transactional
    public void log(String entityType, String entityName, UUID entityId, String actionType, String fromStatus, String toStatus, String comment, List<AuditTrailChangeResponse> changes) {
        String[] summarized = summarizeChanges(changes);
        persistAudit(currentUserService.requireCurrentUser(), entityType, entityName, entityId, actionType, fromStatus, toStatus, comment, summarized[0], summarized[1], null, changes);
    }

    @Transactional
    public void logAs(UserAccount actor, String entityType, String entityName, UUID entityId, String actionType, String fromStatus, String toStatus, String comment) {
        if (actor == null) {
            logSafely(entityType, entityName, entityId, actionType, fromStatus, toStatus, comment);
            return;
        }
        persistAudit(actor, entityType, entityName, entityId, actionType, fromStatus, toStatus, comment, null, null, null, null);
    }

    @Transactional
    public void logAs(UserAccount actor, String entityType, String entityName, UUID entityId, String actionType, String fromStatus, String toStatus, String comment, List<AuditTrailChangeResponse> changes) {
        if (actor == null) {
            logSafely(entityType, entityName, entityId, actionType, fromStatus, toStatus, comment);
            return;
        }
        String[] summarized = summarizeChanges(changes);
        persistAudit(actor, entityType, entityName, entityId, actionType, fromStatus, toStatus, comment, summarized[0], summarized[1], null, changes);
    }

    public void logAs(
            UserAccount actor,
            String entityType,
            String entityName,
            UUID entityId,
            String actionType,
            String fromStatus,
            String toStatus,
            String comment,
            List<AuditTrailChangeResponse> changes,
            UUID signatureId
    ) {
        if (actor == null) {
            logSafely(entityType, entityName, entityId, actionType, fromStatus, toStatus, comment);
            return;
        }
        String[] summarized = summarizeChanges(changes);
        persistAudit(actor, entityType, entityName, entityId, actionType, fromStatus, toStatus, comment, summarized[0], summarized[1], signatureId, changes);
    }

    /**
     * Records an action performed through a controlled external link when no
     * EQMS account is authenticated.  The recipient identifier is captured as
     * an immutable actor snapshot; it is intentionally not resolved to an
     * internal user account later, so the audit trail remains truthful even if
     * that person is subsequently invited into EQMS.
     */
    @Transactional
    public void logExternal(
            String externalIdentifier,
            String entityType,
            String entityName,
            UUID entityId,
            String actionType,
            String fromStatus,
            String toStatus,
            String comment
    ) {
        RequestSnapshot requestSnapshot = resolveRequestSnapshot();
        AuditEntitySnapshot entitySnapshot = buildEntitySnapshot(entityType, entityId, entityName);
        Instant now = Instant.now();
        String actor = StringUtils.hasText(externalIdentifier) ? externalIdentifier.trim() : "External recipient";
        AuditLog log = new AuditLog();
        log.setEventTime(now);
        log.setCreatedAt(now);
        log.setUpdatedAt(now);
        log.setEntityType(entityType);
        log.setEntityName(StringUtils.hasText(entityName) ? entityName : entitySnapshot.entityName());
        log.setEntityId(entityId);
        log.setActionType(actionType);
        log.setAction(actionType);
        log.setFromStatus(fromStatus);
        log.setToStatus(toStatus);
        log.setComment(comment);
        log.setReason(comment);
        log.setIpAddress(requestSnapshot.ipAddress());
        log.setUserAgent(requestSnapshot.userAgent());
        log.setDeviceBrowser(requestSnapshot.deviceBrowser());
        log.setDeviceModel(requestSnapshot.deviceModel());
        log.setDevicePlatform(requestSnapshot.devicePlatform());
        log.setDevicePlatformVersion(requestSnapshot.devicePlatformVersion());
        log.setDeviceName(requestSnapshot.deviceName());
        log.setProcessingDurationSeconds(resolveRequestDurationSeconds());
        log.setUsername(actor);
        log.setUserFullName(actor);
        log.setRoleName("External recipient");
        log.setEntityCode(entitySnapshot.entityCode());
        log.setDocumentNumber(entitySnapshot.documentNumber());
        log.setRevisionNumber(entitySnapshot.revisionNumber());
        log.setEntityStatus(entitySnapshot.entityStatus());
        persistChanges(log, null, fromStatus, toStatus);
        auditLogRepository.save(log);
    }

    private void persistAudit(
            UserAccount actor,
            String entityType,
            String entityName,
            UUID entityId,
            String actionType,
            String fromStatus,
            String toStatus,
            String comment,
            String oldValue,
            String newValue,
            UUID signatureId,
            List<AuditTrailChangeResponse> changes
    ) {
        RequestSnapshot requestSnapshot = resolveRequestSnapshot();
        AuditActorSnapshot actorSnapshot = buildActorSnapshot(actor);
        AuditEntitySnapshot entitySnapshot = buildEntitySnapshot(entityType, entityId, entityName);
        Instant now = Instant.now();
        AuditLog log = new AuditLog();
        log.setEventTime(now);
        log.setCreatedAt(now);
        log.setUpdatedAt(now);
        log.setEntityType(entityType);
        log.setEntityName(entityName);
        log.setEntityId(entityId);
        log.setActionType(actionType);
        log.setAction(actionType);
        log.setFromStatus(fromStatus);
        log.setToStatus(toStatus);
        log.setComment(comment);
        log.setReason(comment);
        log.setOldValue(oldValue);
        log.setNewValue(newValue);
        log.setIpAddress(requestSnapshot.ipAddress());
        log.setUserAgent(requestSnapshot.userAgent());
        log.setDeviceBrowser(requestSnapshot.deviceBrowser());
        log.setDeviceModel(requestSnapshot.deviceModel());
        log.setDevicePlatform(requestSnapshot.devicePlatform());
        log.setDevicePlatformVersion(requestSnapshot.devicePlatformVersion());
        log.setDeviceName(requestSnapshot.deviceName());
        log.setProcessingDurationSeconds(resolveRequestDurationSeconds());
        log.setActedBy(actor);
        log.setUserId(actor.getId());
        log.setUsername(actor.getUsername());
        log.setUserFullName(actorSnapshot.fullName());
        log.setEmployeeCode(actorSnapshot.employeeCode());
        log.setRoleName(actorSnapshot.roleName());
        log.setPositionName(actorSnapshot.positionName());
        log.setDepartmentName(actorSnapshot.departmentName());
        log.setSignatureId(signatureId);
        log.setElectronicSignatureApplied(signatureId != null);
        log.setEntityCode(entitySnapshot.entityCode());
        log.setDocumentNumber(entitySnapshot.documentNumber());
        log.setRevisionNumber(entitySnapshot.revisionNumber());
        log.setEntityStatus(entitySnapshot.entityStatus());
        if (!StringUtils.hasText(log.getEntityName()) && StringUtils.hasText(entitySnapshot.entityName())) {
            log.setEntityName(entitySnapshot.entityName());
        }
        persistChanges(log, changes, fromStatus, toStatus);
        auditLogRepository.save(log);
    }

    public void logSafely(String entityType, String entityName, UUID entityId, String actionType, String fromStatus, String toStatus, String comment) {
        try {
            log(entityType, entityName, entityId, actionType, fromStatus, toStatus, comment);
        } catch (RuntimeException ex) {
            // Best-effort audit logging must not block the primary business transaction.
        }
    }

    private void persistChanges(
            AuditLog log,
            List<AuditTrailChangeResponse> changes,
            String fromStatus,
            String toStatus
    ) {
        if (log == null) {
            return;
        }
        List<AuditTrailChangeResponse> normalizedChanges = changes == null ? new ArrayList<>() : new ArrayList<>(changes);
        if (normalizedChanges.isEmpty() && (StringUtils.hasText(fromStatus) || StringUtils.hasText(toStatus))) {
            normalizedChanges.add(new AuditTrailChangeResponse("Status", fromStatus, toStatus));
        }
        for (int i = 0; i < normalizedChanges.size(); i++) {
            AuditTrailChangeResponse change = normalizedChanges.get(i);
            if (change == null) {
                continue;
            }
            AuditLogChange entity = new AuditLogChange();
            entity.setAuditLog(log);
            entity.setFieldName(change.field());
            entity.setOldValue(change.oldValue());
            entity.setNewValue(change.newValue());
            entity.setChangeOrder(i);
            log.getChanges().add(entity);
        }
    }

    private void requireAuditView() {
        UserAccount actor = currentUserService.requireCurrentUser();
        if (!permissionEvaluationService.isSuperAdmin(actor)
                && !permissionEvaluationService.hasAnyPermission(
                        actor, AUDIT_VIEW_PERMISSION, "audittrail.module.view", "VIEW_AUDIT_TRAIL")) {
            throw new AccessDeniedException("Audit trail view permission required");
        }
    }

    private void requireScopedEntityView(String module, String entityId) {
        UserAccount actor = currentUserService.requireCurrentUser();
        UUID id;
        try {
            id = UUID.fromString(entityId.trim());
        } catch (IllegalArgumentException ex) {
            throw new AccessDeniedException("Invalid audit entity reference");
        }
        if ("DOCUMENT".equalsIgnoreCase(module)) {
            DocumentRecord document = documentRecordRepository.findById(id)
                    .orElseThrow(() -> new AccessDeniedException("Document audit access denied"));
            documentAuthorizationServiceProvider.getObject().requireCanViewDocument(actor, document);
            return;
        }
        DocumentRevisionRecord revision = documentRevisionRepository.findById(id)
                .orElseThrow(() -> new AccessDeniedException("Revision audit access denied"));
        documentAuthorizationServiceProvider.getObject().requireCanViewRevision(actor, revision);
    }

    private UserAccount requireAuditExport() {
        requireAuditView();
        UserAccount actor = currentUserService.requireCurrentUser();
        if (!permissionEvaluationService.isSuperAdmin(actor)
                && !permissionEvaluationService.hasAnyPermission(
                        actor, AUDIT_EXPORT_PERMISSION, "audittrail.module.export", "EXPORT_AUDIT_TRAIL")) {
            throw new AccessDeniedException("Audit trail export permission required");
        }
        return actor;
    }

    private String summarizeExportFilters(
            String module, String action, String user, String severity, String documentNumber,
            String entityId, String status, String ipAddress, Boolean eSignatureOnly,
            String dateFrom, String dateTo
    ) {
        List<String> filters = new ArrayList<>();
        addExportFilter(filters, "module", module);
        addExportFilter(filters, "action", action);
        addExportFilter(filters, "user", user);
        addExportFilter(filters, "severity", severity);
        addExportFilter(filters, "document", documentNumber);
        addExportFilter(filters, "entityId", entityId);
        addExportFilter(filters, "status", status);
        addExportFilter(filters, "ipAddress", ipAddress);
        if (eSignatureOnly != null) filters.add("eSignatureOnly=" + eSignatureOnly);
        addExportFilter(filters, "dateFrom", dateFrom);
        addExportFilter(filters, "dateTo", dateTo);
        return filters.isEmpty() ? "Filters: none." : "Filters: " + String.join(", ", filters) + ".";
    }

    private void addExportFilter(List<String> filters, String name, String value) {
        if (StringUtils.hasText(value) && !"All".equalsIgnoreCase(value.trim())) {
            filters.add(name + "=" + value.trim());
        }
    }

    private String[] summarizeChanges(List<AuditTrailChangeResponse> changes) {
        if (changes == null || changes.isEmpty()) {
            return new String[] { null, null };
        }
        String oldValue = changes.stream()
                .filter(change -> change != null && StringUtils.hasText(change.field()))
                .map(change -> humanizeField(change.field()) + ": " + defaultValue(change.oldValue()))
                .collect(Collectors.joining(" | "));
        String newValue = changes.stream()
                .filter(change -> change != null && StringUtils.hasText(change.field()))
                .map(change -> humanizeField(change.field()) + ": " + defaultValue(change.newValue()))
                .collect(Collectors.joining(" | "));
        return new String[] {
                StringUtils.hasText(oldValue) ? oldValue : null,
                StringUtils.hasText(newValue) ? newValue : null
        };
    }

    private String resolveReason(AuditLog log, String normalizedDescription) {
        if (log == null) {
            return normalizedDescription;
        }
        if (StringUtils.hasText(log.getReason())) {
            return log.getReason();
        }
        if (StringUtils.hasText(log.getComment())) {
            return log.getComment();
        }
        return normalizedDescription;
    }

    private AuditTrailRecordResponse toResponse(AuditLog log) {
        AuditActorSnapshot actorSnapshot = resolveActorSnapshot(log);
        String module = mapModule(log.getEntityType());
        String action = mapAction(log.getActionType());
        List<AuditTrailChangeResponse> changes = loadChanges(log);
        AuditEntitySnapshot entitySnapshot = resolveEntitySnapshot(log, module);
        String entityLabel = entitySnapshot.entityLabel();
        String objectCode = entitySnapshot.entityCode();
        String changeSummary = buildChangeSummary(log, changes);
        String normalizedDescription = buildDescription(log, action, entityLabel, changeSummary);
        String resolvedReason = resolveReason(log, normalizedDescription);

        Map<String, Object> metadata = new LinkedHashMap<>();
        metadata.put("entityType", log.getEntityType());
        metadata.put("entityName", log.getEntityName());
        metadata.put("entityLabel", entityLabel);
        metadata.put("objectCode", objectCode);
        metadata.put("documentNumber", entitySnapshot.documentNumber());
        metadata.put("revisionNumber", entitySnapshot.revisionNumber());
        metadata.put("entityStatus", entitySnapshot.entityStatus());
        metadata.put("actionType", log.getActionType());
        metadata.put("fromStatus", log.getFromStatus());
        metadata.put("toStatus", log.getToStatus());
        metadata.put("reason", resolvedReason);
        metadata.put("comment", log.getComment());
        metadata.put("oldValue", log.getOldValue());
        metadata.put("newValue", log.getNewValue());
        metadata.put("changeSummary", changeSummary);
        metadata.put("userId", log.getUserId() == null ? null : log.getUserId().toString());
        metadata.put("username", log.getUsername());
        metadata.put("signatureId", log.getSignatureId() == null ? null : log.getSignatureId().toString());
        metadata.put("electronicSignatureApplied", log.isElectronicSignatureApplied());
        metadata.put("eventTime", formatInstant(log.getEventTime()));
        metadata.put("progressDurationSeconds", log.getProcessingDurationSeconds());

        return new AuditTrailRecordResponse(
                log.getId() == null ? null : log.getId().toString(),
                formatInstant(log.getEventTime() == null ? log.getCreatedAt() : log.getEventTime()),
                toAuditTrailUserResponse(actorSnapshot),
                module,
                action,
                log.getEntityId() == null ? null : log.getEntityId().toString(),
                entitySnapshot.entityName(),
                entityLabel,
                objectCode,
                normalizedDescription,
                changeSummary,
                changes,
                resolvedReason,
                log.getIpAddress(),
                formatDevice(log),
                log.getUserAgent(),
                log.getSignatureId() == null ? null : log.getSignatureId().toString(),
                log.isElectronicSignatureApplied(),
                severityFor(action),
                log.getProcessingDurationSeconds(),
                metadata
        );
    }

    private AuditTrailDetailResponse toDetailResponse(AuditLog log) {
        AuditActorSnapshot actorSnapshot = resolveActorSnapshot(log);
        String module = mapModule(log.getEntityType());
        String action = mapAction(log.getActionType());
        List<AuditTrailChangeResponse> changes = loadChanges(log);
        AuditEntitySnapshot entitySnapshot = resolveEntitySnapshot(log, module);
        String entityLabel = entitySnapshot.entityLabel();
        String objectCode = entitySnapshot.entityCode();
        String changeSummary = buildChangeSummary(log, changes);
        String normalizedDescription = buildDescription(log, action, entityLabel, changeSummary);
        String resolvedReason = resolveReason(log, normalizedDescription);
        Map<String, Object> metadata = buildDetailMetadata(log, entitySnapshot, changeSummary, resolvedReason, module, action);

        return new AuditTrailDetailResponse(
                log.getId() == null ? null : log.getId().toString(),
                formatInstant(log.getEventTime() == null ? log.getCreatedAt() : log.getEventTime()),
                formatInstant(log.getCreatedAt()),
                formatInstant(log.getUpdatedAt()),
                toAuditTrailUserResponse(actorSnapshot),
                log.getUsername(),
                module,
                action,
                log.getActionType(),
                log.getEntityId() == null ? null : log.getEntityId().toString(),
                log.getEntityType(),
                entitySnapshot.entityName(),
                entityLabel,
                objectCode,
                entitySnapshot.documentNumber(),
                entitySnapshot.revisionNumber(),
                entitySnapshot.entityStatus(),
                normalizedDescription,
                changeSummary,
                changes,
                resolvedReason,
                StringUtils.hasText(log.getFromStatus()) ? log.getFromStatus() : entitySnapshot.entityStatus(),
                StringUtils.hasText(log.getToStatus()) ? log.getToStatus() : entitySnapshot.entityStatus(),
                log.getOldValue(),
                log.getNewValue(),
                log.getIpAddress(),
                formatDevice(log),
                log.getUserAgent(),
                log.getSignatureId() == null ? null : log.getSignatureId().toString(),
                log.isElectronicSignatureApplied(),
                severityFor(action),
                log.getProcessingDurationSeconds(),
                metadata
        );
    }

    private Map<String, Object> buildDetailMetadata(
            AuditLog log,
            AuditEntitySnapshot entitySnapshot,
            String changeSummary,
            String resolvedReason,
            String module,
            String action
    ) {
        Map<String, Object> metadata = new LinkedHashMap<>();
        metadata.put("entityType", log.getEntityType());
        metadata.put("entityName", log.getEntityName());
        metadata.put("entityLabel", entitySnapshot.entityLabel());
        metadata.put("objectCode", entitySnapshot.entityCode());
        metadata.put("documentNumber", entitySnapshot.documentNumber());
        metadata.put("revisionNumber", entitySnapshot.revisionNumber());
        metadata.put("entityStatus", entitySnapshot.entityStatus());
        metadata.put("actionType", log.getActionType());
        metadata.put("fromStatus", log.getFromStatus());
        metadata.put("toStatus", log.getToStatus());
        metadata.put("reason", resolvedReason);
        metadata.put("comment", log.getComment());
        metadata.put("changeSummary", changeSummary);
        metadata.put("userId", log.getUserId() == null ? null : log.getUserId().toString());
        metadata.put("username", log.getUsername());
        metadata.put("signatureId", log.getSignatureId() == null ? null : log.getSignatureId().toString());
        metadata.put("electronicSignatureApplied", log.isElectronicSignatureApplied());
        metadata.put("timestamp", formatInstant(log.getEventTime() == null ? log.getCreatedAt() : log.getEventTime()));
        metadata.put("module", module);
        metadata.put("action", action);
        return metadata;
    }

    private String buildDescription(AuditLog log, String action, String entityLabel, String changeSummary) {
        StringBuilder builder = new StringBuilder();
        builder.append(action);
        if (StringUtils.hasText(entityLabel)) {
            builder.append(" ").append(entityLabel);
        }
        if (StringUtils.hasText(changeSummary) && !"-".equals(changeSummary)) {
            builder.append(". ").append(changeSummary);
        } else if (StringUtils.hasText(log.getComment())) {
            builder.append(". ").append(abbreviate(log.getComment(), 180));
        }
        return builder.toString();
    }

    private AuditTrailUserResponse toAuditTrailUserResponse(AuditActorSnapshot snapshot) {
        if (snapshot == null) {
            return null;
        }
        if (!StringUtils.hasText(snapshot.id())
                && !StringUtils.hasText(snapshot.fullName())
                && !StringUtils.hasText(snapshot.employeeCode())
                && !StringUtils.hasText(snapshot.roleName())
                && !StringUtils.hasText(snapshot.positionName())
                && !StringUtils.hasText(snapshot.departmentName())) {
            return null;
        }
        return new AuditTrailUserResponse(
                snapshot.id(),
                snapshot.fullName(),
                snapshot.employeeCode(),
                snapshot.roleName(),
                snapshot.positionName(),
                snapshot.departmentName(),
                snapshot.avatar()
        );
    }

    private AuditActorSnapshot buildActorSnapshot(UserAccount actor) {
        if (actor == null) {
            return new AuditActorSnapshot(null, null, null, null, null, null, null, null);
        }
        return new AuditActorSnapshot(
                actor.getId() == null ? null : actor.getId().toString(),
                actor.getUsername(),
                actor.getFullName(),
                actor.getEmployeeCode(),
                actor.getRoleName(),
                actor.getPosition(),
                actor.getDepartment(),
                actor.getAvatar()
        );
    }

    private AuditActorSnapshot resolveActorSnapshot(AuditLog log) {
        if (log == null) {
            return new AuditActorSnapshot(null, null, null, null, null, null, null, null);
        }
        AuditActorSnapshot storedSnapshot = new AuditActorSnapshot(
                log.getUserId() == null ? null : log.getUserId().toString(),
                log.getUsername(),
                log.getUserFullName(),
                log.getEmployeeCode(),
                log.getRoleName(),
                log.getPositionName(),
                log.getDepartmentName(),
                null
        );
        UserAccount currentUser = log.getActedBy();
        if (currentUser == null && log.getUserId() != null) {
            currentUser = userAccountRepository.findById(log.getUserId()).orElse(null);
        }
        if (currentUser == null && StringUtils.hasText(log.getUsername())) {
            currentUser = userAccountRepository.findByUsername(log.getUsername()).orElse(null);
        }
        if (currentUser == null) {
            return storedSnapshot;
        }
        AuditActorSnapshot currentSnapshot = buildActorSnapshot(currentUser);
        return new AuditActorSnapshot(
                firstNonBlank(storedSnapshot.id(), currentSnapshot.id()),
                firstNonBlank(storedSnapshot.username(), currentSnapshot.username()),
                firstNonBlank(storedSnapshot.fullName(), currentSnapshot.fullName()),
                firstNonBlank(storedSnapshot.employeeCode(), currentSnapshot.employeeCode()),
                firstNonBlank(storedSnapshot.roleName(), currentSnapshot.roleName()),
                firstNonBlank(storedSnapshot.positionName(), currentSnapshot.positionName()),
                firstNonBlank(storedSnapshot.departmentName(), currentSnapshot.departmentName()),
                currentSnapshot.avatar()
        );
    }

    private AuditEntitySnapshot buildEntitySnapshot(String entityType, UUID entityId, String fallbackEntityName) {
        if (!StringUtils.hasText(entityType) || entityId == null) {
            String fallbackLabel = StringUtils.hasText(fallbackEntityName) ? fallbackEntityName : humanizeField(entityType);
            return new AuditEntitySnapshot(
                    StringUtils.hasText(fallbackEntityName) ? fallbackEntityName : null,
                    fallbackLabel,
                    null,
                    null,
                    null
            );
        }
        String normalizedType = entityType.trim().toUpperCase(Locale.ROOT);
        if ("DOCUMENT".equals(normalizedType)) {
            return documentRecordRepository.findById(entityId)
                    .map(document -> new AuditEntitySnapshot(
                            document.getDocumentName(),
                            document.getDocumentName(),
                            document.getDocumentNumber(),
                            document.getDocumentNumber(),
                            document.getStatus() == null ? null : document.getStatus().getCode()
                    ))
                    .orElseGet(() -> fallbackEntitySnapshot(entityType, entityId, fallbackEntityName));
        }
        if ("REVISION".equals(normalizedType)) {
            return documentRevisionRepository.findById(entityId)
                    .map(revision -> new AuditEntitySnapshot(
                            revision.getRevisionName(),
                            revision.getRevisionName(),
                            buildRevisionObjectCode(revision),
                            revision.getDocumentNumber(),
                            revision.getStatus() == null ? null : revision.getStatus().getCode(),
                            revision.getRevisionNumber()
                    ))
                    .orElseGet(() -> fallbackEntitySnapshot(entityType, entityId, fallbackEntityName));
        }
        if ("USER".equals(normalizedType) || "USER_ACCOUNT".equals(normalizedType)) {
            return userAccountRepository.findById(entityId)
                    .map(user -> new AuditEntitySnapshot(
                            user.getFullName(),
                            user.getFullName(),
                            StringUtils.hasText(user.getEmployeeCode()) ? user.getEmployeeCode() : user.getUsername(),
                            null,
                            user.getStatus() == null ? null : user.getStatus().name()
                    ))
                    .orElseGet(() -> fallbackEntitySnapshot(entityType, entityId, fallbackEntityName));
        }
        return fallbackEntitySnapshot(entityType, entityId, fallbackEntityName);
    }

    private AuditEntitySnapshot resolveEntitySnapshot(AuditLog log, String module) {
        AuditEntitySnapshot resolved = buildEntitySnapshot(log.getEntityType(), log.getEntityId(), log.getEntityName());
        String entityName = StringUtils.hasText(log.getEntityName()) ? log.getEntityName() : resolved.entityName();
        String entityLabel = StringUtils.hasText(entityName)
                ? entityName
                : (StringUtils.hasText(log.getEntityName()) ? log.getEntityName() : module);
        String entityCode = firstNonBlank(log.getEntityCode(), resolved.entityCode(), log.getDocumentNumber(), log.getRevisionNumber(), log.getEntityId() == null ? null : log.getEntityId().toString());
        String documentNumber = firstNonBlank(log.getDocumentNumber(), resolved.documentNumber());
        String revisionNumber = firstNonBlank(log.getRevisionNumber(), resolved.revisionNumber());
        String entityStatus = firstNonBlank(log.getEntityStatus(), resolved.entityStatus());
        return new AuditEntitySnapshot(entityName, entityLabel, entityCode, documentNumber, entityStatus, revisionNumber);
    }

    private AuditEntitySnapshot fallbackEntitySnapshot(String entityType, UUID entityId, String fallbackEntityName) {
        String entityName = StringUtils.hasText(fallbackEntityName) ? fallbackEntityName : null;
        String entityLabel = entityName != null ? entityName : humanizeField(entityType);
        return new AuditEntitySnapshot(
                entityName,
                entityLabel,
                entityId == null ? null : entityId.toString(),
                null,
                null
        );
    }

    private String buildRevisionObjectCode(DocumentRevisionRecord revision) {
        if (revision == null) {
            return null;
        }
        if (StringUtils.hasText(revision.getDocumentNumber()) && StringUtils.hasText(revision.getRevisionNumber())) {
            return revision.getDocumentNumber() + " Rev." + revision.getRevisionNumber();
        }
        if (StringUtils.hasText(revision.getDocumentNumber())) {
            return revision.getDocumentNumber();
        }
        return revision.getId() == null ? null : revision.getId().toString();
    }

    private String buildChangeSummary(AuditLog log, List<AuditTrailChangeResponse> changes) {
        if (changes != null && !changes.isEmpty()) {
            return changes.stream()
                    .filter(change -> change != null)
                    .map(change -> humanizeField(change.field()) + ": " + defaultValue(change.oldValue()) + " -> " + defaultValue(change.newValue()))
                    .collect(Collectors.joining("; "));
        }
        if (StringUtils.hasText(log.getFromStatus()) || StringUtils.hasText(log.getToStatus())) {
            return "Status: " + defaultValue(log.getFromStatus()) + " -> " + defaultValue(log.getToStatus());
        }
        if (StringUtils.hasText(log.getComment())) {
            return abbreviate(log.getComment(), 180);
        }
        return "-";
    }

    private List<AuditTrailChangeResponse> loadChanges(AuditLog log) {
        if (log == null || log.getId() == null) {
            return buildLegacyStatusChanges(log);
        }
        List<AuditLogChange> changeEntities = auditLogChangeRepository.findAllByAuditLogIdOrderByChangeOrderAscCreatedAtAsc(log.getId());
        if (changeEntities == null || changeEntities.isEmpty()) {
            return buildLegacyStatusChanges(log);
        }
        return changeEntities.stream()
                .map(this::toDisplayChange)
                .toList();
    }

    /**
     * Audit storage remains immutable and preserves the original submitted values. The API
     * returns a presentation-safe representation so clients never need to infer that 0/1,
     * null, or a camel-case field name has business meaning.
     */
    private AuditTrailChangeResponse toDisplayChange(AuditLogChange change) {
        String field = change == null ? null : change.getFieldName();
        return new AuditTrailChangeResponse(
                humanizeField(field),
                displayAuditValue(field, change == null ? null : change.getOldValue()),
                displayAuditValue(field, change == null ? null : change.getNewValue())
        );
    }

    private String displayAuditValue(String field, String value) {
        if (!StringUtils.hasText(value) || "-".equals(value.trim()) || "null".equalsIgnoreCase(value.trim())
                || "undefined".equalsIgnoreCase(value.trim())) {
            return "Not specified";
        }
        String normalized = value.trim();
        if ("true".equalsIgnoreCase(normalized)) return "Yes";
        if ("false".equalsIgnoreCase(normalized)) return "No";
        if (isBooleanAuditField(field) && "1".equals(normalized)) return "Yes";
        if (isBooleanAuditField(field) && "0".equals(normalized)) return "No";
        if (field != null && field.toLowerCase(Locale.ROOT).matches(".*(status|state).*")) {
            return humanizeField(normalized);
        }
        return normalized;
    }

    private boolean isBooleanAuditField(String field) {
        String normalized = field == null ? "" : field.replaceAll("[^A-Za-z0-9]", "").toLowerCase(Locale.ROOT);
        return normalized.matches(".*(active|enabled|disabled|mandatory|required|locked|visible|archived|deleted|read)$")
                || normalized.matches("^(is|has|can|allow|enable|disable|require|show|hide).*");
    }

    private List<AuditTrailChangeResponse> buildLegacyStatusChanges(AuditLog log) {
        List<AuditTrailChangeResponse> changes = new ArrayList<>();
        if (log != null && (StringUtils.hasText(log.getFromStatus()) || StringUtils.hasText(log.getToStatus()))) {
            changes.add(new AuditTrailChangeResponse(
                    "status",
                    log.getFromStatus() == null ? "" : log.getFromStatus(),
                    log.getToStatus() == null ? "" : log.getToStatus()
            ));
        }
        return changes;
    }

    private String abbreviate(String text, int maxLength) {
        if (!StringUtils.hasText(text) || text.length() <= maxLength) {
            return text;
        }
        return text.substring(0, Math.max(0, maxLength - 1)) + "...";
    }

    private String defaultValue(String value) {
        return StringUtils.hasText(value) ? value : "-";
    }

    private String humanizeField(String value) {
        if (!StringUtils.hasText(value)) {
            return "Field";
        }
        String normalized = value
                .replace('_', ' ')
                .replaceAll("([a-z])([A-Z])", "$1 $2")
                .replaceAll("\\s+", " ")
                .trim();
        if (normalized.isEmpty()) {
            return "Field";
        }
        return Stream.of(normalized.split(" "))
                .filter(StringUtils::hasText)
                .map(part -> part.substring(0, 1).toUpperCase(Locale.ROOT) + part.substring(1).toLowerCase(Locale.ROOT))
                .collect(Collectors.joining(" "));
    }

    private String firstNonBlank(String... values) {
        if (values == null) {
            return null;
        }
        for (String value : values) {
            if (StringUtils.hasText(value)) {
                return value;
            }
        }
        return null;
    }

    private String formatUserLabel(String employeeCode, String fullName) {
        if (StringUtils.hasText(employeeCode) && StringUtils.hasText(fullName)) {
            return employeeCode + " - " + fullName;
        }
        return firstNonBlank(fullName, employeeCode);
    }

    private Double resolveRequestDurationSeconds() {
        RequestAttributes attributes = RequestContextHolder.getRequestAttributes();
        if (!(attributes instanceof ServletRequestAttributes servletAttributes)) return null;
        Object startNanos = servletAttributes.getRequest().getAttribute(AuditRequestTimingFilter.REQUEST_START_NANOS_ATTRIBUTE);
        if (!(startNanos instanceof Long start) || start <= 0L) return null;
        double seconds = (System.nanoTime() - start) / 1_000_000_000d;
        return Math.round(Math.max(0d, seconds) * 1_000d) / 1_000d;
    }

    private RequestSnapshot resolveRequestSnapshot() {
        RequestAttributes attributes = RequestContextHolder.getRequestAttributes();
        if (!(attributes instanceof ServletRequestAttributes servletRequestAttributes)) {
            return new RequestSnapshot(null, null, null);
        }
        HttpServletRequest request = servletRequestAttributes.getRequest();
        if (request == null) {
            return new RequestSnapshot(null, null, null);
        }
        return new RequestSnapshot(extractIpAddress(request), extractDeviceSnapshot(request), request.getHeader("User-Agent"));
    }

    private String extractIpAddress(HttpServletRequest request) {
        String forwardedFor = request.getHeader("X-Forwarded-For");
        if (StringUtils.hasText(forwardedFor)) {
            return forwardedFor.split(",")[0].trim();
        }
        String realIp = request.getHeader("X-Real-IP");
        if (StringUtils.hasText(realIp)) {
            return realIp.trim();
        }
        String remoteAddr = request.getRemoteAddr();
        return StringUtils.hasText(remoteAddr) ? remoteAddr : null;
    }

    private DeviceSnapshot extractDeviceSnapshot(HttpServletRequest request) {
        String userAgent = request.getHeader("User-Agent");
        if (!StringUtils.hasText(userAgent)) {
            return new DeviceSnapshot(null, null, null, null, null);
        }
        String browser = detectBrowser(userAgent);
        String model = cleanHeader(request.getHeader("Sec-CH-UA-Model"));
        String platform = detectPlatform(request, userAgent);
        String platformVersion = cleanHeader(request.getHeader("Sec-CH-UA-Platform-Version"));
        String deviceName = formatDevice(browser, model, platform, platformVersion);
        return new DeviceSnapshot(browser, model, platform, platformVersion, deviceName);
    }

    private String detectBrowser(String userAgent) {
        String lower = userAgent.toLowerCase(Locale.ROOT);
        if (lower.contains("edg/") || lower.contains("edge/")) {
            return "Microsoft Edge";
        }
        if (lower.contains("opr/") || lower.contains("opera")) {
            return "Opera";
        }
        if (lower.contains("chrome/") && !lower.contains("edg/") && !lower.contains("edge/") && !lower.contains("opr/")) {
            return "Google Chrome";
        }
        if (lower.contains("firefox/")) {
            return "Mozilla Firefox";
        }
        if (lower.contains("safari/") && lower.contains("version/") && !lower.contains("chrome/")) {
            return "Safari";
        }
        return null;
    }

    private String detectPlatform(HttpServletRequest request, String userAgent) {
        String platformHeader = request.getHeader("Sec-CH-UA-Platform");
        if (StringUtils.hasText(platformHeader)) {
            return stripQuotes(platformHeader.trim());
        }
        return detectPlatform(userAgent);
    }

    private String detectPlatform(String userAgent) {
        if (!StringUtils.hasText(userAgent)) {
            return null;
        }
        String lower = userAgent.toLowerCase(Locale.ROOT);
        if (lower.contains("iphone")) {
            return "iPhone";
        }
        if (lower.contains("ipad")) {
            return "iPad";
        }
        if (lower.contains("android")) {
            return "Android";
        }
        if (lower.contains("windows")) {
            return "Windows";
        }
        if (lower.contains("mac os x") || lower.contains("macintosh")) {
            return "macOS";
        }
        if (lower.contains("linux")) {
            return "Linux";
        }
        return null;
    }

    private String cleanHeader(String value) {
        if (!StringUtils.hasText(value)) {
            return null;
        }
        String trimmed = value.trim();
        if (trimmed.length() >= 2 && trimmed.startsWith("\"") && trimmed.endsWith("\"")) {
            return trimmed.substring(1, trimmed.length() - 1);
        }
        return trimmed;
    }

    private String stripQuotes(String value) {
        if (!StringUtils.hasText(value)) {
            return value;
        }
        String trimmed = value.trim();
        if (trimmed.length() >= 2 && trimmed.startsWith("\"") && trimmed.endsWith("\"")) {
            return trimmed.substring(1, trimmed.length() - 1);
        }
        return trimmed;
    }

    private String formatDevice(AuditLog log) {
        if (log == null) {
            return null;
        }
        if (StringUtils.hasText(log.getDeviceName())) {
            return log.getDeviceName();
        }
        String formatted = formatDevice(
                log.getDeviceBrowser(),
                log.getDeviceModel(),
                log.getDevicePlatform(),
                log.getDevicePlatformVersion()
        );
        if (StringUtils.hasText(formatted)) {
            return formatted;
        }
        if (StringUtils.hasText(log.getUserAgent())) {
            formatted = formatDevice(
                    detectBrowser(log.getUserAgent()),
                    null,
                    detectPlatform(log.getUserAgent()),
                    null
            );
            return StringUtils.hasText(formatted) ? formatted : abbreviate(log.getUserAgent(), 255);
        }
        return null;
    }

    private String formatDevice(String browser, String model, String platform, String platformVersion) {
        if (StringUtils.hasText(browser)) {
            StringBuilder builder = new StringBuilder(browser);
            if (StringUtils.hasText(model)) {
                builder.append(" - ").append(model);
            }
            if (StringUtils.hasText(platform) && StringUtils.hasText(platformVersion)) {
                builder.append(" (").append(platform).append(' ').append(platformVersion).append(")");
            } else if (StringUtils.hasText(platform)) {
                builder.append(" (").append(platform).append(")");
            }
            return builder.toString();
        }
        if (StringUtils.hasText(platform) && StringUtils.hasText(platformVersion)) {
            return platform + " (" + platformVersion + ")";
        }
        if (StringUtils.hasText(platform)) {
            return platform;
        }
        return null;
    }

    private record RequestSnapshot(String ipAddress, DeviceSnapshot deviceSnapshot, String userAgent) {
        String deviceName() {
            return deviceSnapshot == null ? null : deviceSnapshot.deviceName();
        }

        String deviceBrowser() {
            return deviceSnapshot == null ? null : deviceSnapshot.browser();
        }

        String deviceModel() {
            return deviceSnapshot == null ? null : deviceSnapshot.model();
        }

        String devicePlatform() {
            return deviceSnapshot == null ? null : deviceSnapshot.platform();
        }

        String devicePlatformVersion() {
            return deviceSnapshot == null ? null : deviceSnapshot.platformVersion();
        }

        public String userAgent() {
            return userAgent;
        }
    }

    private record DeviceSnapshot(String browser, String model, String platform, String platformVersion, String deviceName) {
    }

    private String mapModule(String entityType) {
        if (!StringUtils.hasText(entityType)) {
            return "System";
        }
        return switch (entityType.trim().toUpperCase(Locale.ROOT)) {
            case "DOCUMENT" -> "Document";
            case "REVISION" -> "Revision";
            case "USER", "USER_ACCOUNT" -> "User";
            case "ROLE" -> "Role";
            case "PROMPT_SPECIFICATION", "PROMPT_GENERATION_RUN", "GENERATED_ARTIFACT" -> "Prompt";
            case "CAPA" -> "CAPA";
            case "DEVIATION" -> "Deviation";
            case "TRAINING" -> "Training";
            case "CONTROLLED_COPY" -> "Controlled Copy";
            case "SETTINGS", "SYSTEM_CONFIGURATION", "SYSTEM" -> "Settings";
            case "SESSION", "AUTH", "AUTHENTICATION" -> "System";
            default -> entityType;
        };
    }

    private String mapAction(String actionType) {
        if (!StringUtils.hasText(actionType)) {
            return "Update";
        }
        String normalized = actionType.trim().toUpperCase(Locale.ROOT);
        return switch (normalized) {
            case "CREATE" -> "Create";
            case "UPDATE" -> "Update";
            case "DELETE" -> "Delete";
            case "REPLACE" -> "Replace";
            case "BUSINESS_UNIT_CREATED" -> "Create Business Unit";
            case "BUSINESS_UNIT_UPDATED" -> "Update Business Unit";
            case "BUSINESS_UNIT_DELETED" -> "Delete Business Unit";
            case "DEPARTMENT_CREATED" -> "Create Department";
            case "DEPARTMENT_UPDATED" -> "Update Department";
            case "DEPARTMENT_DELETED" -> "Delete Department";
            case "POSITION_CREATED" -> "Create Position";
            case "POSITION_UPDATED" -> "Update Position";
            case "POSITION_DELETED" -> "Delete Position";
            case "DOCUMENT_TYPE_CREATED" -> "Create Document Type";
            case "DOCUMENT_TYPE_UPDATED" -> "Update Document Type";
            case "DOCUMENT_TYPE_DELETED" -> "Delete Document Type";
            case "DOCUMENT_SUB_TYPE_CREATED" -> "Create Document Sub-Type";
            case "DOCUMENT_SUB_TYPE_UPDATED" -> "Update Document Sub-Type";
            case "DOCUMENT_SUB_TYPE_DELETED" -> "Delete Document Sub-Type";
            case "STORAGE_LOCATION_CREATED" -> "Create Storage Location";
            case "STORAGE_LOCATION_UPDATED" -> "Update Storage Location";
            case "STORAGE_LOCATION_DELETED" -> "Delete Storage Location";
            case "RETENTION_POLICY_CREATED" -> "Create Retention Policy";
            case "RETENTION_POLICY_UPDATED" -> "Update Retention Policy";
            case "RETENTION_POLICY_DELETED" -> "Delete Retention Policy";
            case "EMAIL_TEMPLATE_CREATED" -> "Create Email Template";
            case "EMAIL_TEMPLATE_UPDATED" -> "Update Email Template";
            case "EMAIL_TEMPLATE_DELETED" -> "Delete Email Template";
            case "EMAIL_TEMPLATE_DUPLICATED" -> "Duplicate Email Template";
            case "EMAIL_TEMPLATE_STATUS_TOGGLED" -> "Toggle Email Template Status";
            case "EMAIL_TEMPLATE_TEST_SENT" -> "Test Send Email Template";
            case "EMAIL_TEMPLATE_PUBLISHED" -> "Publish Email Template";
            case "EMAIL_TEMPLATE_VERSION_RESTORED" -> "Restore Email Template Version";
            case "SYSTEM_CONFIGURATION_UPDATED" -> "Update System Configuration";
            case "SYSTEM_SECURITY_CONFIGURATION_UPDATED" -> "Update Security Configuration";
            case "USER_CREATED" -> "Create User";
            case "USER_UPDATED" -> "Update User";
            case "USER_DELETED" -> "Delete User";
            case "USER_SUSPENDED" -> "Suspend User";
            case "USER_TERMINATED" -> "Terminate User";
            case "USER_REINSTATED" -> "Reinstate User";
            case "USER_PASSWORD_RESET" -> "Reset Password";
            case "USER_UNLOCKED" -> "Unlock User";
            case "USER_FORCE_LOGOUT" -> "Force Logout";
            case "USER_ROLE_UPDATED" -> "Update User Role";
            case "USER_EDUCATION_ADDED" -> "Add Education";
            case "USER_EDUCATION_UPDATED" -> "Update Education";
            case "USER_EDUCATION_DELETED" -> "Delete Education";
            case "USER_CERTIFICATION_ADDED" -> "Add Certification";
            case "USER_CERTIFICATION_UPDATED" -> "Update Certification";
            case "USER_CERTIFICATION_DELETED" -> "Delete Certification";
            case "ROLE_CREATED" -> "Create Role";
            case "ROLE_UPDATED" -> "Update Role";
            case "ROLE_DELETED" -> "Delete Role";
            case "ROLE_PERMISSIONS_UPDATED" -> "Update Role Permissions";
            case "DOCUMENT_ADMINISTRATION_UPDATED" -> "Update Document Administration";
            case "PROMPT_SPECIFICATION_CREATED" -> "Create Prompt Specification";
            case "PROMPT_GENERATION_QUEUED" -> "Queue Prompt Generation";
            case "APPROVE_COMPLETE", "APPROVE" -> "Approve";
            case "APPROVE_REJECT", "REJECT" -> "Reject";
            case "REVIEW_COMPLETE", "REVIEW" -> "Review";
            case "PUBLISH" -> "Publish";
            case "ARCHIVE" -> "Archive";
            case "RESTORE" -> "Restore";
            case "LOGIN" -> "Login";
            case "LOGOUT" -> "Logout";
            case "EXPORT" -> "Export";
            case "DOWNLOAD" -> "Download";
            case "VIEW", "OPEN" -> "View";
            case "PREVIEW" -> "Preview";
            case "OPEN_PREVIEW" -> "Open Preview";
            case "OPEN_EDIT_ONLINE" -> "Open Edit Online";
            case "VIEW_PAGE" -> "View Page";
            case "CLOSE_PREVIEW" -> "Close Preview";
            case "UPLOAD", "UPLOAD_FILE", "REVISION_SOURCE_FILE_UPLOADED" -> "Upload";
            case "UPLOAD_TO_OFFICE_ONLINE" -> "Upload to Office Online";
            case "EDIT_ONLINE_SYNCED_BACK_TO_MINIO" -> "Edit Online Synced Back to MinIO";
            case "REVIEW_PDF_GENERATED" -> "Generate";
            case "OPEN_PUBLISHING_WORKSPACE" -> "Open Publishing Workspace";
            case "GENERATE_PUBLISHING_PREVIEW" -> "Generate Publishing Preview";
            case "GENERATE" -> "Generate";
            case "ASSIGN" -> "Assign";
            case "UNASSIGN" -> "Unassign";
            case "ENABLE" -> "Enable";
            case "DISABLE" -> "Disable";
            case "CANCEL" -> "Cancel";
            case "OBSOLETE" -> "Obsoleted";
            case "SIGNATURE_SUCCESS" -> "E-Signature Success";
            case "SIGNATURE_FAILED" -> "E-Signature Failed";
            case "CHANGE_PERMISSION" -> "Change Permission";
            case "CHANGE_CONFIGURATION" -> "Change System Configuration";
            case "SUBMIT", "SUBMIT_FOR_REVIEW", "SUBMIT_REVIEW" -> "Submit";
            case "FAILED_LOGIN" -> "Failed Login";
            case "REPLACE_FILE" -> "Replace File";
            case "UPDATE_METADATA" -> "Update Metadata";
            case "ADD_WORKING_NOTE" -> "Add Working Note";
            case "DELETE_WORKING_NOTE" -> "Delete Working Note";
            case "DOWNLOAD_EVIDENCE" -> "Download Evidence";
            case "PUBLISH_TO_EFFECTIVE" -> "Publish to Effective";
            default -> normalized.charAt(0) + normalized.substring(1).toLowerCase(Locale.ROOT);
        };
    }

    private String severityFor(String action) {
        if (!StringUtils.hasText(action)) {
            return "Low";
        }
        return switch (action) {
            case "Delete", "Reject", "Disable", "Cancel", "Delete Business Unit", "Delete Department", "Delete Position",
                 "Delete Document Type", "Delete Document Sub-Type", "Delete Storage Location", "Delete Retention Policy",
                 "Delete Email Template", "Delete User", "Delete Role", "Delete Education", "Delete Certification" -> "High";
            case "Approve", "Publish", "Enable", "Create", "Update", "Upload", "Assign", "Review", "Generate",
                 "Open Edit Online", "Upload to Office Online", "Edit Online Synced Back to MinIO", "Edit Online Session Closed",
                 "Open Publishing Workspace", "Generate Publishing Preview", "Publish to Effective",
                 "Create Business Unit", "Update Business Unit",
                 "Create Department", "Update Department",
                 "Create Position", "Update Position",
                 "Create Document Type", "Update Document Type",
                 "Create Document Sub-Type", "Update Document Sub-Type",
                 "Create Storage Location", "Update Storage Location",
                 "Create Retention Policy", "Update Retention Policy",
                 "Create Email Template", "Update Email Template",
                 "Duplicate Email Template", "Toggle Email Template Status", "Test Send Email Template", "Publish Email Template", "Restore Email Template Version",
                 "Update System Configuration", "Update Security Configuration",
                 "Create User", "Update User", "Suspend User", "Terminate User", "Reinstate User", "Reset Password", "Unlock User", "Force Logout", "Update User Role",
                 "Add Education", "Update Education", "Add Certification", "Update Certification",
                 "Create Role", "Update Role", "Update Role Permissions",
                 "Update Document Administration",
                 "Create Prompt Specification", "Queue Prompt Generation" -> "Medium";
            case "Login", "Logout", "Export", "Download", "Restore", "Unassign", "View", "Open", "Preview", "Open Preview", "View Page", "Close Preview", "Add Working Note", "Delete Working Note", "Download Evidence" -> "Low";
            default -> "Low";
        };
    }

    private boolean matchesSearch(AuditLog record, String search) {
        if (!StringUtils.hasText(search)) {
            return true;
        }
        String value = search.toLowerCase(Locale.ROOT);
        return contains(record.getEntityType(), value)
                || contains(record.getActionType(), value)
                || contains(record.getComment(), value)
                || contains(record.getFromStatus(), value)
                || contains(record.getToStatus(), value)
                || (record.getActedBy() != null && (
                        contains(record.getActedBy().getFullName(), value)
                                || contains(record.getActedBy().getUsername(), value)
                                || contains(record.getActedBy().getEmployeeCode(), value)
                ));
    }

    private boolean matchesModule(AuditLog record, String module) {
        if (!StringUtils.hasText(module) || "All".equalsIgnoreCase(module)) {
            return true;
        }
        return mapModule(record.getEntityType()).equalsIgnoreCase(module);
    }

    private boolean matchesAction(AuditLog record, String action) {
        if (!StringUtils.hasText(action) || "All".equalsIgnoreCase(action)) {
            return true;
        }
        return mapAction(record.getActionType()).equalsIgnoreCase(action);
    }

    private boolean matchesUser(AuditLog record, String user) {
        if (!StringUtils.hasText(user)) {
            return true;
        }
        if (record.getActedBy() == null) {
            return false;
        }
        String value = user.toLowerCase(Locale.ROOT);
        return contains(record.getActedBy().getFullName(), value)
                || contains(record.getActedBy().getUsername(), value)
                || contains(record.getActedBy().getEmployeeCode(), value);
    }

    private boolean matchesSeverity(AuditLog record, String severity) {
        if (!StringUtils.hasText(severity) || "All".equalsIgnoreCase(severity)) {
            return true;
        }
        return severityFor(mapAction(record.getActionType())).equalsIgnoreCase(severity);
    }

    private boolean matchesDocumentNumber(AuditLog record, String documentNumber) {
        if (!StringUtils.hasText(documentNumber)) {
            return true;
        }
        String value = documentNumber.toLowerCase(Locale.ROOT);
        return contains(record.getEntityName(), value)
                || contains(record.getEntityId() == null ? null : record.getEntityId().toString(), value)
                || contains(record.getComment(), value);
    }

    private boolean matchesStatus(AuditLog record, String status) {
        if (!StringUtils.hasText(status)) {
            return true;
        }
        String value = status.toLowerCase(Locale.ROOT);
        return contains(record.getFromStatus(), value)
                || contains(record.getToStatus(), value)
                || contains(record.getComment(), value);
    }

    private boolean matchesIpAddress(AuditLog record, String ipAddress) {
        if (!StringUtils.hasText(ipAddress)) {
            return true;
        }
        return contains(record.getIpAddress(), ipAddress.toLowerCase(Locale.ROOT));
    }

    private boolean matchesESignature(AuditLog record, Boolean eSignatureOnly) {
        if (eSignatureOnly == null || !eSignatureOnly) {
            return true;
        }
        return record.getSignatureId() != null;
    }

    private boolean matchesDate(AuditLog record, String dateFrom, String dateTo) {
        if (record.getCreatedAt() == null) {
            return true;
        }
        Instant createdAt = record.getCreatedAt();
        AuditTrailDateRange resolvedDateRange = resolveAuditTrailDateRange(dateFrom, dateTo);
        if (resolvedDateRange.from() != null && createdAt.isBefore(resolvedDateRange.from())) {
            return false;
        }
        if (resolvedDateRange.to() != null && createdAt.isAfter(resolvedDateRange.to())) {
            return false;
        }
        return true;
    }

    private AuditTrailDateRange resolveAuditTrailDateRange(String dateFrom, String dateTo) {
        boolean hasFrom = StringUtils.hasText(dateFrom);
        boolean hasTo = StringUtils.hasText(dateTo);
        if (!hasFrom && !hasTo) {
            LocalDate today = LocalDate.now(ZoneId.systemDefault());
            Instant from = today.minusDays(29).atStartOfDay(ZoneId.systemDefault()).toInstant();
            Instant to = today.plusDays(1).atStartOfDay(ZoneId.systemDefault()).minusNanos(1).toInstant();
            return new AuditTrailDateRange(from, to);
        }

        Instant from = hasFrom ? parseDateBoundary(dateFrom, false) : null;
        Instant to = hasTo ? parseDateBoundary(dateTo, true) : null;
        return new AuditTrailDateRange(from, to);
    }

    private Instant parseDateBoundary(String value, boolean endOfDay) {
        String trimmed = value.trim();
        try {
            if (trimmed.matches("\\d{2}/\\d{2}/\\d{4} \\d{2}:\\d{2}:\\d{2}")) {
                DateTimeFormatter formatter = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm:ss");
                return LocalDateTime.parse(trimmed, formatter).atZone(ZoneId.systemDefault()).toInstant();
            }
            if (trimmed.matches("\\d{2}/\\d{2}/\\d{4}")) {
                DateTimeFormatter formatter = DateTimeFormatter.ofPattern("dd/MM/yyyy");
                LocalDate date = LocalDate.parse(trimmed, formatter);
                return date.atTime(endOfDay ? 23 : 0, endOfDay ? 59 : 0, endOfDay ? 59 : 0)
                        .atZone(ZoneId.systemDefault())
                        .toInstant();
            }
            return Instant.parse(trimmed);
        } catch (DateTimeParseException ex) {
            return null;
        }
    }

    private boolean contains(String text, String search) {
        return text != null && text.toLowerCase(Locale.ROOT).contains(search);
    }

    private String formatInstant(Instant instant) {
        return instant == null ? null : FORMATTER.format(instant);
    }

    private String csv(String value) {
        if (value == null) {
            return "\"\"";
        }
        return "\"" + value.replace("\"", "\"\"") + "\"";
    }

    private Comparator<AuditLog> comparatorFor(String sortBy) {
        String key = StringUtils.hasText(sortBy) ? sortBy.trim().toLowerCase(Locale.ROOT) : "timestamp";
        return switch (key) {
            case "user", "fullname" -> Comparator.comparing(
                    log -> log.getActedBy() == null ? "" : safeLower(log.getActedBy().getFullName()),
                    String::compareTo
            );
            case "module" -> Comparator.comparing(log -> safeLower(mapModule(log.getEntityType())));
            case "action" -> Comparator.comparing(log -> safeLower(mapAction(log.getActionType())));
            case "entityid" -> Comparator.comparing(log -> safeLower(log.getEntityId() == null ? null : log.getEntityId().toString()));
            case "description" -> Comparator.comparing(log -> safeLower(log.getComment()));
            default -> Comparator.comparing(AuditLog::getCreatedAt, Comparator.nullsLast(Comparator.naturalOrder()));
        };
    }

    private String safeLower(String value) {
        return value == null ? "" : value.toLowerCase(Locale.ROOT);
    }

    private record AuditActorSnapshot(
            String id,
            String username,
            String fullName,
            String employeeCode,
            String roleName,
            String positionName,
            String departmentName,
            String avatar
    ) {
    }

    private record AuditEntitySnapshot(
            String entityName,
            String entityLabel,
            String entityCode,
            String documentNumber,
            String entityStatus,
            String revisionNumber
    ) {
        private AuditEntitySnapshot(String entityName, String entityLabel, String entityCode, String documentNumber, String entityStatus) {
            this(entityName, entityLabel, entityCode, documentNumber, entityStatus, null);
        }
    }

    private record AuditTrailDateRange(Instant from, Instant to) {
    }
}
