package com.eqms.service;

import com.eqms.auth.CurrentUserService;
import com.eqms.dto.dictionary.DocumentSubTypeDictionaryRequest;
import com.eqms.dto.dictionary.DocumentSubTypeDictionaryResponse;
import com.eqms.dto.dictionary.DocumentTypeDictionaryRequest;
import com.eqms.dto.dictionary.DocumentTypeDictionaryResponse;
import com.eqms.dto.user.PageResponse;
import com.eqms.entity.DocumentNameFormat;
import com.eqms.entity.DocumentSubType;
import com.eqms.entity.DocumentType;
import com.eqms.entity.ReviewRequirement;
import com.eqms.entity.UserAccount;
import com.eqms.repository.DocumentNameFormatRepository;
import com.eqms.repository.DocumentRecordRepository;
import com.eqms.repository.DocumentSubTypeRepository;
import com.eqms.repository.DocumentTypeRepository;
import jakarta.persistence.EntityNotFoundException;
import jakarta.persistence.criteria.Join;
import jakarta.persistence.criteria.JoinType;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.domain.Page;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

/**
 * Document Types and Sub-Types administration -- part of the Document Control module's
 * "Document Administration" area (see {@code DocumentTypeAdminController}), not Settings >
 * Dictionaries. Owns its own data access rather than going through
 * {@link DictionaryManagementService}, gated by its own
 * {@code documents.admin.document_types.*} permission pair (split out of the old catch-all
 * {@code documents.admin.*} family so an Access Profile can delegate this screen without also
 * granting Publishing Templates, Controlled Copies Policy, etc.).
 */
@Service
public class DocumentTypeAdminService {

    private static final java.util.regex.Pattern SHORT_CODE_PATTERN = java.util.regex.Pattern.compile("^[A-Z0-9][A-Z0-9_/-]{0,19}$");

    private static void requireMaxLength(String value, int max, String label) {
        if (value != null && value.trim().length() > max) {
            throw new IllegalArgumentException(label + " must be at most " + max + " characters");
        }
    }

    private static final String ACTION_DOCUMENT_TYPE_CREATED = "DOCUMENT_TYPE_CREATED";
    private static final String ACTION_DOCUMENT_TYPE_UPDATED = "DOCUMENT_TYPE_UPDATED";
    private static final String ACTION_DOCUMENT_SUB_TYPE_CREATED = "DOCUMENT_SUB_TYPE_CREATED";
    private static final String ACTION_DOCUMENT_SUB_TYPE_UPDATED = "DOCUMENT_SUB_TYPE_UPDATED";

    private final DocumentTypeRepository documentTypeRepository;
    private final DocumentSubTypeRepository documentSubTypeRepository;
    private final DocumentRecordRepository documentRecordRepository;
    private final DocumentNameFormatRepository documentNameFormatRepository;
    private final DocumentComponentResolver documentComponentResolver;
    private final AuditTrailService auditTrailService;
    private final CurrentUserService currentUserService;
    private final PermissionEvaluationService permissionEvaluationService;

    public DocumentTypeAdminService(
            DocumentTypeRepository documentTypeRepository,
            DocumentSubTypeRepository documentSubTypeRepository,
            DocumentRecordRepository documentRecordRepository,
            DocumentNameFormatRepository documentNameFormatRepository,
            DocumentComponentResolver documentComponentResolver,
            AuditTrailService auditTrailService,
            CurrentUserService currentUserService,
            PermissionEvaluationService permissionEvaluationService
    ) {
        this.documentTypeRepository = documentTypeRepository;
        this.documentSubTypeRepository = documentSubTypeRepository;
        this.documentRecordRepository = documentRecordRepository;
        this.documentNameFormatRepository = documentNameFormatRepository;
        this.documentComponentResolver = documentComponentResolver;
        this.auditTrailService = auditTrailService;
        this.currentUserService = currentUserService;
        this.permissionEvaluationService = permissionEvaluationService;
    }

    private void requireView() {
        UserAccount actor = currentUserService.requireCurrentUser();
        if (!permissionEvaluationService.hasAnyPermission(actor,
                "documents.admin.document_types.view", "documents.admin.document_types.manage",
                "settings.configuration.view", "settings.configuration.manage")) {
            throw new AccessDeniedException("Document Types view permission required");
        }
    }

