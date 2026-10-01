package com.eqms.service;

import com.eqms.auth.CurrentUserService;
import com.eqms.dto.executedrecord.FillStepResponse;
import com.eqms.dto.executedrecord.FormSettingsResponse;
import com.eqms.entity.ControlledCopyRecord;
import com.eqms.entity.DocumentRecord;
import com.eqms.entity.DocumentRevisionRecord;
import com.eqms.entity.EformEditSession;
import com.eqms.entity.EformFillRun;
import com.eqms.entity.EformSignerAssignment;
import com.eqms.entity.FormSettings;
import com.eqms.entity.UserAccount;
import com.eqms.repository.ControlledCopyRepository;
import com.eqms.repository.DocumentRecordRepository;
import com.eqms.repository.DocumentRevisionRepository;
import com.eqms.repository.EformEditSessionRepository;
import com.eqms.repository.EformFillRunRepository;
import com.eqms.repository.EformSignerAssignmentRepository;
import com.eqms.service.editprovider.EditMode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/**
 * Live OnlyOffice sessions for a Form: an Author designing fillable fields on the Form's PDF
 * (DESIGN, keyed off the Form Document itself) or an end user filling/signing them in-browser
 * (FILL, keyed off one specific electronic {@link ControlledCopyRecord} distribution -- who may
 * fill/sign what, and in what order, is configured per-distribution by the DCO, not a standing
 * setting on the Form; see {@link EformSignerAssignment} / the approved plan "Form / eForm --
 * Phase 2b: Per-Distribution Sequential Signer Assignment"). Committing a DESIGN session updates
 * {@link FormSettingsService}'s fillable-template columns.
 */
@Service
public class EformEditSessionService {

    public static final String P_DESIGN = "documents.form.design_efield";
    public static final String P_FILL = "documents.form.fill_eform";
    static final String PURPOSE_DESIGN = "design";
    static final String PURPOSE_FILL = "fill";
    private static final String ENTITY_TYPE = "EFORM_EDIT_SESSION";
    private static final String KIND_DESIGN = "DESIGN";
    private static final String KIND_FILL = "FILL";
    private static final String STATUS_ACTIVE = "ACTIVE";
    private static final String STATUS_SAVED = "SAVED";
    private static final String STATUS_SUBMITTED = "SUBMITTED";
    private static final String STATUS_ABANDONED = "ABANDONED";
    private static final String RUN_STATUS_IN_PROGRESS = "IN_PROGRESS";
    private static final String RUN_STATUS_COMPLETED = "COMPLETED";
    /** Admin override for session ownership checks -- same escape hatch used elsewhere in Settings. */
    private static final String P_ADMIN_OVERRIDE = "settings.configuration.manage";

    private final EformEditSessionRepository sessionRepository;
    private final EformFillRunRepository fillRunRepository;
    private final EformSignerAssignmentRepository signerAssignmentRepository;
    private final ControlledCopyRepository controlledCopyRepository;
    private final DocumentRecordRepository documentRecordRepository;
    private final DocumentRevisionRepository documentRevisionRepository;
    private final FormSettingsService formSettingsService;
    private final CurrentUserService currentUserService;
    private final PermissionEvaluationService permissionEvaluationService;
    private final DocumentAuthorizationService documentAuthorizationService;
    private final AuditTrailService auditTrailService;
    private final ElectronicSignatureService electronicSignatureService;
    private final FileStorageService fileStorageService;
    private final OnlyOfficeDocumentEditService onlyOfficeDocumentEditService;
    private final RevisionService revisionService;
    private final ExecutedRecordService executedRecordService;
    private final NotificationDispatcher notificationDispatcher;

    @org.springframework.beans.factory.annotation.Value("${app.public-url:http://localhost:3000}")
    private String appPublicUrlConfig;
    private final ControlledCopyService controlledCopyService;
    private final SystemActorProvider systemActorProvider;

