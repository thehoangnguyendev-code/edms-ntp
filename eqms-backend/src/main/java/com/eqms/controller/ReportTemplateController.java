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
                                 @RequestParam(defaultValue="") String format,@RequestParam(defaultValue="") String orientation) {
        return ResponseEntity.ok(templates.catalog(users.requireCurrentUser(), search, page, sortBy, direction,java.util.Map.of("status",status,"sourceCode",sourceCode,"format",format,"orientation",orientation)));
    }
    @GetMapping("/sources") public ResponseEntity<?> sources() { return ResponseEntity.ok(templates.sources(users.requireCurrentUser())); }
    @GetMapping("/configuration") public ResponseEntity<?> configuration(@RequestParam(defaultValue="") String search, @RequestParam(defaultValue="1") int page,
            @RequestParam(defaultValue="displayName") String sortBy, @RequestParam(defaultValue="asc") String direction,
            @RequestParam(defaultValue="") String status,@RequestParam(defaultValue="") String sourceCode,
            @RequestParam(defaultValue="") String format,@RequestParam(defaultValue="") String orientation) {
        return ResponseEntity.ok(templates.adminCatalog(users.requireCurrentUser(), search, page, sortBy, direction,java.util.Map.of("status",status,"sourceCode",sourceCode,"format",format,"orientation",orientation)));
    }
    @GetMapping("/{code}/options/{field}") public ResponseEntity<?> options(@PathVariable String code, @PathVariable String field, @RequestParam(defaultValue="") String search) {
        return ResponseEntity.ok(templates.options(users.requireCurrentUser(),code,field,search));
    }
    @GetMapping("/roles") public ResponseEntity<?> roles() { return ResponseEntity.ok(templates.roles(users.requireCurrentUser())); }
    @GetMapping("/{code}/configuration") public ResponseEntity<?> detail(@PathVariable String code) { return ResponseEntity.ok(templates.adminDetail(users.requireCurrentUser(), code)); }
    @PostMapping("/{code}") public ResponseEntity<?> create(@PathVariable String code, @RequestBody ReportTemplateService.TemplateWrite request) {
        return ResponseEntity.status(201).body(templates.save(users.requireCurrentUser(), code, request, true));
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