    private void requireManage() {
        UserAccount actor = currentUserService.requireCurrentUser();
        if (!permissionEvaluationService.hasAnyPermission(actor,
                "documents.admin.document_types.manage", "settings.configuration.manage")) {
            throw new AccessDeniedException("Document Types management permission required");
        }
    }

    // ── Document Types ───────────────────────────────────────────────────────

    // Deliberately no permission gate: this unpaginated "give me the full active list" form backs
    // ordinary document-creation dropdowns, not the Document Administration admin screen (that's
    // the *Page() variant below, which requires its own view/manage permission).
    @Transactional(readOnly = true)
    public List<DocumentTypeDictionaryResponse> listDocumentTypes() {
        Map<String, Integer> issuedSequences = loadIssuedDocumentSequences();
        return documentTypeRepository.findAllByOrderByNameAsc()
                .stream()
                .map(documentType -> toDocumentTypeResponse(documentType, issuedSequences))
                .toList();
    }

    @Transactional(readOnly = true)
    public PageResponse<DocumentTypeDictionaryResponse> listDocumentTypesPage(
            String search,
            String status,
            String modifiedFrom,
            String modifiedTo,
            int page,
            int limit,
            String sortBy,
            String sortDirection
    ) {
        requireView();
        Page<DocumentType> result = documentTypeRepository.findAll(
                buildDocumentTypeSpecification(search, status, modifiedFrom, modifiedTo),
                DictionaryQuerySupport.buildPageable(page, limit, sortBy, sortDirection, "name", "modifiedDate", Map.of(
                        "name", "name",
                        "shortCode", "shortCode",
                        "currentSequence", "currentSequence",
                        "description", "description",
                        "isActive", "active"
                ))
        );
        Map<String, Integer> issuedSequences = loadIssuedDocumentSequences();
        return DictionaryQuerySupport.toPageResponse(result, documentType -> toDocumentTypeResponse(documentType, issuedSequences));
    }

    @Transactional
    public DocumentTypeDictionaryResponse createDocumentType(DocumentTypeDictionaryRequest request) {
        requireManage();
        validateUniqueDocumentType(null, request.name(), request.shortCode());
        DocumentType documentType = new DocumentType();
        applyDocumentType(documentType, request, true);
        documentTypeRepository.save(documentType);
        auditTrailService.logSafely("SETTINGS", documentType.getName(), documentType.getId(), ACTION_DOCUMENT_TYPE_CREATED, null, null,
                DictionaryQuerySupport.buildCreateComment("Document Type", documentType.getName(), documentType.getShortCode()));
        return toDocumentTypeResponse(documentType);
    }

    @Transactional
    public DocumentTypeDictionaryResponse updateDocumentType(UUID id, DocumentTypeDictionaryRequest request) {
        requireManage();
        DocumentType documentType = requireDocumentType(id);
        String before = describeDocumentType(documentType);
        validateUniqueDocumentType(id, request.name(), request.shortCode());
        applyDocumentType(documentType, request, false);
        auditTrailService.logSafely("SETTINGS", documentType.getName(), documentType.getId(), ACTION_DOCUMENT_TYPE_UPDATED, null, null,
                DictionaryQuerySupport.buildUpdateComment("Document Type", before, describeDocumentType(documentType)));
        return toDocumentTypeResponse(documentType);
    }

    // Document Types are never deleted — GMP data integrity requires that historical documents,
    // revisions and controlled-copy records keep resolving their type. Deactivate instead.

