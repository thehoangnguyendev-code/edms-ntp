package com.eqms.controller;

import com.eqms.dto.document.DocumentFiltersResponse;
import com.eqms.dto.document.DocumentDraftCreateRequest;
import com.eqms.dto.document.DocumentActiveWorkflowConfigurationRequest;
import com.eqms.dto.document.DocumentCancelRequest;
import com.eqms.dto.document.DocumentObsoleteRequest;
import com.eqms.dto.document.DocumentDetailResponse;
import com.eqms.dto.document.DocumentListItemResponse;
import com.eqms.dto.audittrail.AuditTrailRecordResponse;
import com.eqms.dto.document.KnowledgeBaseResponse;
import com.eqms.dto.document.KnowledgeBaseDepartmentResponse;
import com.eqms.dto.document.KnowledgeBaseFolderResponse;
import com.eqms.dto.document.DocumentRevisionSummaryResponse;
import com.eqms.dto.document.RevisionCreationRequest;
import com.eqms.dto.document.RevisionDetailResponse;
import com.eqms.dto.document.RevisionUpgradeContinueRequest;
import com.eqms.dto.document.RevisionUpgradeSessionResponse;
import com.eqms.dto.document.SignatureResponse;
import com.eqms.dto.user.PageResponse;
import java.util.UUID;
import jakarta.validation.Valid;
import com.eqms.service.DocumentService;
import com.eqms.service.RevisionService;
import com.eqms.service.RevisionUpgradeSessionService;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@RestController
@RequestMapping("/documents")
public class DocumentController {

    private final DocumentService documentService;
    private final RevisionService revisionService;
    private final RevisionUpgradeSessionService revisionUpgradeSessionService;

    public DocumentController(
            DocumentService documentService,
            RevisionService revisionService,
            RevisionUpgradeSessionService revisionUpgradeSessionService
    ) {
        this.documentService = documentService;
        this.revisionService = revisionService;
        this.revisionUpgradeSessionService = revisionUpgradeSessionService;
    }

    @GetMapping
    public ResponseEntity<PageResponse<DocumentListItemResponse>> listDocuments(
            @RequestParam(required = false, defaultValue = "all") String scope,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String ids,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String documentType,
            @RequestParam(required = false) String businessUnit,
            @RequestParam(required = false) String department,
            @RequestParam(required = false) String authorId,
            @RequestParam(required = false) String author,
            @RequestParam(required = false) String relatedDocument,
            @RequestParam(required = false) String correlatedDocument,
            @RequestParam(required = false) String isTemplate,
            @RequestParam(required = false) String createdFrom,
            @RequestParam(required = false) String createdTo,
            @RequestParam(required = false) String effectiveFrom,
            @RequestParam(required = false) String effectiveTo,
            @RequestParam(required = false) String validFrom,
            @RequestParam(required = false) String validTo,
            @RequestParam(defaultValue = "created") String sortBy,
            @RequestParam(defaultValue = "desc") String sortDirection,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int limit
    ) {
        return ResponseEntity.ok(documentService.listDocuments(
                scope, search, ids, status, documentType, businessUnit, department, authorId, author,
                relatedDocument, correlatedDocument, isTemplate,
                createdFrom, createdTo, effectiveFrom, effectiveTo, validFrom, validTo,
                sortBy, sortDirection, page, limit
        ));
    }

    @GetMapping("/filters")
    public ResponseEntity<DocumentFiltersResponse> getFilters() {
        return ResponseEntity.ok(documentService.getFilters());
    }

    @GetMapping("/knowledge-base")
    public ResponseEntity<KnowledgeBaseResponse> getKnowledgeBase() {
        return ResponseEntity.ok(documentService.getKnowledgeBase());
    }

    @GetMapping("/knowledge-base/departments")
    public ResponseEntity<List<KnowledgeBaseDepartmentResponse>> getKnowledgeBaseDepartments(
            @RequestParam(required = false) String search,
            @RequestParam(required = false, defaultValue = "asc") String sortDirection
    ) {
        return ResponseEntity.ok(documentService.getKnowledgeBaseDepartments(search, sortDirection));
    }

