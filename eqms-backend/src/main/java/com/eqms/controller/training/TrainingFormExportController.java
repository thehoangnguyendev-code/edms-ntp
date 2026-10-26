package com.eqms.controller.training;

import com.eqms.auth.CurrentUserService;
import com.eqms.service.training.TrainingFormExportService;
import org.springframework.http.CacheControl;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;
import java.util.UUID;

/** The forms of Training written in the Word template of the company (APD.0118, APD.0108, FRM.0044, APD.0024, FRM.0007): Word (default) or PDF. */
@RestController
@RequestMapping("/training")
public class TrainingFormExportController {
    private final TrainingFormExportService forms;
    private final CurrentUserService users;

    public TrainingFormExportController(TrainingFormExportService forms, CurrentUserService users) {
        this.forms = forms;
        this.users = users;
    }

    @GetMapping("/requirements/{id}/export")
    public ResponseEntity<byte[]> requirement(@PathVariable UUID id, @RequestParam(defaultValue = "docx") String format) {
        return file(forms.requirement(users.requireCurrentUser(), id, format));
    }

    @GetMapping("/sessions/{id}/self-reading-list")
    public ResponseEntity<byte[]> selfReading(@PathVariable UUID id, @RequestParam(defaultValue = "docx") String format) {
        return file(forms.selfReading(users.requireCurrentUser(), id, format));
    }

    public record PaperRequest(String format, String reason) {}

    /** The paper print of the self-reading list (APD.0108) of a session: the people are written, the signatures are for the hand; a numbered copy. */
    @PostMapping("/sessions/{id}/self-reading-list/paper")
    public ResponseEntity<byte[]> selfReadingPaper(@PathVariable UUID id, @RequestBody(required = false) PaperRequest request) {
        return file(forms.selfReadingPaper(users.requireCurrentUser(), id, request == null || request.format() == null ? "pdf" : request.format(), request == null ? null : request.reason()));
    }

    /** The paper print of the job assignment (APD.0024), to be signed by hand: a numbered copy. */
    @PostMapping("/job-assignments/{id}/paper")
    public ResponseEntity<byte[]> jobAssignmentPaper(@PathVariable UUID id, @RequestBody(required = false) PaperRequest request) {
        return file(forms.jobAssignmentPaper(users.requireCurrentUser(), id, request == null || request.format() == null ? "pdf" : request.format(), request == null ? null : request.reason()));
    }

    @GetMapping("/number-log/export")
    public ResponseEntity<byte[]> numberLog(@RequestParam(required = false) UUID departmentId, @RequestParam(required = false) Integer year, @RequestParam(defaultValue = "docx") String format) {
        return file(forms.numberLog(users.requireCurrentUser(), departmentId, year, format));
    }

    @GetMapping("/job-assignments/{id}/export")
    public ResponseEntity<byte[]> jobAssignment(@PathVariable UUID id, @RequestParam(defaultValue = "docx") String format) {
        return file(forms.jobAssignment(users.requireCurrentUser(), id, format));
    }

    @GetMapping("/specimen-signatures/person/{personId}/export")
    public ResponseEntity<byte[]> specimen(@PathVariable UUID personId, @RequestParam(defaultValue = "docx") String format) {
        return file(forms.specimen(users.requireCurrentUser(), personId, format));
    }

    private static ResponseEntity<byte[]> file(Map<String, Object> file) {
        return ResponseEntity.ok().contentType(MediaType.parseMediaType((String) file.get("contentType"))).cacheControl(CacheControl.noStore())
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment().filename((String) file.get("name")).build().toString()).body((byte[]) file.get("bytes"));
    }
}