    public EformEditSessionService(
            EformEditSessionRepository sessionRepository,
            EformFillRunRepository fillRunRepository,
            EformSignerAssignmentRepository signerAssignmentRepository,
            ControlledCopyRepository controlledCopyRepository,
            DocumentRecordRepository documentRecordRepository,
            DocumentRevisionRepository documentRevisionRepository,
            FormSettingsService formSettingsService,
            CurrentUserService currentUserService,
            PermissionEvaluationService permissionEvaluationService,
            DocumentAuthorizationService documentAuthorizationService,
            AuditTrailService auditTrailService,
            ElectronicSignatureService electronicSignatureService,
            FileStorageService fileStorageService,
            OnlyOfficeDocumentEditService onlyOfficeDocumentEditService,
            RevisionService revisionService,
            ExecutedRecordService executedRecordService,
            NotificationDispatcher notificationDispatcher,
            ControlledCopyService controlledCopyService,
            SystemActorProvider systemActorProvider
    ) {
        this.sessionRepository = sessionRepository;
        this.fillRunRepository = fillRunRepository;
        this.signerAssignmentRepository = signerAssignmentRepository;
        this.controlledCopyRepository = controlledCopyRepository;
        this.documentRecordRepository = documentRecordRepository;
        this.documentRevisionRepository = documentRevisionRepository;
        this.formSettingsService = formSettingsService;
        this.currentUserService = currentUserService;
        this.permissionEvaluationService = permissionEvaluationService;
        this.documentAuthorizationService = documentAuthorizationService;
        this.auditTrailService = auditTrailService;
        this.electronicSignatureService = electronicSignatureService;
        this.fileStorageService = fileStorageService;
        this.onlyOfficeDocumentEditService = onlyOfficeDocumentEditService;
        this.revisionService = revisionService;
        this.executedRecordService = executedRecordService;
        this.notificationDispatcher = notificationDispatcher;
        this.controlledCopyService = controlledCopyService;
        this.systemActorProvider = systemActorProvider;
    }

    /** Message prefix the frontend matches on to show a confirm-to-overwrite dialog instead of a
     *  plain error toast -- see {@link #startDesignSession(UUID, boolean)}. */
    public static final String STALE_TEMPLATE_PREFIX = "CONTENT_CHANGED_SINCE_DESIGN:";

    public EformEditSession startDesignSession(UUID formDocumentId) {
        return startDesignSession(formDocumentId, false);
    }

