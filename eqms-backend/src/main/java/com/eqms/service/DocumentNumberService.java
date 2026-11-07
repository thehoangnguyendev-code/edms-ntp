package com.eqms.service;

import com.eqms.auth.CurrentUserService;
import com.eqms.dto.audittrail.AuditTrailChangeResponse;
import com.eqms.entity.DocumentRecord;
import com.eqms.entity.DocumentType;
import com.eqms.entity.UserAccount;
import com.eqms.repository.DocumentRecordRepository;
import com.eqms.repository.DocumentTypeRepository;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Manual Document Numbers (Document Properties > Numbering > Document Number entry = MANUAL). One place holds the rule a typed number
 * must follow (the Document Type's short code, ".", and exactly "Digits of the Serial Number" digits: the shape of every number the
 * generator issues), the duplicate check, and the change of a number that has not yet reached a stored file.
 */
@Service
public class DocumentNumberService {
    /** A typed serial more than this far past the next one the generator would issue is shown as a warning (never a refusal). */
    static final int FAR_AHEAD = 10;

    public record Check(boolean valid, String code, String message, String number, String expectedFormat,
                        String suggestedNext, boolean farFromNext, String usedBy) {}

    public record State(boolean manual, boolean editable, String reasonCode, String message) {}

    private final SystemConfigurationService configuration;
    private final DocumentRecordRepository documents;
    private final DocumentTypeRepository documentTypes;
    private final DocumentAuthorizationService authorization;
    private final CurrentUserService currentUsers;
    private final AuditTrailService audit;
    private final JdbcTemplate jdbc;
    private final PermissionEvaluationService permissions;

    public DocumentNumberService(SystemConfigurationService configuration, DocumentRecordRepository documents,
                                 DocumentTypeRepository documentTypes, DocumentAuthorizationService authorization,
                                 CurrentUserService currentUsers, AuditTrailService audit, JdbcTemplate jdbc,
                                 PermissionEvaluationService permissions) {
        this.configuration = configuration;
        this.documents = documents;
        this.documentTypes = documentTypes;
        this.authorization = authorization;
        this.currentUsers = currentUsers;
        this.audit = audit;
        this.jdbc = jdbc;
        this.permissions = permissions;
    }

    public boolean isManual() {
        return "MANUAL".equals(configuration.getDocumentNumberEntryMode());
    }

    public static String normalize(String typed) {
        return typed == null ? "" : typed.trim().toUpperCase(Locale.ROOT);
    }

    private static String typeCode(DocumentType type) {
        return type != null && StringUtils.hasText(type.getShortCode()) ? type.getShortCode().trim().toUpperCase(Locale.ROOT) : "DOC";
    }

    /** The answer for the number being typed: format, then duplicate, then the (soft) distance from the next number. */
    @Transactional(readOnly = true)
    public Check check(UUID documentTypeId, String typed, UUID excludeDocumentId) {
        UserAccount user = currentUsers.requireCurrentUser();
        authorization.requireCanCreateDocument(user);
        DocumentType type = documentTypeId == null ? null : documentTypes.findById(documentTypeId).orElse(null);
        return evaluate(type, typed, excludeDocumentId);
    }

    Check evaluate(DocumentType type, String typed, UUID excludeDocumentId) {
        String number = normalize(typed);
        String code = typeCode(type);
        int digits = Math.max(configuration.getSerialNumberDigits(), 1);
        String expected = code + "." + "N".repeat(digits);
        String next = suggestNext(type);
        if (type == null) {
            return new Check(false, "DOCUMENT_TYPE_REQUIRED", "Choose the Document Type first: its code is the start of the number.",
                    number, expected, null, false, null);
        }
        if (number.isEmpty()) {
            return new Check(false, "DOCUMENT_NUMBER_REQUIRED", "Enter the Document Number.", number, expected, next, false, null);
        }
        if (!number.startsWith(code + ".")) {
            return new Check(false, "DOCUMENT_NUMBER_PREFIX", "The number must start with \"" + code + ".\" for this Document Type.",
                    number, expected, next, false, null);
        }
        String serial = number.substring(code.length() + 1);
        if (!serial.matches("\\d{" + digits + "}")) {
            return new Check(false, "DOCUMENT_NUMBER_DIGITS", "The number must have exactly " + digits + " digit(s) after \"" + code
                    + ".\" (Document Properties > Digits of the Serial Number), for example " + code + "." + String.format("%0" + digits + "d", 1) + ".",
                    number, expected, next, false, null);
        }
        Optional<DocumentRecord> used = documents.findFirstByDocumentNumberIgnoreCase(number);
        if (used.isPresent() && !used.get().getId().equals(excludeDocumentId)) {
            DocumentRecord other = used.get();
            String status = other.getStatus() == null ? "-" : other.getStatus().getLabel();
            String usedBy = other.getDocumentNumber() + (StringUtils.hasText(other.getDocumentName()) ? " - " + other.getDocumentName() : "")
                    + " (" + status + ")";
            return new Check(false, "DOCUMENT_NUMBER_IN_USE", "This number is already used by " + usedBy + ". Choose another number.",
                    number, expected, next, false, usedBy);
        }
        boolean far = false;
        Matcher nextSerial = Pattern.compile("(\\d+)$").matcher(next == null ? "" : next);
        if (nextSerial.find()) {
            far = Long.parseLong(serial) > Long.parseLong(nextSerial.group(1)) + FAR_AHEAD;
        }
        return new Check(true, far ? "DOCUMENT_NUMBER_FAR_AHEAD" : "OK",
                far ? "This number is far ahead of the next one (" + next + "). Check that it is the number you mean." : null,
                number, expected, next, far, null);
    }

