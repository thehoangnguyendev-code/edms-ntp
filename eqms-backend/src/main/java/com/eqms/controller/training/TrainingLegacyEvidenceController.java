package com.eqms.controller.training;

import com.eqms.auth.CurrentUserService;
import com.eqms.service.training.TrainingLegacyEvidenceService;
import com.eqms.service.training.TrainingLegacyEvidenceService.*;
import org.springframework.http.CacheControl;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.Map;
import java.util.UUID;

/** Training evidence of documents imported from paper. */
@RestController
@RequestMapping("/training/legacy-evidence")
public class TrainingLegacyEvidenceController {
    private final TrainingLegacyEvidenceService evidence;
    private final CurrentUserService users;

    public TrainingLegacyEvidenceController(TrainingLegacyEvidenceService evidence, CurrentUserService users) {
        this.evidence = evidence;
        this.users = users;
    }

    @GetMapping
    public ResponseEntity<?> queue(@RequestParam(required = false) String status, @RequestParam(required = false) String search,
                                   @RequestParam(required = false) String sortBy, @RequestParam(required = false) String sortDirection,
                                  @RequestParam(defaultValue = "1") int page, @RequestParam(defaultValue = "10") int limit,
                                  @RequestParam Map<String, String> filters) {
        return ResponseEntity.ok(evidence.queue(users.requireCurrentUser(), status, search, sortBy, sortDirection, page, limit, filters));
    }

    @GetMapping("/revisions/{revisionId}/eligible-verifiers")
    public ResponseEntity<?> eligible(@PathVariable UUID revisionId, @RequestParam(required = false) String search, @RequestParam(defaultValue = "1") int page, @RequestParam(defaultValue = "20") int limit) {
        return ResponseEntity.ok(evidence.eligibleVerifiers(users.requireCurrentUser(), revisionId, search, page, limit));
    }

    @PostMapping(value = "/revisions/{revisionId}", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> submit(@PathVariable UUID revisionId, @RequestPart(value = "file", required = false) MultipartFile file, @RequestParam UUID verifierId,
                                    @RequestParam(defaultValue = "false") boolean notEvidenced, @RequestParam(required = false) String reason) {
        return ResponseEntity.ok(evidence.submit(users.requireCurrentUser(), revisionId, file, notEvidenced, reason, verifierId));
    }

    @PostMapping("/{id}/verify")
    public ResponseEntity<?> verify(@PathVariable UUID id, @RequestBody SignRequest request) { return ResponseEntity.ok(evidence.verify(users.requireCurrentUser(), id, request)); }

    @PostMapping("/{id}/reject")
    public ResponseEntity<?> reject(@PathVariable UUID id, @RequestBody RejectRequest request) { return ResponseEntity.ok(evidence.reject(users.requireCurrentUser(), id, request)); }

    @GetMapping("/{id}/download")
    public ResponseEntity<byte[]> download(@PathVariable UUID id) {
        Map<String, Object> file = evidence.download(users.requireCurrentUser(), id);
        return ResponseEntity.ok().contentType(MediaType.parseMediaType((String) file.get("contentType"))).cacheControl(CacheControl.noStore())
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment().filename((String) file.get("name")).build().toString()).body((byte[]) file.get("bytes"));
    }
}
