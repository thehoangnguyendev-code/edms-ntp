package com.eqms.controller;

import com.eqms.auth.CurrentUserService;
import com.eqms.service.ReportPlatformService;
import org.springframework.http.ResponseEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;
import java.util.*;

@RestController
@RequestMapping("/reports")
public class ReportPlatformController {
    private final ReportPlatformService reports; private final CurrentUserService currentUser;
    public ReportPlatformController(ReportPlatformService reports, CurrentUserService currentUser) { this.reports=reports; this.currentUser=currentUser; }
    @GetMapping("/catalog") public ResponseEntity<?> catalog() { return ResponseEntity.ok(reports.catalog(currentUser.requireCurrentUser())); }
    @PostMapping("/runs") public ResponseEntity<?> run(@RequestBody ReportPlatformService.RunRequest request, @RequestHeader(value="Idempotency-Key", required=false) String key) { UUID id=reports.queueRun(currentUser.requireCurrentUser(), request, key); return ResponseEntity.accepted().body(Map.of("id",id,"status","QUEUED")); }
    @PostMapping("/runs/{runId}/retry") public ResponseEntity<Void> retry(@PathVariable UUID runId) { reports.retryRun(currentUser.requireCurrentUser(), runId); return ResponseEntity.accepted().build(); }
    @GetMapping("/runs") public ResponseEntity<?> runs(@RequestParam(required=false) String search, @RequestParam(defaultValue="1") int page, @RequestParam(defaultValue="20") int limit, @RequestParam(defaultValue="queuedAt") String sortBy, @RequestParam(defaultValue="desc") String sortDirection) { return ResponseEntity.ok(reports.runs(currentUser.requireCurrentUser(),search,page,limit,sortBy,sortDirection)); }
    @GetMapping("/runs/{runId}") public ResponseEntity<?> runDetail(@PathVariable UUID runId) { return ResponseEntity.ok(reports.runDetail(currentUser.requireCurrentUser(), runId)); }
    @GetMapping("/definitions/{code}/preview") public ResponseEntity<?> preview(@PathVariable String code, @RequestParam(required=false) List<String> fields) { return ResponseEntity.ok(reports.preview(currentUser.requireCurrentUser(), code, fields)); }
    @PostMapping("/runs/{runId}/artifacts/{artifactId}/download") public ResponseEntity<byte[]> download(@PathVariable UUID runId, @PathVariable UUID artifactId) {
        var artifact=reports.download(currentUser.requireCurrentUser(),runId,artifactId);
        return ResponseEntity.ok().header(HttpHeaders.CONTENT_DISPOSITION,"attachment; filename=\""+artifact.filename().replace("\"", "")+"\"").contentType(MediaType.parseMediaType(artifact.mimeType())).body(artifact.bytes());
    }
    @PostMapping("/runs/{runId}/artifacts/{artifactId}/legal-hold") public ResponseEntity<Void> legalHold(@PathVariable UUID runId, @PathVariable UUID artifactId, @RequestBody Map<String,Object> request) {
        reports.setArtifactLegalHold(currentUser.requireCurrentUser(), runId, artifactId, Boolean.TRUE.equals(request.get("legalHold")), String.valueOf(request.getOrDefault("reason", "")));
        return ResponseEntity.noContent().build();
    }
    @GetMapping("/schedules") public ResponseEntity<?> schedules() { return ResponseEntity.ok(reports.schedules(currentUser.requireCurrentUser())); }
    @GetMapping("/schedules/recipients") public ResponseEntity<?> recipientCandidates(@RequestParam(required=false) String search) { return ResponseEntity.ok(reports.recipientCandidates(currentUser.requireCurrentUser(), search)); }
    @PostMapping("/schedules") public ResponseEntity<?> createSchedule(@RequestBody ReportPlatformService.ScheduleRequest request) { return ResponseEntity.status(201).body(Map.of("id", reports.createSchedule(currentUser.requireCurrentUser(), request))); }
    @PostMapping("/schedules/{id}/pause") public ResponseEntity<Void> pauseSchedule(@PathVariable UUID id) { reports.pauseSchedule(currentUser.requireCurrentUser(), id); return ResponseEntity.noContent().build(); }
    @PostMapping("/schedules/{id}/resume") public ResponseEntity<Void> resumeSchedule(@PathVariable UUID id) { reports.resumeSchedule(currentUser.requireCurrentUser(), id); return ResponseEntity.noContent().build(); }
    @DeleteMapping("/schedules/{id}") public ResponseEntity<Void> deleteSchedule(@PathVariable UUID id) { reports.deleteSchedule(currentUser.requireCurrentUser(), id); return ResponseEntity.noContent().build(); }
}
