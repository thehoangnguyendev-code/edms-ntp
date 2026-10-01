package com.eqms.service;

import com.eqms.auth.CurrentUserService;
import com.eqms.dto.executedrecord.FormSettingsRequest;
import com.eqms.dto.executedrecord.FormSettingsResponse;
import com.eqms.entity.DocumentRecord;
import com.eqms.entity.DocumentRevisionRecord;
import com.eqms.entity.FormSettings;
import com.eqms.entity.UserAccount;
import com.eqms.repository.DocumentRecordRepository;
import com.eqms.repository.DocumentRevisionRepository;
import com.eqms.repository.FormSettingsRepository;
import com.eqms.repository.UserAccountRepository;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.util.List;
import java.util.UUID;

/**
 * Per-Form opt-in configuration (allow eForm / allow paper / require approval / approver) --
 * decided on the Document's own Workflow panel by Author/DCO, not a Document Type policy. See
 * ExecutedRecordService for the resulting record lifecycle.
 */
@Service
public class FormSettingsService {

    public static final String P_CONFIGURE = "documents.form.configure";
    public static final String P_FILL_EFORM = "documents.form.fill_eform";
    public static final String P_RECORD_PAPER = "documents.form.record_physical_copy";
    private static final String ENTITY_TYPE = "FORM_SETTINGS";

    private final FormSettingsRepository formSettingsRepository;
    private final DocumentRecordRepository documentRecordRepository;
    private final DocumentRevisionRepository documentRevisionRepository;
    private final UserAccountRepository userAccountRepository;
    private final CurrentUserService currentUserService;
    private final PermissionEvaluationService permissionEvaluationService;
    private final DocumentAuthorizationService documentAuthorizationService;
    private final AuditTrailService auditTrailService;
    private final ElectronicSignatureService electronicSignatureService;

    public FormSettingsService(
            FormSettingsRepository formSettingsRepository,
            DocumentRecordRepository documentRecordRepository,
            DocumentRevisionRepository documentRevisionRepository,
            UserAccountRepository userAccountRepository,
            CurrentUserService currentUserService,
            PermissionEvaluationService permissionEvaluationService,
            DocumentAuthorizationService documentAuthorizationService,
            AuditTrailService auditTrailService,
            ElectronicSignatureService electronicSignatureService
    ) {
        this.formSettingsRepository = formSettingsRepository;
        this.documentRecordRepository = documentRecordRepository;
        this.documentRevisionRepository = documentRevisionRepository;
        this.userAccountRepository = userAccountRepository;
        this.currentUserService = currentUserService;
        this.permissionEvaluationService = permissionEvaluationService;
        this.documentAuthorizationService = documentAuthorizationService;
        this.auditTrailService = auditTrailService;
        this.electronicSignatureService = electronicSignatureService;
    }

    @Transactional(readOnly = true)
    public FormSettingsResponse getForDocument(UUID documentId) {
        UserAccount currentUser = currentUserService.requireCurrentUser();
        DocumentRecord document = requireDocument(documentId);
        documentAuthorizationService.requireCanViewDocument(currentUser, document);
        FormSettings settings = formSettingsRepository.findByDocument_Id(documentId).orElse(null);
        return toResponse(settings, currentUser);
    }

    @Transactional
    public FormSettingsResponse update(UUID documentId, FormSettingsRequest request) {
        UserAccount currentUser = currentUserService.requireCurrentUser();
        if (!permissionEvaluationService.hasPermission(currentUser, P_CONFIGURE)) {
            throw new AccessDeniedException("Not permitted to configure Form settings");
        }
        DocumentRecord document = requireDocument(documentId);
        documentAuthorizationService.requireCanViewDocument(currentUser, document);

        FormSettings settings = formSettingsRepository.findByDocument_Id(documentId).orElseGet(() -> {
            FormSettings created = new FormSettings();
            created.setId(UUID.randomUUID());
            created.setDocument(document);
            return created;
        });

        String from = describe(settings);
        settings.setAllowEform(request.allowEform());
        settings.setAllowPaper(request.allowPaper());
        settings.setRequireApproval(request.requireApproval());
        UUID approverId = parseUuidOrNull(request.approverUserId());
        if (request.requireApproval() && approverId == null) {
            throw new IllegalArgumentException("An Approver is required when approval is enabled");
        }
        settings.setApprover(approverId == null ? null : userAccountRepository.findById(approverId)
                .orElseThrow(() -> new IllegalArgumentException("Approver not found")));

        electronicSignatureService.createEntitySignature(
                ENTITY_TYPE, document.getId(), document.getDocumentNumber(), currentUser,
                request.signatureToken(), "FORM_SETTINGS_UPDATED", request.reason(), null, from, describe(settings));

        FormSettings saved = formSettingsRepository.save(settings);
        auditTrailService.logAs(currentUser, ENTITY_TYPE, document.getDocumentNumber(), document.getId(),
                "UPDATE", from, describe(saved), null, List.of(), null);
        return toResponse(saved, currentUser);
    }

    /** Used by {@link ExecutedRecordService} -- returns null (both capture methods unavailable) if never configured. */
    public FormSettings requireSettingsOrNull(UUID documentId) {
        return formSettingsRepository.findByDocument_Id(documentId).orElse(null);
    }

    private DocumentRecord requireDocument(UUID documentId) {
        if (documentId == null) {
            throw new IllegalArgumentException("Document not found");
        }
        return documentRecordRepository.findById(documentId)
                .orElseThrow(() -> new IllegalArgumentException("Document not found"));
    }

    private FormSettingsResponse toResponse(FormSettings settings, UserAccount currentUser) {
        boolean canFill = permissionEvaluationService.hasPermission(currentUser, P_FILL_EFORM);
        boolean canRecord = permissionEvaluationService.hasPermission(currentUser, P_RECORD_PAPER);
        if (settings == null) {
            return new FormSettingsResponse(null, false, false, false, null, null, false, false, false);
        }
        return new FormSettingsResponse(
                settings.getDocument().getId().toString(),
                settings.isAllowEform(),
                settings.isAllowPaper(),
                settings.isRequireApproval(),
                settings.getApprover() == null ? null : settings.getApprover().getId().toString(),
                settings.getApprover() == null ? null : settings.getApprover().getFullName(),
                canFill && settings.isAllowEform(),
                canRecord && settings.isAllowPaper(),
                hasFillableTemplate(settings.getDocument().getId())
        );
    }

    /** The fillable template now lives on the Document's current Effective Revision (see
     *  RevisionService#setFillableTemplate) -- Fill always operates against that Revision. */
    private boolean hasFillableTemplate(UUID documentId) {
        DocumentRevisionRecord effective = documentRevisionRepository
                .findFirstByDocument_IdAndStatus_CodeOrderByCreatedAtDesc(documentId, "EFFECTIVE")
                .orElse(null);
        return effective != null && StringUtils.hasText(effective.getFillableTemplateStorageObjectKey());
    }

    private String describe(FormSettings settings) {
        return "eform=" + settings.isAllowEform() + ", paper=" + settings.isAllowPaper()
                + ", approval=" + settings.isRequireApproval()
                + ", approver=" + (settings.getApprover() == null ? "none" : settings.getApprover().getFullName());
    }

    private UUID parseUuidOrNull(String value) {
        if (!StringUtils.hasText(value)) {
            return null;
        }
        try {
            return UUID.fromString(value.trim());
        } catch (IllegalArgumentException ex) {
            return null;
        }
    }
}