    @Transactional
    public EformEditSession startDesignSession(UUID formDocumentId, boolean acknowledgeStaleContent) {
        UserAccount currentUser = currentUserService.requireCurrentUser();
        requirePermission(currentUser, P_DESIGN, "Not permitted to design eForm fields");
        DocumentRecord document = requireDocument(formDocumentId);
        documentAuthorizationService.requireCanViewDocument(currentUser, document);
        FormSettings settings = formSettingsService.requireSettingsOrNull(formDocumentId);
        if (settings == null) {
            throw new IllegalStateException("Configure Form Settings before designing eForm fields.");
        }

        DocumentRevisionRecord draft = requireDraftRevision(document);
        boolean hasExistingTemplate = StringUtils.hasText(draft.getFillableTemplateStorageObjectKey());
        // The static content (edited via the normal Edit button) may have changed since fields
        // were last designed -- resuming the old field layout silently risks fields that no longer
        // line up with the text. StringUtils.hasText guards the (legacy/never-edited) case where
        // sourceFileChecksum itself might be blank, so that never masquerades as "changed".
        boolean contentChangedSinceDesign = hasExistingTemplate
                && StringUtils.hasText(draft.getSourceFileChecksum())
                && !draft.getSourceFileChecksum().equals(draft.getFillableTemplateSourceChecksum());
        if (contentChangedSinceDesign && !acknowledgeStaleContent) {
            throw new IllegalStateException(STALE_TEMPLATE_PREFIX
                    + "This Form's content has been edited since fields were last designed -- the existing field layout may no longer line up with the text. Redesigning now will replace it.");
        }

        EformEditSession session = new EformEditSession();
        session.setId(UUID.randomUUID());
        session.setKind(KIND_DESIGN);
        session.setFormDocument(document);
        session.setStartedBy(currentUser);
        session.setStatus(STATUS_ACTIVE);

        if (hasExistingTemplate && !contentChangedSinceDesign) {
            // Resume editing the existing fillable template for this Draft revision.
            session.setFileName(draft.getFillableTemplateFileName());
            session.setStorageProvider(draft.getFillableTemplateStorageProvider());
            session.setStorageBucket(draft.getFillableTemplateStorageBucket());
            session.setStorageObjectKey(draft.getFillableTemplateStorageObjectKey());
            session.setStorageVersionId(draft.getFillableTemplateStorageVersionId());
            session.setChecksum(draft.getFillableTemplateChecksum());
        } else {
            // First time: seed from this Draft revision's own uploaded source file, converted to
            // OnlyOffice's DOCXF "form template" format -- the Forms ribbon (needed to place NEW
            // fillable fields) only appears when the open file's type is docxf; a plain docx
            // opened with full edit:true still shows no Forms tab, and neither does a PDF
            // (both confirmed by live testing).
            byte[] sourceBytes;
            try {
                sourceBytes = revisionService.readCurrentSourceFileBytes(draft);
            } catch (IOException ex) {
                throw new IllegalStateException("Unable to read this Form's source file for field design: " + ex.getMessage(), ex);
            }
            String sourceFileName = StringUtils.hasText(draft.getFileName()) ? draft.getFileName() : document.getDocumentNumber() + ".docx";
            byte[] docxfBytes;
            java.nio.file.Path tempFile = null;
            try {
                tempFile = java.nio.file.Files.createTempFile("eform-design-", "-" + sourceFileName);
                java.nio.file.Files.write(tempFile, sourceBytes);
                docxfBytes = onlyOfficeDocumentEditService.convertLocalFileToDocxf(tempFile, sourceFileName);
            } catch (IOException ex) {
                throw new IllegalStateException("Unable to prepare this Form as a fillable template: " + ex.getMessage(), ex);
            } finally {
                if (tempFile != null) {
                    try {
                        java.nio.file.Files.deleteIfExists(tempFile);
                    } catch (IOException ignored) {
                        // Best-effort cleanup only; OS temp dir will reclaim it eventually.
                    }
                }
            }
            String baseName = sourceFileName.contains(".") ? sourceFileName.substring(0, sourceFileName.lastIndexOf('.')) : sourceFileName;
            String fileName = baseName + ".docxf";
            storeIntoSession(session, fileName, docxfBytes);
        }
        return sessionRepository.save(session);
    }

