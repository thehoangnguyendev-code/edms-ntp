package com.eqms.controller;

import com.eqms.dto.dictionary.DocumentComponentRequest;
import com.eqms.dto.dictionary.DocumentComponentResponse;
import com.eqms.dto.dictionary.DocumentNameFormatRequest;
import com.eqms.dto.dictionary.DocumentNameFormatResponse;
import com.eqms.dto.user.PageResponse;
import com.eqms.service.DocumentNameFormatService;
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
 * Document Name Formats + Document Components administration — same "Document Administration"
 * area as {@link DocumentTypeAdminController}, gated by its own documents.admin.name_formats.*
 * permission pair. Phase 1 only (catalog management; not yet wired into live document-number
 * generation).
 */
@RestController
@RequestMapping("/documents/administration")
public class DocumentNameFormatController {

    private final DocumentNameFormatService service;

    public DocumentNameFormatController(DocumentNameFormatService service) {
        this.service = service;
    }

    // ── Document Name Formats ───────────────────────────────────────────────

    @GetMapping("/document-name-formats")
    public ResponseEntity<List<DocumentNameFormatResponse>> listFormats() {
        return ResponseEntity.ok(service.listFormats());
    }

    @GetMapping("/document-name-formats/page")
    public ResponseEntity<PageResponse<DocumentNameFormatResponse>> listFormatsPage(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int limit,
            @RequestParam(defaultValue = "name") String sortBy,
            @RequestParam(defaultValue = "asc") String sortDirection
    ) {
        return ResponseEntity.ok(service.listFormatsPage(search, status, page, limit, sortBy, sortDirection));
    }

    @GetMapping("/document-name-formats/{id}")
    public ResponseEntity<DocumentNameFormatResponse> getFormat(@PathVariable UUID id) {
        return ResponseEntity.ok(service.getFormat(id));
    }

    @PostMapping("/document-name-formats")
    public ResponseEntity<DocumentNameFormatResponse> createFormat(@Valid @RequestBody DocumentNameFormatRequest request) {
        return ResponseEntity.ok(service.createFormat(request));
    }

    @PutMapping("/document-name-formats/{id}")
    public ResponseEntity<DocumentNameFormatResponse> updateFormat(@PathVariable UUID id, @Valid @RequestBody DocumentNameFormatRequest request) {
        return ResponseEntity.ok(service.updateFormat(id, request));
    }

    // No DELETE -- same GMP data-integrity reasoning as Document Type: deactivate instead.

    // ── Document Components ─────────────────────────────────────────────────

    @GetMapping("/document-components")
    public ResponseEntity<List<DocumentComponentResponse>> listComponents() {
        return ResponseEntity.ok(service.listComponents());
    }

    @GetMapping("/document-components/page")
    public ResponseEntity<PageResponse<DocumentComponentResponse>> listComponentsPage(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int limit,
            @RequestParam(defaultValue = "displayOrder") String sortBy,
            @RequestParam(defaultValue = "asc") String sortDirection
    ) {
        return ResponseEntity.ok(service.listComponentsPage(search, status, page, limit, sortBy, sortDirection));
    }

    @PostMapping("/document-components")
    public ResponseEntity<DocumentComponentResponse> createComponent(@Valid @RequestBody DocumentComponentRequest request) {
        return ResponseEntity.ok(service.createComponent(request));
    }

    @PutMapping("/document-components/{id}")
    public ResponseEntity<DocumentComponentResponse> updateComponent(@PathVariable UUID id, @Valid @RequestBody DocumentComponentRequest request) {
        return ResponseEntity.ok(service.updateComponent(id, request));
    }
}
