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
    public ResponseEntity<?> uploadMaterial(@PathVariable UUID id, @RequestPart("file") MultipartFile file, @RequestParam(required = false) String title, @RequestParam(required = false) String purpose) {
        return ResponseEntity.ok(fileService.uploadMaterial(users.requireCurrentUser(), id, file, title, purpose));
    }

    public record LinkRequest(String title, String url) {}

    @PostMapping("/activities/{id}/material-links")
    public ResponseEntity<?> addLink(@PathVariable UUID id, @RequestBody LinkRequest request) { return ResponseEntity.ok(fileService.addLink(users.requireCurrentUser(), id, request.title(), request.url())); }

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
                                            @RequestParam(required = false) UUID participantId, @RequestParam(required = false) String remark) {
        return ResponseEntity.ok(fileService.uploadEvidence(users.requireCurrentUser(), id, file, kind, participantId, remark));
    }

    @PostMapping("/paper-evidence/{id}/receive")
    public ResponseEntity<?> receive(@PathVariable UUID id) { return ResponseEntity.ok(fileService.receiveEvidence(users.requireCurrentUser(), id)); }

    @GetMapping("/paper-evidence/{id}/download")
    public ResponseEntity<byte[]> downloadEvidence(@PathVariable UUID id) { return file(fileService.downloadEvidence(users.requireCurrentUser(), id)); }

    private static ResponseEntity<byte[]> file(Map<String, Object> file) {
        return ResponseEntity.ok().contentType(MediaType.parseMediaType((String) file.get("contentType"))).cacheControl(CacheControl.noStore())
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment().filename((String) file.get("name")).build().toString()).body((byte[]) file.get("bytes"));
    }
}