    /**
     * Starts (or continues) the Fill/Sign flow for one specific electronic Controlled Copy
     * distribution. {@code roleName} null/blank means the initial data-entry FILL phase -- gated
     * to the copy's own recipient, never a generic permission check, since "the person the copy
     * was distributed to" IS the filler (see the approved Phase 2b plan). A non-blank
     * {@code roleName} is a signer step, gated to whoever {@link EformSignerAssignment} names for
     * that role on THIS copy, enforced in the configured sequence order.
     */
    @Transactional
    public EformEditSession startFillSession(UUID controlledCopyId, String roleName) {
        UserAccount currentUser = currentUserService.requireCurrentUser();
        ControlledCopyRecord copy = requireControlledCopy(controlledCopyId);
        if (!"ELECTRONIC".equals(copy.getDeliveryMode())) {
            throw new IllegalStateException("This Controlled Copy is not an electronic distribution.");
        }
        DocumentRecord document = copy.getDocument();
        documentAuthorizationService.requireCanViewDocument(currentUser, document);
        FormSettings settings = formSettingsService.requireSettingsOrNull(document.getId());
        if (settings == null || !settings.isAllowEform()) {
            throw new IllegalStateException("This Form does not accept eForm submissions.");
        }
        DocumentRevisionRecord effective = requireEffectiveRevision(document);
        if (!StringUtils.hasText(effective.getFillableTemplateStorageObjectKey())) {
            throw new IllegalStateException("Ask an Author to design this Form's fields first.");
        }

        List<EformSignerAssignment> roles = signerAssignmentRepository.findAllByControlledCopy_IdOrderBySequenceAsc(controlledCopyId);

        EformEditSession session = new EformEditSession();
        session.setId(UUID.randomUUID());
        session.setKind(KIND_FILL);
        session.setFormDocument(document);
        session.setStartedBy(currentUser);
        session.setStatus(STATUS_ACTIVE);

        if (roles.isEmpty()) {
            // No signer roles configured for this copy -- back-compat: a single session fills
            // everything in one step, gated to the copy's own recipient.
            requireRecipient(copy, currentUser);
            seedFromTemplate(session, effective);
            return sessionRepository.save(session);
        }

        Optional<EformFillRun> activeRun = fillRunRepository.findByControlledCopy_IdAndStatus(controlledCopyId, RUN_STATUS_IN_PROGRESS);

        if (!StringUtils.hasText(roleName)) {
            // The data-entry FILL phase -- always first, before any signer's turn.
            if (activeRun.isPresent()) {
                throw new IllegalStateException("This eForm has already been filled -- the signer chain is now in progress.");
            }
            requireRecipient(copy, currentUser);
            EformFillRun run = new EformFillRun();
            run.setId(UUID.randomUUID());
            run.setFormDocument(document);
            run.setControlledCopy(copy);
            run.setStatus(RUN_STATUS_IN_PROGRESS);
            run.setCurrentSequence(0); // sentinel: fill phase, before the first signer's turn
            run.setStartedBy(currentUser);
            run.setFileName(effective.getFillableTemplateFileName());
            run.setStorageProvider(effective.getFillableTemplateStorageProvider());
            run.setStorageBucket(effective.getFillableTemplateStorageBucket());
            run.setStorageObjectKey(effective.getFillableTemplateStorageObjectKey());
            run.setStorageVersionId(effective.getFillableTemplateStorageVersionId());
            run.setChecksum(effective.getFillableTemplateChecksum());
            fillRunRepository.save(run);
            session.setFillRun(run);
            seedFromTemplate(session, effective);
            return sessionRepository.save(session);
        }

        // A signer step -- the FILL phase must have happened first.
        if (activeRun.isEmpty()) {
            throw new IllegalStateException("This eForm has not been filled yet -- ask the recipient to fill it first.");
        }
        EformFillRun run = activeRun.get();
        EformSignerAssignment assignment = roles.stream()
                .filter(a -> a.getRoleName().equals(roleName))
                .findFirst()
                .orElseThrow(() -> new IllegalStateException("Role \"" + roleName + "\" has not been assigned to anyone for this copy."));
        boolean isAssignee = assignment.getAssignedUser().getId().equals(currentUser.getId());
        if (!isAssignee && !permissionEvaluationService.hasPermission(currentUser, P_ADMIN_OVERRIDE)) {
            throw new AccessDeniedException("You are not the assigned signer for role \"" + roleName + "\" on this copy.");
        }
        int expectedSequence = run.getCurrentSequence() == 0
                ? roles.stream().mapToInt(EformSignerAssignment::getSequence).min().orElseThrow()
                : run.getCurrentSequence();
        if (assignment.getSequence() != expectedSequence) {
            EformSignerAssignment expectedRole = roles.stream().filter(a -> a.getSequence() == expectedSequence).findFirst().orElse(null);
            String waitingFor = expectedRole == null ? "an earlier role" : expectedRole.getRoleName() + " (" + expectedRole.getAssignedUser().getFullName() + ")";
            throw new IllegalStateException("It is not role \"" + roleName + "\"'s turn yet -- waiting on " + waitingFor + " to sign first.");
        }

        // Seed from the RUN's latest accumulated file -- carries every earlier step's content
        // forward (the recipient's filled-in data, plus every earlier signer), instead of
        // discarding it.
        session.setAssignedRole(roleName.trim());
        session.setFillRun(run);
        session.setFileName(run.getFileName());
        session.setStorageProvider(run.getStorageProvider());
        session.setStorageBucket(run.getStorageBucket());
        session.setStorageObjectKey(run.getStorageObjectKey());
        session.setStorageVersionId(run.getStorageVersionId());
        session.setChecksum(run.getChecksum());
        return sessionRepository.save(session);
    }