    /** The number the generator would issue next for the type (nothing is allocated). */
    String suggestNext(DocumentType type) {
        if (type == null) {
            return null;
        }
        String code = typeCode(type);
        int digits = Math.max(configuration.getSerialNumberDigits(), 1);
        int issued = documents.findMaxDocumentSequenceByPrefix(code);
        int next = Math.max(Math.max(type.getCurrentSequence(), 0), issued) + 1;
        String serial = String.format("%0" + digits + "d", next);
        // Numbers already issued at a wider width can push the next serial past the configured digits: it would not be a valid number, so it is not suggested.
        return serial.length() > digits ? null : code + "." + serial;
    }

    /** Used by the draft save: returns the normalized number, or refuses with the same message the screen showed. */
    public String requireValid(DocumentType type, String typed, UUID excludeDocumentId) {
        Check result = evaluate(type, typed, excludeDocumentId);
        if (!result.valid()) {
            throw new IllegalArgumentException(result.message());
        }
        return result.number();
    }

    /** Whether the number of this document may still be changed, and why not. */
    @Transactional(readOnly = true)
    public State state(UUID documentId) {
        UserAccount user = currentUsers.requireCurrentUser();
        DocumentRecord document = documents.findById(documentId).orElseThrow(() -> new IllegalArgumentException("Document not found"));
        return stateOf(user, document);
    }

    private State stateOf(UserAccount user, DocumentRecord document) {
        if (!isManual()) {
            return new State(false, false, "DOCUMENT_NUMBER_MANUAL_OFF", "Document numbers are generated by the system.");
        }
        if (document.getStatus() == null || !"DRAFT".equalsIgnoreCase(document.getStatus().getCode())) {
            return new State(true, false, "DOCUMENT_NOT_DRAFT", "The number can only be changed while the Document is a Draft.");
        }
        if (documents.hasStoredSourceFile(document.getId())) {
            return new State(true, false, "DOCUMENT_NUMBER_LOCKED_BY_FILE",
                    "A source file is already stored under this number, so it can no longer be changed.");
        }
        boolean allowed = authorization.canEditInitialDocumentDraft(user, document)
                || (authorization.canUploadRevision(user, document) && permissions.hasPermission(user, "documents.document.edit_metadata"));
        if (!allowed) {
            return new State(true, false, "DOCUMENT_NUMBER_NOT_ALLOWED", "You are not allowed to change the number of this Document.");
        }
        return new State(true, true, null, null);
    }

    /** Changes the number of a Draft Document that has no stored file yet; the reason is recorded in the Audit Trail. */
    @Transactional
    public DocumentRecord change(UUID documentId, String typed, String reason) {
        UserAccount user = currentUsers.requireCurrentUser();
        DocumentRecord document = documents.findById(documentId).orElseThrow(() -> new IllegalArgumentException("Document not found"));
        State state = stateOf(user, document);
        if (!state.editable()) {
            if ("DOCUMENT_NUMBER_NOT_ALLOWED".equals(state.reasonCode())) {
                throw new AccessDeniedException(state.message());
            }
            throw new IllegalStateException(state.reasonCode() + ": " + state.message());
        }
        if (!StringUtils.hasText(reason)) {
            throw new IllegalArgumentException("A reason is required to change the Document Number.");
        }
        String number = requireValid(document.getDocumentType(), typed, document.getId());
        String old = document.getDocumentNumber();
        if (number.equals(old)) {
            return document;
        }
        document.setDocumentNumber(number);
        documents.saveAndFlush(document);
        // Copies of the number held by records of this Document that exist before any file does.
        jdbc.update("update document_revisions set document_number = ? where document_id = ?", number, document.getId());
        jdbc.update("update revision_workspace_items set document_number = ? where document_id = ? or source_document_id = ?", number, document.getId(), document.getId());
        jdbc.update("update training_activities set document_number = ? where document_id = ?", number, document.getId());
        audit.logAs(user, "DOCUMENT", number + (StringUtils.hasText(document.getDocumentName()) ? " - " + document.getDocumentName() : ""),
                document.getId(), "DOCUMENT_NUMBER_CHANGED", "DRAFT", "DRAFT",
                "Document Number changed by hand. Reason: " + reason.trim(),
                List.of(new AuditTrailChangeResponse("Document Number", old, number)));
        return document;
    }
}
