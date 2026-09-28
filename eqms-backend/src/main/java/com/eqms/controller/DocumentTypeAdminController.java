package com.eqms.controller;

import com.eqms.dto.dictionary.DocumentSubTypeDictionaryRequest;
import com.eqms.dto.dictionary.DocumentSubTypeDictionaryResponse;
import com.eqms.dto.dictionary.DocumentTypeDictionaryRequest;
import com.eqms.dto.dictionary.DocumentTypeDictionaryResponse;
import com.eqms.dto.user.PageResponse;
import com.eqms.service.DocumentTypeAdminService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

/**
 * Document Types and Sub-Types administration — part of the Document Control module's
 * "Document Administration" area. The paged/create/update endpoints are gated by the
 * documents.admin.document_types.* permission pair in {@link DocumentTypeAdminService}; the
 * unpaginated list endpoints stay open because ordinary document-creation dropdowns read them.
 */
@RestController
@RequestMapping("/documents/administration")
public class DocumentTypeAdminController {

    private final DocumentTypeAdminService service;

    public DocumentTypeAdminController(DocumentTypeAdminService service) {
        this.service = service;
    }

    // ── Document Types ───────────────────────────────────────────────────────

    @GetMapping("/document-types")
    public ResponseEntity<List<DocumentTypeDictionaryResponse>> listDocumentTypes() {
        return ResponseEntity.ok(service.listDocumentTypes());
    }

    @GetMapping("/document-types/page")
    public ResponseEntity<PageResponse<DocumentTypeDictionaryResponse>> listDocumentTypesPage(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String modifiedFrom,
            @RequestParam(required = false) String modifiedTo,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int limit,
            @RequestParam(defaultValue = "name") String sortBy,
            @RequestParam(defaultValue = "asc") String sortDirection
    ) {
        return ResponseEntity.ok(service.listDocumentTypesPage(search, status, modifiedFrom, modifiedTo, page, limit, sortBy, sortDirection));
    }

    @PostMapping("/document-types")
    public ResponseEntity<DocumentTypeDictionaryResponse> createDocumentType(@Valid @RequestBody DocumentTypeDictionaryRequest request) {
        return ResponseEntity.ok(service.createDocumentType(request));
    }

    @PutMapping("/document-types/{id}")
    public ResponseEntity<DocumentTypeDictionaryResponse> updateDocumentType(@PathVariable UUID id, @Valid @RequestBody DocumentTypeDictionaryRequest request) {
        return ResponseEntity.ok(service.updateDocumentType(id, request));
    }

    // Document Types are never deleted — GMP data integrity requires historical references to
    // remain resolvable. Use the active/inactive status instead.

    // ── Document Sub-Types ───────────────────────────────────────────────────

    @GetMapping("/document-sub-types")
    public ResponseEntity<List<DocumentSubTypeDictionaryResponse>> listDocumentSubTypes() {
        return ResponseEntity.ok(service.listDocumentSubTypes());
    }

    @GetMapping("/document-sub-types/page")
    public ResponseEntity<PageResponse<DocumentSubTypeDictionaryResponse>> listDocumentSubTypesPage(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String documentType,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String reviewRequirement,
            @RequestParam(required = false) String modifiedFrom,
            @RequestParam(required = false) String modifiedTo,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int limit,
            @RequestParam(defaultValue = "name") String sortBy,
            @RequestParam(defaultValue = "asc") String sortDirection
    ) {
        return ResponseEntity.ok(service.listDocumentSubTypesPage(search, documentType, status, reviewRequirement, modifiedFrom, modifiedTo, page, limit, sortBy, sortDirection));
    }

    @PostMapping("/document-sub-types")
    public ResponseEntity<DocumentSubTypeDictionaryResponse> createDocumentSubType(@Valid @RequestBody DocumentSubTypeDictionaryRequest request) {
        return ResponseEntity.ok(service.createDocumentSubType(request));
    }

    @PutMapping("/document-sub-types/{id}")
    public ResponseEntity<DocumentSubTypeDictionaryResponse> updateDocumentSubType(@PathVariable UUID id, @Valid @RequestBody DocumentSubTypeDictionaryRequest request) {
        return ResponseEntity.ok(service.updateDocumentSubType(id, request));
    }

    // Sub-Types are never deleted — see the note on Document Types above.
}