    /**
     * Signs off the current user's Fill step. For a Form with no roles configured, this is the
     * whole submission in one shot (delegates straight to {@link ExecutedRecordService#submitEformFromSession}).
     * For a sequential multi-role Form, this either (a) advances the {@link EformFillRun} to the
     * next role in sequence -- recording this step's own "EFORM_ROLE_SIGNED" signature -- or,
     * if this was the LAST role, marks the run COMPLETED and submits it as the Executed Record.
     * The signature token is single-use, so exactly one {@code createEntitySignature} call happens
     * per invocation: intermediate steps sign as themselves, the final step's token IS the
     * Executed Record's own submit signature (no double-signing).
     */
    @Transactional
    public FillStepResponse completeFillStep(UUID sessionId, String reason, String signatureToken) throws IOException {
        UserAccount currentUser = currentUserService.requireCurrentUser();
        EformEditSession session = requireSession(sessionId);
        if (!KIND_FILL.equals(session.getKind())) {
            throw new IllegalArgumentException("Not a fill session");
        }
        requireOwnerOrAdmin(currentUser, session);
        if (!STATUS_SAVED.equals(session.getStatus())) {
            throw new IllegalStateException("Fill in at least one field (and let it auto-save) before submitting.");
        }
        UUID formDocumentId = session.getFormDocument().getId();

        if (session.getFillRun() == null) {
            var record = executedRecordService.submitEformFromSession(formDocumentId, sessionId, reason, signatureToken);
            return new FillStepResponse(true, record);
        }

        EformFillRun run = session.getFillRun();
        UUID controlledCopyId = run.getControlledCopy().getId();
        List<EformSignerAssignment> roles = signerAssignmentRepository.findAllByControlledCopy_IdOrderBySequenceAsc(controlledCopyId);
        Optional<Integer> nextSequence = roles.stream()
                .map(EformSignerAssignment::getSequence)
                .filter(s -> s > run.getCurrentSequence())
                .min(Comparator.naturalOrder());

        if (nextSequence.isPresent()) {
            // Not the last step yet (could be the initial FILL phase handing off to the first
            // signer, or an intermediate signer handing off to the next one) -- sign this step on
            // its own, copy this step's file into the run so the next step builds on it, notify
            // the next person in line, and hand off.
            boolean isSignerStep = session.getAssignedRole() != null;
            String meaning = isSignerStep ? "EFORM_ROLE_SIGNED" : "EFORM_FILLED";
            String stepLabel = isSignerStep ? session.getAssignedRole() : "Filled";
            electronicSignatureService.createEntitySignature(
                    "EFORM_FILL_RUN", run.getId(), session.getFormDocument().getDocumentNumber(), currentUser,
                    signatureToken, meaning, reason, stepLabel,
                    "sequence " + run.getCurrentSequence(), "sequence " + nextSequence.get());
            copyIntoRun(run, session);
            run.setCurrentSequence(nextSequence.get());
            fillRunRepository.save(run);
            session.setStatus(STATUS_SUBMITTED);
            sessionRepository.save(session);
            notifyNextSigner(run, roles, nextSequence.get());
            auditTrailService.logAs(currentUser, ENTITY_TYPE, session.getFormDocument().getDocumentNumber(), session.getId(),
                    "SIGN_FILL_STEP", stepLabel, "awaiting next role", "\"" + stepLabel + "\" step signed", List.of(), null);
            return new FillStepResponse(false, null);
        }

        // Last role in sequence -- fold this step's file into the run, mark it COMPLETED, and let
        // the token flow straight into the Executed Record's own submit signature.
        copyIntoRun(run, session);
        run.setStatus(RUN_STATUS_COMPLETED);
        fillRunRepository.save(run);
        session.setStatus(STATUS_SUBMITTED);
        sessionRepository.save(session);
        var record = executedRecordService.submitEformFromFillRun(formDocumentId, run.getId(), reason, signatureToken);
        // Closes the Controlled Copy register loop -- system-driven consequence of the signing
        // chain completing, not a separately-attested act (the last signer's own signature already
        // covers the GxP event on the ExecutedRecord), so no second signature token is consumed.
        controlledCopyService.closeAfterExecutedRecord(run.getControlledCopy().getId(), systemActorProvider.get(), "eForm signing chain completed");
        return new FillStepResponse(true, record);
    }

