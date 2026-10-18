package com.eqms.controller.training;

import com.eqms.auth.CurrentUserService;
import com.eqms.service.training.TrainingSpecimenService;
import com.eqms.service.training.TrainingSpecimenService.*;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.Map;
import java.util.UUID;

/** Specimen signatures. The image is opened only here, with a check each time, and is never in a list. */
@RestController
@RequestMapping("/training/specimen-signatures")
public class TrainingSpecimenController {
    private final TrainingSpecimenService specimens;
    private final CurrentUserService users;

    public TrainingSpecimenController(TrainingSpecimenService specimens, CurrentUserService users) {
        this.specimens = specimens;
        this.users = users;
    }

    @GetMapping
    public ResponseEntity<?> list(@RequestParam(required = false) String search, @RequestParam(required = false) String status,
                                  @RequestParam(defaultValue = "1") int page, @RequestParam(defaultValue = "10") int limit) {
        return ResponseEntity.ok(specimens.list(users.requireCurrentUser(), search, status, page, limit));
    }

    @GetMapping("/eligible-confirmers")
    public ResponseEntity<?> eligible(@RequestParam(required = false) UUID personId, @RequestParam(required = false) String search,
                                      @RequestParam(defaultValue = "1") int page, @RequestParam(defaultValue = "20") int limit) {
        return ResponseEntity.ok(specimens.eligibleConfirmers(users.requireCurrentUser(), personId, search, page, limit));
    }

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> upload(@RequestPart("file") MultipartFile file, @RequestPart(value = "file2", required = false) MultipartFile file2, @RequestParam(required = false) UUID personId, @RequestParam UUID confirmerId,
                                    @RequestParam(required = false) String reason) {
        return ResponseEntity.ok(specimens.upload(users.requireCurrentUser(), personId, file, file2, confirmerId, reason));
    }

    @GetMapping("/{id}/image")
    public ResponseEntity<byte[]> image(@PathVariable UUID id, @RequestParam(defaultValue = "1") int which) {
        Map<String, Object> image = specimens.image(users.requireCurrentUser(), id, which);
        return ResponseEntity.ok().contentType(MediaType.parseMediaType((String) image.get("contentType"))).cacheControl(CacheControl.noStore()).body((byte[]) image.get("bytes"));
    }

    @PostMapping("/{id}/confirm")
    public ResponseEntity<?> confirm(@PathVariable UUID id, @RequestBody SignRequest request) { return ResponseEntity.ok(specimens.confirm(users.requireCurrentUser(), id, request)); }

    @PostMapping("/{id}/reject")
    public ResponseEntity<?> reject(@PathVariable UUID id, @RequestBody RejectRequest request) { return ResponseEntity.ok(specimens.reject(users.requireCurrentUser(), id, request)); }
}
