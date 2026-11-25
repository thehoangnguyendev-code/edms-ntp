package com.eqms.controller.training;

import com.eqms.auth.CurrentUserService;
import com.eqms.service.training.TrainingFileService;
import com.eqms.service.training.TrainingFileService.RemoveRequest;
import org.springframework.http.CacheControl;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.Map;
import java.util.UUID;

/** The files of an activity: materials and the scans of paper evidence. Every command is checked again in the service; every download is recorded. */
@RestController
@RequestMapping("/training")
public class TrainingFileController {
    private final TrainingFileService fileService;
    private final CurrentUserService users;

    public TrainingFileController(TrainingFileService fileService, CurrentUserService users) {
        this.fileService = fileService;
        this.users = users;
    }

    @GetMapping("/activities/{id}/files")
    public ResponseEntity<?> list(@PathVariable UUID id) { return ResponseEntity.ok(fileService.list(users.requireCurrentUser(), id)); }

    @PostMapping(value = "/activities/{id}/materials", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> uploadMaterial(@PathVariable UUID id, @RequestPart("file") MultipartFile file, @RequestParam(required = false) String title, @RequestParam(required = false) String purpose, @RequestParam(required = false) UUID sessionId) {
        return ResponseEntity.ok(fileService.uploadMaterial(users.requireCurrentUser(), id, file, title, purpose, sessionId));
    }

    public record LinkRequest(String title, String url, UUID sessionId) {}

    @PostMapping("/activities/{id}/material-links")
    public ResponseEntity<?> addLink(@PathVariable UUID id, @RequestBody LinkRequest request) { return ResponseEntity.ok(fileService.addLink(users.requireCurrentUser(), id, request.title(), request.url(), request.sessionId())); }

    @GetMapping("/materials/{id}/view-config")
    public ResponseEntity<?> viewConfig(@PathVariable UUID id) { return ResponseEntity.ok(fileService.viewConfigOfMaterial(users.requireCurrentUser(), id)); }

    @GetMapping("/materials/{id}/preview")
    public ResponseEntity<byte[]> previewMaterial(@PathVariable UUID id) {
        Map<String, Object> file = fileService.previewMaterial(users.requireCurrentUser(), id);
        String type = String.valueOf(file.get("contentType"));
        return ResponseEntity.ok().contentType(MediaType.parseMediaType(type)).cacheControl(org.springframework.http.CacheControl.noStore())
                .header(org.springframework.http.HttpHeaders.CONTENT_DISPOSITION, org.springframework.http.ContentDisposition.inline().filename(String.valueOf(file.get("name"))).build().toString())
                .body((byte[]) file.get("bytes"));
    }

    @PostMapping("/materials/{id}/remove")
    public ResponseEntity<?> removeMaterial(@PathVariable UUID id, @RequestBody RemoveRequest request) { return ResponseEntity.ok(fileService.removeMaterial(users.requireCurrentUser(), id, request)); }

    @GetMapping("/materials/{id}/download")
    public ResponseEntity<byte[]> downloadMaterial(@PathVariable UUID id) { return file(fileService.downloadMaterial(users.requireCurrentUser(), id)); }

    @PostMapping(value = "/activities/{id}/paper-evidence", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> uploadEvidence(@PathVariable UUID id, @RequestPart("file") MultipartFile file, @RequestParam String kind,
                                            @RequestParam(required = false) UUID participantId, @RequestParam(required = false) String remark, @RequestParam(required = false) String formUsed, @RequestParam(required = false) UUID packId) {
        return ResponseEntity.ok(fileService.uploadEvidence(users.requireCurrentUser(), id, file, kind, participantId, remark, formUsed, packId));
    }

    /** One scanned PDF with the pages of many people in any order: the QR code of every page says whose it is (see the service). */
    @PostMapping(value = "/activities/{id}/paper-evidence/batch", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> uploadScanBatch(@PathVariable UUID id, @RequestPart("file") MultipartFile file) {
        return ResponseEntity.ok(fileService.uploadScanBatch(users.requireCurrentUser(), id, file));
    }

    @PostMapping("/paper-evidence/{id}/receive")
    public ResponseEntity<?> receive(@PathVariable UUID id) { return ResponseEntity.ok(fileService.receiveEvidence(users.requireCurrentUser(), id)); }

    @GetMapping("/paper-evidence/{id}/download")
    public ResponseEntity<byte[]> downloadEvidence(@PathVariable UUID id) { return file(fileService.downloadEvidence(users.requireCurrentUser(), id)); }

    /** The scans of one person in one activity: from the records, the reviews and My Training. */
    @GetMapping("/people/{personId}/activities/{activityId}/evidence")
    public ResponseEntity<?> personEvidence(@PathVariable UUID personId, @PathVariable UUID activityId, @RequestParam(required = false) String search, @RequestParam(required = false) String sortBy,
                                            @RequestParam(required = false) String sortDirection, @RequestParam(defaultValue = "1") int page, @RequestParam(defaultValue = "10") int limit) {
        return ResponseEntity.ok(fileService.personEvidence(users.requireCurrentUser(), personId, activityId, search, sortBy, sortDirection, page, limit));
    }

    @GetMapping("/people/{personId}/activities/{activityId}/evidence/{evidenceId}/file")
    public ResponseEntity<byte[]> personEvidenceFile(@PathVariable UUID personId, @PathVariable UUID activityId, @PathVariable UUID evidenceId, @RequestParam(defaultValue = "false") boolean inline) {
        Map<String, Object> file = fileService.personEvidenceFile(users.requireCurrentUser(), personId, activityId, evidenceId, inline);
        ContentDisposition disposition = (inline ? ContentDisposition.inline() : ContentDisposition.attachment()).filename((String) file.get("name")).build();
        return ResponseEntity.ok().contentType(MediaType.parseMediaType((String) file.get("contentType"))).cacheControl(CacheControl.noStore())
                .header(HttpHeaders.CONTENT_DISPOSITION, disposition.toString()).body((byte[]) file.get("bytes"));
    }

    @GetMapping("/people/{personId}/activities/{activityId}/evidence/{evidenceId}/view-config")
    public ResponseEntity<?> personEvidenceViewConfig(@PathVariable UUID personId, @PathVariable UUID activityId, @PathVariable UUID evidenceId) {
        return ResponseEntity.ok(fileService.personEvidenceViewConfig(users.requireCurrentUser(), personId, activityId, evidenceId));
    }

    private static ResponseEntity<byte[]> file(Map<String, Object> file) {
        return ResponseEntity.ok().contentType(MediaType.parseMediaType((String) file.get("contentType"))).cacheControl(CacheControl.noStore())
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment().filename((String) file.get("name")).build().toString()).body((byte[]) file.get("bytes"));
    }
}