    /** Notifies whoever is assigned the next sequence number in this run's signer chain that it's
     *  their turn, on every enabled channel (in-app + email) via the policy-driven event
     *  "eform.signer_turn" (seeded in V523) -- best-effort: a missing/duplicate assignment at this
     *  sequence is skipped rather than failing the step that already successfully signed. */
    private void notifyNextSigner(EformFillRun run, List<EformSignerAssignment> roles, int nextSequence) {
        roles.stream()
                .filter(a -> a.getSequence() == nextSequence)
                .findFirst()
                .ifPresent(next -> {
                    String actionUrl = appPublicUrl() + "/documents/forms/controlled-copies/"
                            + run.getControlledCopy().getId() + "/fill-eform?role=" + next.getRoleName();
                    notificationDispatcher.dispatch("eform.signer_turn", List.of(next.getAssignedUser()), Map.of(
                            "documentNumber", run.getFormDocument().getDocumentNumber(),
                            "roleName", next.getRoleName(),
                            "actionUrl", actionUrl));
                });
    }

    private String appPublicUrl() {
        String url = StringUtils.hasText(appPublicUrlConfig) ? appPublicUrlConfig.trim() : "http://localhost:3000";
        return url.endsWith("/") ? url.substring(0, url.length() - 1) : url;
    }

    @Transactional(readOnly = true)
    public ObjectNode getEditConfig(UUID sessionId) {
        UserAccount currentUser = currentUserService.requireCurrentUser();
        EformEditSession session = requireSession(sessionId);
        requireOwnerOrAdmin(currentUser, session);
        boolean isDesign = KIND_DESIGN.equals(session.getKind());
        EditMode mode = isDesign ? EditMode.EDIT : EditMode.FILL;
        String purpose = isDesign ? PURPOSE_DESIGN : PURPOSE_FILL;
        String fileName = StringUtils.hasText(session.getFileName())
                ? session.getFileName()
                : session.getFormDocument().getDocumentNumber() + ".docx";
        return onlyOfficeDocumentEditService.buildFormSessionConfig(
                session.getId(), session.getSaveVersion(), purpose, fileName, mode, currentUser);
    }

    /** Reached only by the OnlyOffice Document Server itself, authenticated by its own signed token
     *  (never an EQMS session) -- see {@code OnlyOfficeFormSessionController}. */
    @Transactional(readOnly = true)
    public EformEditSession requireSessionForToken(UUID sessionId, String purpose, String token) {
        onlyOfficeDocumentEditService.verifyFormSessionAccessToken(sessionId, purpose, token);
        return requireSession(sessionId);
    }

    @Transactional
    public void applyCallback(UUID sessionId, String purpose, String token, byte[] fileBytes) {
        onlyOfficeDocumentEditService.verifyFormSessionAccessToken(sessionId, purpose, token);
        EformEditSession session = requireSession(sessionId);
        String fileName = StringUtils.hasText(session.getFileName())
                ? session.getFileName()
                : session.getFormDocument().getDocumentNumber() + ".docx";
        storeIntoSession(session, fileName, fileBytes);
        session.setSaveVersion(session.getSaveVersion() + 1);
        session.setStatus(STATUS_SAVED);
        sessionRepository.save(session);
    }

