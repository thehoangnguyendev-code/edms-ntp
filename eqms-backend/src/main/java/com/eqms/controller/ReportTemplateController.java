package com.eqms.controller;

import com.eqms.auth.CurrentUserService;
import com.eqms.service.report.ReportTemplateService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/reports/templates")
public class ReportTemplateController {
    private final ReportTemplateService templates;
    private final CurrentUserService users;
    public ReportTemplateController(ReportTemplateService templates, CurrentUserService users) { this.templates = templates; this.users = users; }

    @GetMapping
    public ResponseEntity<?> list(@RequestParam(defaultValue="") String search, @RequestParam(defaultValue="1") int page,
                                 @RequestParam(defaultValue="displayName") String sortBy, @RequestParam(defaultValue="asc") String direction,
                                 @RequestParam(defaultValue="") String status,@RequestParam(defaultValue="") String sourceCode,
                                 @RequestParam(defaultValue="") String format,@RequestParam(defaultValue="") String orientation,@RequestParam(defaultValue="10") String limit) {
        return ResponseEntity.ok(templates.catalog(users.requireCurrentUser(), search, page, sortBy, direction,java.util.Map.of("status",status,"sourceCode",sourceCode,"format",format,"orientation",orientation,"limit",limit)));
    }
    @GetMapping("/sources") public ResponseEntity<?> sources() { return ResponseEntity.ok(templates.sources(users.requireCurrentUser())); }
    @GetMapping("/configuration") public ResponseEntity<?> configuration(@RequestParam(defaultValue="") String search, @RequestParam(defaultValue="1") int page,
            @RequestParam(defaultValue="displayName") String sortBy, @RequestParam(defaultValue="asc") String direction,
            @RequestParam(defaultValue="") String status,@RequestParam(defaultValue="") String sourceCode,
            @RequestParam(defaultValue="") String format,@RequestParam(defaultValue="") String orientation,@RequestParam(defaultValue="10") String limit) {
        return ResponseEntity.ok(templates.adminCatalog(users.requireCurrentUser(), search, page, sortBy, direction,java.util.Map.of("status",status,"sourceCode",sourceCode,"format",format,"orientation",orientation,"limit",limit)));
    }
    @GetMapping("/{code}/options/{field}") public ResponseEntity<?> options(@PathVariable String code, @PathVariable String field, @RequestParam(defaultValue="") String search) {
        return ResponseEntity.ok(templates.options(users.requireCurrentUser(),code,field,search));
    }
    @PostMapping("/roles/search") public ResponseEntity<?> searchRoles(@RequestBody ReportTemplateService.RoleSearch request) {
        return ResponseEntity.ok(templates.searchRoles(users.requireCurrentUser(), request));
    }
    @GetMapping("/roles") public ResponseEntity<?> roles() { return ResponseEntity.ok(templates.roles(users.requireCurrentUser())); }
    public record UpgradeRequest(Integer version, String reason) {}
    public record EnabledRequest(String reason) {}
    @PostMapping("/{code}/disable") public ResponseEntity<?> disable(@PathVariable String code, @RequestBody EnabledRequest request) {
        return ResponseEntity.ok(templates.setEnabled(users.requireCurrentUser(), code, false, request == null ? null : request.reason()));
    }
    @PostMapping("/{code}/enable") public ResponseEntity<?> enable(@PathVariable String code, @RequestBody EnabledRequest request) {
        return ResponseEntity.ok(templates.setEnabled(users.requireCurrentUser(), code, true, request == null ? null : request.reason()));
    }
    @PostMapping("/{code}/discard-revision") public ResponseEntity<?> discardRevision(@PathVariable String code, @RequestBody UpgradeRequest request) {
        return ResponseEntity.ok(templates.discardRevision(users.requireCurrentUser(), code, request.version(), request.reason()));
    }
    @PostMapping("/{code}/upgrade") public ResponseEntity<?> upgrade(@PathVariable String code, @RequestBody UpgradeRequest request) {
        return ResponseEntity.ok(templates.upgrade(users.requireCurrentUser(), code, request.version(), request.reason()));
    }
    @GetMapping("/{code}/revisions") public ResponseEntity<?> revisions(@PathVariable String code, @RequestParam(defaultValue="ALL") String status, @RequestParam(defaultValue="") String search,
                                                                    @RequestParam(defaultValue="revision") String sortBy, @RequestParam(defaultValue="desc") String sortDirection,
                                                                    @RequestParam(defaultValue="1") int page, @RequestParam(defaultValue="10") int limit) {
        return ResponseEntity.ok(templates.revisionList(users.requireCurrentUser(), code, status, search, sortBy, sortDirection, page, limit));
    }
    @GetMapping("/{code}/revisions/{revision}") public ResponseEntity<?> revision(@PathVariable String code, @PathVariable int revision) {
        return ResponseEntity.ok(templates.revisionDetail(users.requireCurrentUser(), code, revision));
    }
    @GetMapping("/{code}/revisions/{revision}/compare") public ResponseEntity<?> compareRevision(@PathVariable String code, @PathVariable int revision, @RequestParam(defaultValue="previous") String with) {
        return ResponseEntity.ok(templates.revisionCompare(users.requireCurrentUser(), code, revision, with));
    }
    @GetMapping("/{code}/configuration") public ResponseEntity<?> detail(@PathVariable String code) { return ResponseEntity.ok(templates.adminDetail(users.requireCurrentUser(), code)); }
    /** Approval flow of a template version (REPORT-TEMPLATE-APPROVAL-2026-10-14): submit, then approve (signed) or reject. */
    public record SubmitRequest(Integer version, String note) {}
    public record DecisionRequest(Integer version, String reason, String signatureToken) {}
    public record RejectRequest(Integer version, String reason, String signatureToken) {}
    @PostMapping("/{code}/submit") public ResponseEntity<?> submit(@PathVariable String code, @RequestBody SubmitRequest request) {
        return ResponseEntity.ok(templates.submitForApproval(users.requireCurrentUser(), code, request.version(), request.note()));
    }
    @PostMapping("/{code}/approve") public ResponseEntity<?> approve(@PathVariable String code, @RequestBody DecisionRequest request) {
        return ResponseEntity.ok(templates.approve(users.requireCurrentUser(), code, request.version(), request.reason(), request.signatureToken()));
    }
    @PostMapping("/{code}/reject") public ResponseEntity<?> reject(@PathVariable String code, @RequestBody RejectRequest request) {
        return ResponseEntity.ok(templates.reject(users.requireCurrentUser(), code, request.version(), request.reason(), request.signatureToken()));
    }
    @PostMapping public ResponseEntity<?> create(@RequestBody ReportTemplateService.TemplateWrite request) {
        return ResponseEntity.status(201).body(templates.create(users.requireCurrentUser(), request));
    }
    @PutMapping("/{code}") public ResponseEntity<?> update(@PathVariable String code, @RequestBody ReportTemplateService.TemplateWrite request) {
        return ResponseEntity.ok(templates.save(users.requireCurrentUser(), code, request, false));
    }
    @PostMapping("/{code}/preview") public ResponseEntity<?> preview(@PathVariable String code,
            @RequestParam(defaultValue="1") int page, @RequestBody ReportTemplateService.Criteria request) {
        return ResponseEntity.ok(templates.preview(users.requireCurrentUser(), code, request, page));
    }
    @DeleteMapping("/{code}") public ResponseEntity<?> delete(@PathVariable String code,@RequestBody DeleteTemplate request) {
        templates.delete(users.requireCurrentUser(),code,request.version(),request.reason());
        return ResponseEntity.noContent().build();
    }
    public record DeleteTemplate(Integer version,String reason) {}
    @PostMapping("/{code}/preview-pdf") public ResponseEntity<byte[]> previewPdf(@PathVariable String code,@RequestBody PdfPreview request) throws Exception {
        return ResponseEntity.ok().contentType(org.springframework.http.MediaType.APPLICATION_PDF).cacheControl(org.springframework.http.CacheControl.noStore())
            .body(templates.previewPdf(users.requireCurrentUser(),code,request.criteria(),request.title()));
    }
    public record PdfPreview(ReportTemplateService.Criteria criteria,String title) {}
}