    @GetMapping("/knowledge-base/departments/{departmentId}")
    public ResponseEntity<KnowledgeBaseFolderResponse> getKnowledgeBaseDepartment(
            @PathVariable java.util.UUID departmentId,
            @RequestParam(required = false) String search,
            @RequestParam(required = false, defaultValue = "name") String sortField,
            @RequestParam(required = false, defaultValue = "asc") String sortOrder
    ) {
        return ResponseEntity.ok(documentService.getKnowledgeBaseDepartment(departmentId, search, sortField, sortOrder));
    }

    @GetMapping("/{id}")
    public ResponseEntity<DocumentDetailResponse> getDocumentDetail(@PathVariable java.util.UUID id) {
        return ResponseEntity.ok(documentService.getDocumentDetail(id));
    }

    @GetMapping("/{id}/snapshot")
    public ResponseEntity<DocumentDetailResponse> getDocumentDetailSnapshot(@PathVariable java.util.UUID id) {
        return ResponseEntity.ok(documentService.getDocumentDetailForSnapshot(id));
    }

    @PostMapping("/{id}/upgrade-revision")
    public ResponseEntity<RevisionDetailResponse> upgradeDocumentRevision(@PathVariable java.util.UUID id) {
        return ResponseEntity.ok(revisionService.upgradeDocumentRevision(id));
    }

    @PutMapping("/{id}/active-workflow-configuration")
    public ResponseEntity<DocumentDetailResponse> updateActiveWorkflowConfiguration(
            @PathVariable UUID id,
            @RequestBody DocumentActiveWorkflowConfigurationRequest request
    ) {
        return ResponseEntity.ok(documentService.updateActiveWorkflowConfiguration(id, request));
    }

    @PostMapping("/{id}/upgrade-sessions")
    public ResponseEntity<RevisionUpgradeSessionResponse> createUpgradeSession(@PathVariable UUID id) {
        return ResponseEntity.ok(revisionUpgradeSessionService.createSession(id));
    }

    @GetMapping("/{id}/upgrade-sessions/{sessionId}")
    public ResponseEntity<RevisionUpgradeSessionResponse> getUpgradeSession(
            @PathVariable UUID id,
            @PathVariable UUID sessionId
    ) {
        return ResponseEntity.ok(revisionUpgradeSessionService.getSession(id, sessionId));
    }

    @PostMapping("/{id}/upgrade-sessions/{sessionId}/continue")
    public ResponseEntity<RevisionUpgradeSessionResponse> continueUpgradeSession(
            @PathVariable UUID id,
            @PathVariable UUID sessionId,
            @RequestBody(required = false) RevisionUpgradeContinueRequest request
    ) {
        return ResponseEntity.ok(revisionUpgradeSessionService.continueSession(id, sessionId, request));
    }

    @GetMapping("/{id}/revisions")
    public ResponseEntity<List<DocumentRevisionSummaryResponse>> getDocumentRevisions(@PathVariable java.util.UUID id) {
        return ResponseEntity.ok(documentService.getDocumentRevisions(id));
    }

    /** Paged, searchable, sortable revision list of one document (search, sort and paging are done by the server). */
    @GetMapping("/{id}/revisions/page")
    public ResponseEntity<PageResponse<DocumentRevisionSummaryResponse>> getDocumentRevisionsPage(
            @PathVariable java.util.UUID id,
            @RequestParam(required = false) String search,
            @RequestParam(required = false, defaultValue = "revisionNumber") String sortBy,
            @RequestParam(required = false, defaultValue = "desc") String sortDirection,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int limit
    ) {
        return ResponseEntity.ok(documentService.getDocumentRevisionsPage(id, search, sortBy, sortDirection, page, limit));
    }