    @Transactional
    public FormSettingsResponse commitDesign(UUID sessionId, String reason, String signatureToken) {
        UserAccount currentUser = currentUserService.requireCurrentUser();
        requirePermission(currentUser, P_DESIGN, "Not permitted to design eForm fields");
        EformEditSession session = requireSession(sessionId);
        if (!KIND_DESIGN.equals(session.getKind())) {
            throw new IllegalArgumentException("Not a design session");
        }
        requireOwnerOrAdmin(currentUser, session);
        if (!StringUtils.hasText(session.getStorageObjectKey())) {
            throw new IllegalStateException("Nothing has been saved in this design session yet.");
        }
        DocumentRecord document = session.getFormDocument();
        UUID formDocumentId = document.getId();
        DocumentRevisionRecord draft = requireDraftRevision(document);

        electronicSignatureService.createEntitySignature(
                ENTITY_TYPE, session.getId(), session.getFormDocument().getDocumentNumber(), currentUser,
                signatureToken, "FORM_FIELDS_DESIGNED", reason, null, null, "committed");

        // Write-gated by RevisionService itself (Draft-only, not completed-editing) -- enforced at
        // the moment of commit, not just at session-start, so this throws clearly if the Revision
        // moved on (e.g. submitted for review) while this Design session was open.
        revisionService.setFillableTemplate(draft.getId(), session.getFileName(), session.getStorageProvider(), session.getStorageBucket(),
                session.getStorageObjectKey(), session.getStorageVersionId(), session.getChecksum());

        auditTrailService.logAs(currentUser, ENTITY_TYPE, session.getFormDocument().getDocumentNumber(), session.getId(),
                "COMMIT_DESIGN", STATUS_ACTIVE, STATUS_SAVED, "Fillable template fields committed", List.of(), null);

        return formSettingsService.getForDocument(formDocumentId);
    }

    /** Asks the Document Server to flush any unsaved edits of this session right now (Command Service
     *  {@code forcesave}), so "Submit"/"Save & Close" doesn't have to wait for the editor's own
     *  autosave interval. The callback (if anything changed) arrives asynchronously afterwards --
     *  callers should poll {@code getEditConfig}'s caller state or simply retry commit/submit if the
     *  session's status is still not {@code SAVED} yet. */
    @Transactional(readOnly = true)
    public void forceSave(UUID sessionId) {
        UserAccount currentUser = currentUserService.requireCurrentUser();
        EformEditSession session = requireSession(sessionId);
        requireOwnerOrAdmin(currentUser, session);
        onlyOfficeDocumentEditService.sendForceSaveForKey(session.getId() + "-" + session.getSaveVersion());
    }

    @Transactional
    public void abandonSession(UUID sessionId) {
        UserAccount currentUser = currentUserService.requireCurrentUser();
        EformEditSession session = requireSession(sessionId);
        requireOwnerOrAdmin(currentUser, session);
        session.setStatus(STATUS_ABANDONED);
        sessionRepository.save(session);
    }

    // ---- Helpers (package-private where ExecutedRecordService needs the same constants) ------

    private void storeIntoSession(EformEditSession session, String fileName, byte[] bytes) {
        try {
            var stored = fileStorageService.storeEformSessionFile(session.getId(), fileName, new ByteArrayInputStream(bytes));
            session.setFileName(fileName);
            session.setStorageProvider(stored.provider());
            session.setStorageBucket(stored.bucket());
            session.setStorageObjectKey(stored.storedPath());
            session.setStorageVersionId(stored.versionId());
            session.setChecksum(stored.checksum());
        } catch (IOException ex) {
            throw new IllegalStateException("Unable to store this eForm session's file", ex);
        }
    }