    // ── Document Sub-Types ───────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<DocumentSubTypeDictionaryResponse> listDocumentSubTypes() {
        return documentSubTypeRepository.findAllByOrderByNameAsc()
                .stream()
                .map(this::toDocumentSubTypeResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public PageResponse<DocumentSubTypeDictionaryResponse> listDocumentSubTypesPage(
            String search,
            String documentType,
            String status,
            String reviewRequirement,
            String modifiedFrom,
            String modifiedTo,
            int page,
            int limit,
            String sortBy,
            String sortDirection
    ) {
        requireView();
        Page<DocumentSubType> result = documentSubTypeRepository.findAll(
                buildDocumentSubTypeSpecification(search, documentType, status, reviewRequirement, modifiedFrom, modifiedTo),
                DictionaryQuerySupport.buildPageable(page, limit, sortBy, sortDirection, "name", "updatedAt", Map.of(
                        "name", "name",
                        "description", "description",
                        "isActive", "active"
                ))
        );
        return DictionaryQuerySupport.toPageResponse(result, this::toDocumentSubTypeResponse);
    }

    @Transactional
    public DocumentSubTypeDictionaryResponse createDocumentSubType(DocumentSubTypeDictionaryRequest request) {
        requireManage();
        DocumentType documentType = requireDocumentTypeById(request.documentTypeId());
        validateUniqueDocumentSubType(null, documentType.getId(), request.name());
        DocumentSubType subType = new DocumentSubType();
        applyDocumentSubType(subType, request, documentType, true);
        documentSubTypeRepository.save(subType);
        auditTrailService.logSafely("SETTINGS", subType.getName(), subType.getId(), ACTION_DOCUMENT_SUB_TYPE_CREATED, null, null,
                DictionaryQuerySupport.buildCreateComment("Document Sub-Type", subType.getName(), documentType.getName()));
        return toDocumentSubTypeResponse(subType);
    }

    @Transactional
    public DocumentSubTypeDictionaryResponse updateDocumentSubType(UUID id, DocumentSubTypeDictionaryRequest request) {
        requireManage();
        DocumentSubType subType = requireDocumentSubType(id);
        String before = describeDocumentSubType(subType);
        DocumentType documentType = requireDocumentTypeById(request.documentTypeId());
        validateUniqueDocumentSubType(id, documentType.getId(), request.name());
        // A Document keeps its Type and Sub-Type together; moving an in-use Sub-Type to another Document
        // Type would leave those Documents with a Sub-Type that no longer belongs to their Type.
        boolean parentChanged = subType.getDocumentType() != null && !subType.getDocumentType().getId().equals(documentType.getId());
        if (parentChanged && documentRecordRepository.existsBySubTypeId(id)) {
            throw new IllegalArgumentException(
                    "This Sub-Type is used by existing documents, so it cannot be moved to another Document Type. Deactivate it and create a new Sub-Type instead.");
        }
        applyDocumentSubType(subType, request, documentType, false);
        documentSubTypeRepository.flush();
        // Documents keep a display copy of the name; keep it aligned so a renamed Sub-Type still resolves on edit.
        documentRecordRepository.updateSubTypeNameBySubTypeId(id, subType.getName());
        auditTrailService.logSafely("SETTINGS", subType.getName(), subType.getId(), ACTION_DOCUMENT_SUB_TYPE_UPDATED, null, null,
                DictionaryQuerySupport.buildUpdateComment("Document Sub-Type", before, describeDocumentSubType(subType)));
        return toDocumentSubTypeResponse(subType);
    }

    // Sub-Types are never deleted — see the note on Document Types above. Deactivate instead.

    // ── Mapping / validation / lookup helpers ───────────────────────────────────

    private void applyDocumentType(DocumentType documentType, DocumentTypeDictionaryRequest request, boolean isNew) {
        String normalizedShortCode = DictionaryQuerySupport.normalizeName(request.shortCode()) == null
                ? null : request.shortCode().trim().toUpperCase(Locale.ROOT);
        requireMaxLength(request.name(), 120, "Document Type name");
        requireMaxLength(request.description(), 512, "Description");
        // The Short Code becomes the prefix of every document number (and of its storage path), so a new
        // or changed code may not contain spaces, dots or other separators. An unchanged legacy code is left alone.
        if (normalizedShortCode == null || (!normalizedShortCode.equals(isNew ? null : documentType.getShortCode())
                && !SHORT_CODE_PATTERN.matcher(normalizedShortCode).matches())) {
            throw new IllegalArgumentException(
                    "Short Code must be 1-20 characters: letters, digits, hyphen, underscore or slash (no spaces or dots)");
        }
        if (!isNew) {
            int issuedSequence = documentRecordRepository.findMaxDocumentSequenceByPrefix(documentType.getShortCode());
            int effectiveCurrentSequence = Math.max(documentType.getCurrentSequence(), issuedSequence);
            if (request.currentSequence() != null && request.currentSequence() != effectiveCurrentSequence) {
                throw new IllegalArgumentException("Current Sequence is system-managed and cannot be changed manually");
            }
            if (!normalizedShortCode.equals(documentType.getShortCode())
                    && documentRecordRepository.existsByDocumentType_Id(documentType.getId())) {
                throw new IllegalArgumentException("Short Code cannot be changed after a document number has been issued for this Document Type");
            }
            // Heal an old cache value during a normal, audited dictionary update.
            documentType.setCurrentSequence(effectiveCurrentSequence);
        }
        documentType.setName(request.name().trim());
        documentType.setShortCode(normalizedShortCode);
        if (isNew) {
            documentType.setCurrentSequence(request.currentSequence() == null ? 0 : request.currentSequence());
        }
        documentType.setDescription(DictionaryQuerySupport.trimToNull(request.description()));
        documentType.setActive(request.isActive() == null ? (isNew || documentType.isActive()) : request.isActive());
        if (request.nameFormatId() != null) {
            DocumentNameFormat format = documentNameFormatRepository.findById(request.nameFormatId())
                    .orElseThrow(() -> new EntityNotFoundException("Document name format not found"));
            if (!documentComponentResolver.isEligibleAsDocumentNumberFormat(format)) {
                throw new IllegalArgumentException(
                        "\"" + format.getName() + "\" cannot be used as a Document Number Format -- only a format "
                                + "composed of exactly [Document Type, Serial Number] joined by \".\" is eligible today.");
            }
            documentType.setNameFormat(format);
        } else if (isNew) {
            // Default every new Document Type onto the seeded "Standard" format so number
            // generation always has one, without forcing the admin to pick it explicitly.
            documentNameFormatRepository.findByNameIgnoreCase("Standard Document Number Format")
                    .ifPresent(documentType::setNameFormat);
        }
    }

    private DocumentTypeDictionaryResponse toDocumentTypeResponse(DocumentType documentType) {
        return toDocumentTypeResponse(documentType, loadIssuedDocumentSequences());
    }

    private DocumentTypeDictionaryResponse toDocumentTypeResponse(
            DocumentType documentType,
            Map<String, Integer> issuedSequences
    ) {
        int sequenceFromIssuedNumbers = issuedSequences.getOrDefault(normalizeCode(documentType.getShortCode()), 0);
        int effectiveCurrentSequence = Math.max(documentType.getCurrentSequence(), sequenceFromIssuedNumbers);
        return new DocumentTypeDictionaryResponse(
                documentType.getId(),
                documentType.getName(),
                documentType.getShortCode(),
                effectiveCurrentSequence,
                documentType.getDescription(),
                documentType.isActive(),
                DictionaryQuerySupport.formatDateTime(documentType.getCreatedAt()),
                DictionaryQuerySupport.formatDateTime(documentType.getUpdatedAt()),
                effectiveCurrentSequence == 0 ? null : formatDocumentNumber(documentType, effectiveCurrentSequence),
                formatDocumentNumber(documentType, effectiveCurrentSequence + 1),
                documentType.getNameFormat() == null ? null : documentType.getNameFormat().getId(),
                documentType.getNameFormat() == null ? null : documentType.getNameFormat().getName()
        );
    }

    // Preview only ("Next Document Number" shown in this admin table) -- mirrors
    // DocumentService#generateDocumentNumber's own engine-vs-fallback choice exactly, so this
    // preview never promises a shape real generation wouldn't actually produce.
    private String formatDocumentNumber(DocumentType documentType, int sequence) {
        boolean useEngine = documentType.getNameFormat() != null
                && documentComponentResolver.isEligibleAsDocumentNumberFormat(documentType.getNameFormat());
        return useEngine
                ? documentComponentResolver.composeDocumentNumber(documentType.getNameFormat(), documentType, null, Math.max(sequence, 1))
                : "%s.%04d".formatted(normalizeCode(documentType.getShortCode()), Math.max(sequence, 1));
    }

    private Map<String, Integer> loadIssuedDocumentSequences() {
        Map<String, Integer> sequences = new HashMap<>();
        for (Object[] row : documentRecordRepository.findMaxDocumentSequencesByPrefix()) {
            if (row == null || row.length < 2 || row[0] == null || row[1] == null) {
                continue;
            }
            sequences.put(row[0].toString().trim().toUpperCase(Locale.ROOT), ((Number) row[1]).intValue());
        }
        return sequences;
    }

    private String normalizeCode(String value) {
        return value == null ? null : value.trim().toUpperCase(Locale.ROOT);
    }

    private DocumentSubTypeDictionaryResponse toDocumentSubTypeResponse(DocumentSubType documentSubType) {
        return new DocumentSubTypeDictionaryResponse(
                documentSubType.getId(),
                documentSubType.getName(),
                documentSubType.getDocumentType() == null ? null : documentSubType.getDocumentType().getId(),
                documentSubType.getDocumentType() == null ? null : documentSubType.getDocumentType().getName(),
                documentSubType.getDescription(),
                documentSubType.getReviewRequirement().name(),
                documentSubType.isActive(),
                DictionaryQuerySupport.formatDateTime(documentSubType.getCreatedAt()),
                DictionaryQuerySupport.formatDateTime(documentSubType.getUpdatedAt())
        );
    }

    private void validateUniqueDocumentType(UUID currentId, String name, String shortCode) {
        String normalizedName = DictionaryQuerySupport.normalizeName(name);
        String normalizedCode = normalizeCode(shortCode);
        documentTypeRepository.findByNameIgnoreCase(normalizedName).ifPresent(found -> {
            if (currentId == null || !found.getId().equals(currentId)) {
                throw new IllegalArgumentException("Document type name already exists");
            }
        });
        documentTypeRepository.findByShortCodeIgnoreCase(normalizedCode).ifPresent(found -> {
            if (currentId == null || !found.getId().equals(currentId)) {
                throw new IllegalArgumentException("Document type short code already exists");
            }
        });
    }

    private void validateUniqueDocumentSubType(UUID currentId, UUID documentTypeId, String name) {
        String normalizedName = DictionaryQuerySupport.normalizeName(name);
        documentSubTypeRepository.findByDocumentType_IdAndNameIgnoreCase(documentTypeId, normalizedName).ifPresent(found -> {
            if (currentId == null || !found.getId().equals(currentId)) {
                throw new IllegalArgumentException("Sub-type name already exists for the selected document type");
            }
        });
    }

    private DocumentType requireDocumentType(UUID id) {
        return documentTypeRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Document type not found"));
    }

    private DocumentType requireDocumentTypeById(String documentTypeId) {
        UUID id;
        try {
            id = UUID.fromString(DictionaryQuerySupport.normalizeName(documentTypeId));
        } catch (Exception ex) {
            throw new EntityNotFoundException("Document type not found");
        }
        return requireDocumentType(id);
    }

    private DocumentSubType requireDocumentSubType(UUID id) {
        return documentSubTypeRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Document sub-type not found"));
    }

    private String describeDocumentType(DocumentType documentType) {
        if (documentType == null) {
            return null;
        }
        return documentType.getName() + " (" + DictionaryQuerySupport.safeText(documentType.getShortCode()) + ")";
    }

    private String describeDocumentSubType(DocumentSubType subType) {
        return subType.getName()
                + " | Document Type: " + (subType.getDocumentType() == null ? "-" : subType.getDocumentType().getName())
                + " | Review Requirement: " + subType.getReviewRequirement().name()
                + " | Status: " + (subType.isActive() ? "Active" : "Inactive")
                + (StringUtils.hasText(subType.getDescription()) ? " | Description: " + subType.getDescription() : "");
    }

    private void applyDocumentSubType(DocumentSubType subType, DocumentSubTypeDictionaryRequest request, DocumentType documentType, boolean isNew) {
        requireMaxLength(request.name(), 120, "Sub-Type name");
        requireMaxLength(request.description(), 512, "Description");
        boolean requestedActive = request.isActive() == null ? (isNew || subType.isActive()) : request.isActive();
        if (requestedActive && !documentType.isActive()) {
            throw new IllegalArgumentException("A Sub-Type cannot be active under an inactive Document Type. Activate the Document Type first.");
        }
        subType.setName(request.name().trim());
        subType.setDocumentType(documentType);
        subType.setDescription(DictionaryQuerySupport.trimToNull(request.description()));
        // PATCH-style updates omit untouched fields; keep the immutable
        // configuration value rather than silently resetting it to REQUIRED.
        if (StringUtils.hasText(request.reviewRequirement()) || subType.getReviewRequirement() == null) {
            subType.setReviewRequirement(parseReviewRequirement(request.reviewRequirement()));
        }
        subType.setActive(requestedActive);
    }

    private ReviewRequirement parseReviewRequirement(String value) {
        if (!StringUtils.hasText(value)) {
            return ReviewRequirement.REQUIRED;
        }
        try {
            return ReviewRequirement.valueOf(value.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException ex) {
            throw new IllegalArgumentException("Review requirement must be NONE or REQUIRED");
        }
    }

    /** Parses a review-requirement filter value; returns null for blank / "ALL" / anything unrecognised. */
    private ReviewRequirement parseReviewRequirementFilter(String value) {
        if (!StringUtils.hasText(value) || "ALL".equalsIgnoreCase(value.trim())) {
            return null;
        }
        try {
            return ReviewRequirement.valueOf(value.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException ex) {
            return null;
        }
    }

    private Specification<DocumentType> buildDocumentTypeSpecification(String search, String status, String modifiedFrom, String modifiedTo) {
        return (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            DictionaryQuerySupport.addSearchPredicate(predicates, cb, search, root.get("name"), root.get("shortCode"), root.get("description"));
            DictionaryQuerySupport.addStatusPredicate(predicates, cb, root.get("active"), status);
            DictionaryQuerySupport.addUpdatedAtRangePredicate(predicates, cb, root.get("updatedAt"), modifiedFrom, modifiedTo);
            return cb.and(predicates.toArray(new Predicate[0]));
        };
    }

    private Specification<DocumentSubType> buildDocumentSubTypeSpecification(String search, String documentType, String status, String reviewRequirement, String modifiedFrom, String modifiedTo) {
        return (root, query, cb) -> {
            query.distinct(true);
            Join<DocumentSubType, DocumentType> documentTypeJoin = root.join("documentType", JoinType.LEFT);
            List<Predicate> predicates = new ArrayList<>();
            DictionaryQuerySupport.addSearchPredicate(predicates, cb, search, root.get("name"), root.get("description"), documentTypeJoin.get("name"), documentTypeJoin.get("shortCode"));
            DictionaryQuerySupport.addStatusPredicate(predicates, cb, root.get("active"), status);
            DictionaryQuerySupport.addUpdatedAtRangePredicate(predicates, cb, root.get("updatedAt"), modifiedFrom, modifiedTo);
            addDocumentTypePredicate(predicates, cb, documentTypeJoin, documentType);
            ReviewRequirement review = parseReviewRequirementFilter(reviewRequirement);
            if (review != null) {
                predicates.add(cb.equal(root.get("reviewRequirement"), review));
            }
            return cb.and(predicates.toArray(new Predicate[0]));
        };
    }

    private void addDocumentTypePredicate(
            List<Predicate> predicates,
            jakarta.persistence.criteria.CriteriaBuilder cb,
            Join<DocumentSubType, DocumentType> documentTypeJoin,
            String documentTypeValue
    ) {
        String normalized = documentTypeValue == null ? null : documentTypeValue.trim().toLowerCase(Locale.ROOT);
        if (normalized == null || normalized.isEmpty() || "all".equalsIgnoreCase(normalized)) {
            return;
        }
        try {
            predicates.add(cb.equal(documentTypeJoin.get("id"), UUID.fromString(documentTypeValue.trim())));
        } catch (Exception ex) {
            predicates.add(cb.or(
                    cb.equal(cb.lower(documentTypeJoin.get("name")), normalized),
                    cb.equal(cb.lower(documentTypeJoin.get("shortCode")), normalized)
            ));
        }
    }
}