    /** Paged, searchable, sortable page of the Related / Correlated documents the caller has selected (ids in the body). */
    @PostMapping("/relations/page")
    public ResponseEntity<PageResponse<com.eqms.dto.document.DocumentRelationResponse>> getDocumentRelationsPage(
            @RequestBody com.eqms.dto.document.DocumentRelationPageRequest request
    ) {
        return ResponseEntity.ok(documentService.getDocumentRelationsPage(request));
    }

    @GetMapping("/templates")
    public ResponseEntity<List<DocumentListItemResponse>> listSelectableTemplates(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String documentType,
            @RequestParam(required = false) String subType,
            @RequestParam(required = false, defaultValue = "created") String sortBy,
            @RequestParam(required = false, defaultValue = "desc") String sortDirection,
            @RequestParam(required = false, defaultValue = "50") int limit
    ) {
        return ResponseEntity.ok(documentService.listSelectableTemplates(
                search,
                documentType,
                subType,
                sortBy,
                sortDirection,
                limit
        ));
    }

    @GetMapping("/{id}/audit-trail")
    public ResponseEntity<List<AuditTrailRecordResponse>> getDocumentAuditTrail(@PathVariable java.util.UUID id) {
        return ResponseEntity.ok(documentService.getDocumentAuditTrail(id));
    }

    @GetMapping("/{id}/signatures")
    public ResponseEntity<List<SignatureResponse>> getDocumentSignatures(@PathVariable java.util.UUID id) {
        return ResponseEntity.ok(documentService.getDocumentSignatures(id));
    }

    @PostMapping("/{id}/revisions")
    public ResponseEntity<RevisionDetailResponse> createRevisionFromDocument(
            @PathVariable java.util.UUID id,
            @RequestBody(required = false) RevisionCreationRequest request
    ) {
        return ResponseEntity.ok(revisionService.createRevisionFromDocument(id, request));
    }

    @PostMapping(value = "/{id}/revisions/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<RevisionDetailResponse> createRevisionFromDocumentAndUpload(
            @PathVariable java.util.UUID id,
            @RequestPart(value = "file", required = false) MultipartFile file,
            @RequestPart(value = "changeDescription", required = false) String changeDescription,
            @RequestPart(value = "templateRevisionId", required = false) String templateRevisionId
    ) {
        return ResponseEntity.ok(revisionService.createRevisionAndUploadFile(
                id,
                file,
                new RevisionCreationRequest(changeDescription, templateRevisionId)
        ));
    }

    @GetMapping("/legacy-import/check-document-number")
    public ResponseEntity<java.util.Map<String, Boolean>> checkLegacyDocumentNumberAvailable(
            @RequestParam("documentNumber") String documentNumber
    ) {
        return ResponseEntity.ok(java.util.Map.of("available", documentService.isLegacyDocumentNumberAvailable(documentNumber)));
    }