    /** Folds a just-signed FILL session's saved file into its {@link EformFillRun} so the next role
     *  (or the final submission) builds on it. */
    private void copyIntoRun(EformFillRun run, EformEditSession session) {
        run.setFileName(session.getFileName());
        run.setStorageProvider(session.getStorageProvider());
        run.setStorageBucket(session.getStorageBucket());
        run.setStorageObjectKey(session.getStorageObjectKey());
        run.setStorageVersionId(session.getStorageVersionId());
        run.setChecksum(session.getChecksum());
    }

    private DocumentRevisionRecord requireEffectiveRevision(DocumentRecord document) {
        return documentRevisionRepository.findFirstByDocument_IdAndStatus_CodeOrderByCreatedAtDesc(document.getId(), "EFFECTIVE")
                .orElseThrow(() -> new IllegalStateException(
                        "This Form has no Effective revision -- eForm sessions can only be started while a revision is Effective."));
    }

    /** Field design happens during Draft, like authoring any other Document content, and locks
     *  permanently once that Revision is Effective (enforced for real at write time by
     *  {@code RevisionService#setFillableTemplate}'s reuse of the exact same Draft-only guard
     *  {@code uploadRevisionFile} uses) -- redesigning after publish requires an upgrade Revision. */
    private DocumentRevisionRecord requireDraftRevision(DocumentRecord document) {
        return documentRevisionRepository.findFirstByDocument_IdAndStatus_CodeOrderByCreatedAtDesc(document.getId(), "DRAFT")
                .orElseThrow(() -> new IllegalStateException(
                        "This Form has no Draft revision -- create an upgrade Revision before redesigning eForm fields."));
    }

    private void requireOwnerOrAdmin(UserAccount user, EformEditSession session) {
        boolean isOwner = session.getStartedBy() != null && session.getStartedBy().getId().equals(user.getId());
        if (!isOwner && !permissionEvaluationService.hasPermission(user, P_ADMIN_OVERRIDE)) {
            throw new AccessDeniedException("You did not start this eForm session");
        }
    }

    private void requirePermission(UserAccount user, String permission, String message) {
        if (!permissionEvaluationService.hasPermission(user, permission)) {
            throw new AccessDeniedException(message);
        }
    }

    private ControlledCopyRecord requireControlledCopy(UUID controlledCopyId) {
        if (controlledCopyId == null) {
            throw new IllegalArgumentException("Controlled Copy not found");
        }
        return controlledCopyRepository.findById(controlledCopyId)
                .orElseThrow(() -> new IllegalArgumentException("Controlled Copy not found"));
    }

    /** "Người nhận copy = người điền form" -- the FILL (data-entry) phase is gated to the copy's
     *  own recipient, not a generic fill permission check. */
    private void requireRecipient(ControlledCopyRecord copy, UserAccount currentUser) {
        if (copy.getRecipientUser() == null || !copy.getRecipientUser().getId().equals(currentUser.getId())) {
            throw new AccessDeniedException("Only this Controlled Copy's recipient may fill this eForm.");
        }
    }

    private void seedFromTemplate(EformEditSession session, DocumentRevisionRecord revision) {
        session.setFileName(revision.getFillableTemplateFileName());
        session.setStorageProvider(revision.getFillableTemplateStorageProvider());
        session.setStorageBucket(revision.getFillableTemplateStorageBucket());
        session.setStorageObjectKey(revision.getFillableTemplateStorageObjectKey());
        session.setStorageVersionId(revision.getFillableTemplateStorageVersionId());
        session.setChecksum(revision.getFillableTemplateChecksum());
    }

    private DocumentRecord requireDocument(UUID documentId) {
        if (documentId == null) {
            throw new IllegalArgumentException("Document not found");
        }
        return documentRecordRepository.findById(documentId)
                .orElseThrow(() -> new IllegalArgumentException("Document not found"));
    }

    private EformEditSession requireSession(UUID sessionId) {
        if (sessionId == null) {
            throw new IllegalArgumentException("eForm session not found");
        }
        return sessionRepository.findById(sessionId)
                .orElseThrow(() -> new IllegalArgumentException("eForm session not found"));
    }
}
