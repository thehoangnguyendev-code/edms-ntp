package com.eqms.controller;

import com.eqms.auth.CurrentUserService;
import com.eqms.service.report.ReportPreviewFileService;
import com.eqms.service.report.ReportTemplateService;
import java.util.UUID;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/** The working copy shown at the Output step of Create Report (REPORT-OUTPUT-PREVIEW-2026-11-16). */
@RestController
@RequestMapping("/reports/templates")
public class ReportPreviewFileController {
    private final ReportPreviewFileService files;
    private final CurrentUserService users;

    public ReportPreviewFileController(ReportPreviewFileService files, CurrentUserService users) {
        this.files = files;
        this.users = users;
    }

    public record PreviewFileRequest(ReportTemplateService.Criteria criteria, String title, String format, Boolean full) {}

    @PostMapping("/{code}/preview-file")
    public ResponseEntity<?> create(@PathVariable String code, @RequestBody PreviewFileRequest request) throws Exception {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(files.create(users.requireCurrentUser(), code, request.criteria(), request.title(), request.format(), Boolean.TRUE.equals(request.full())));
    }

    @GetMapping("/preview-files/{id}/view-config")
    public ResponseEntity<?> viewConfig(@PathVariable UUID id) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(files.viewConfig(users.requireCurrentUser(), id));
    }
}