    /**
     * Legacy Import: creates a document's entire revision chain (e.g. just 1.0, or 1.0 -> 4.0) in
     * one atomic transaction -- a single revision is simply a batch of one, so there is no separate
     * single-revision endpoint. "revisions" is a JSON array (see LegacyBatchRevisionSectionRequest);
     * "files" is the parallel list of source files for sections whose hasFile=true, in the same
     * relative order as those sections.
     */
    @PostMapping(value = "/{id}/revisions/legacy-import", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<com.eqms.dto.document.LegacyBatchImportResponse> createLegacyImportRevisionsBatch(
            @PathVariable java.util.UUID id,
            @RequestPart(value = "revisions") String revisionsJson,
            @RequestPart(value = "files", required = false) java.util.List<MultipartFile> files,
            @RequestPart(value = "legacyJustification") String legacyJustification,
            @RequestPart(value = "signatureToken", required = false) String signatureToken
    ) {
        return ResponseEntity.ok(revisionService.createLegacyImportRevisionsBatch(
                id, revisionsJson, files, legacyJustification, signatureToken
        ));
    }

    /**
     * Legacy Import: creates the Draft document AND its revision batch (above) in one request, so
     * both happen inside one physical transaction -- a batch failure (bad file, validation error)
     * rolls back the document insert too, instead of leaving an orphaned Draft that permanently
     * holds the legacy document number and blocks every retry. Prefer this over calling POST
     * /documents then POST /{id}/revisions/legacy-import separately.
     */
    @PostMapping(value = "/legacy-import", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<com.eqms.dto.document.LegacyBatchImportResponse> createLegacyImportDocumentAndRevisions(
            @RequestPart(value = "document") String documentJson,
            @RequestPart(value = "revisions") String revisionsJson,
            @RequestPart(value = "files", required = false) java.util.List<MultipartFile> files,
            @RequestPart(value = "legacyJustification") String legacyJustification,
            @RequestPart(value = "signatureToken", required = false) String signatureToken
    ) {
        return ResponseEntity.ok(documentService.createLegacyImportDocumentAndRevisions(
                documentJson, revisionsJson, files, legacyJustification, signatureToken
        ));
    }

    @PostMapping
    public ResponseEntity<DocumentListItemResponse> createDraft(@Valid @RequestBody DocumentDraftCreateRequest request) {
        return ResponseEntity.ok(documentService.createDocumentDraft(request));
    }

    @PutMapping("/{id}")
    public ResponseEntity<DocumentListItemResponse> updateDraft(
            @PathVariable java.util.UUID id,
            @Valid @RequestBody DocumentDraftCreateRequest request
    ) {
        return ResponseEntity.ok(documentService.updateDocumentDraft(id, request));
    }

    @PostMapping("/{id}/cancel")
    public ResponseEntity<DocumentDetailResponse> cancelDocument(
            @PathVariable java.util.UUID id,
            @Valid @RequestBody DocumentCancelRequest request
    ) {
        return ResponseEntity.ok(documentService.cancelDocument(id, request));
    }

    @PostMapping("/cancel/{id}")
    public ResponseEntity<DocumentDetailResponse> cancelDocumentCompat(
            @PathVariable java.util.UUID id,
            @Valid @RequestBody DocumentCancelRequest request
    ) {
        return ResponseEntity.ok(documentService.cancelDocument(id, request));
    }

    @PostMapping("/{id}/obsolete")
    public ResponseEntity<DocumentDetailResponse> obsoleteDocument(
            @PathVariable UUID id,
            @Valid @RequestBody DocumentObsoleteRequest request
    ) {
        return ResponseEntity.ok(documentService.obsoleteDocument(id, request));
    }

    @GetMapping("/export")
    public ResponseEntity<StreamingResponseBody> exportDocuments(
            @RequestParam(required = false, defaultValue = "all") String scope,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String ids,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String documentType,
            @RequestParam(required = false) String businessUnit,
            @RequestParam(required = false) String department,
            @RequestParam(required = false) String authorId,
            @RequestParam(required = false) String author,
            @RequestParam(required = false) String relatedDocument,
            @RequestParam(required = false) String correlatedDocument,
            @RequestParam(required = false) String isTemplate,
            @RequestParam(required = false) String createdFrom,
            @RequestParam(required = false) String createdTo,
            @RequestParam(required = false) String effectiveFrom,
            @RequestParam(required = false) String effectiveTo,
            @RequestParam(required = false) String validFrom,
            @RequestParam(required = false) String validTo,
            @RequestParam(defaultValue = "created") String sortBy,
            @RequestParam(defaultValue = "desc") String sortDirection
    ) {
        StreamingResponseBody csv = outputStream -> documentService.writeDocumentsExport(
                scope, search, ids, status, documentType, businessUnit, department, authorId, author,
                relatedDocument, correlatedDocument, isTemplate,
                createdFrom, createdTo, effectiveFrom, effectiveTo, validFrom, validTo,
                sortBy, sortDirection, outputStream
        );

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=documents-export.csv")
                .contentType(MediaType.parseMediaType("text/csv"))
                .body(csv);
    }

    @GetMapping("/{id}/preview")
    public ResponseEntity<byte[]> previewDocument(@PathVariable UUID id) {
        DocumentService.DocumentFileResult result = documentService.previewDocumentFile(id);
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(result.contentType()))
                .body(result.bytes());
    }

}
