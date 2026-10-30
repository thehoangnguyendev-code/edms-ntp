package com.eqms.controller.training;

import com.eqms.auth.CurrentUserService;
import com.eqms.service.training.TrainingMatrixFormService;
import com.eqms.service.training.TrainingMatrixService;
import com.eqms.service.training.TrainingMatrixService.*;
import org.springframework.http.CacheControl;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

/** Training matrices, their versions, topics and the positions of people. Every command is checked again in the service. */
@RestController
@RequestMapping("/training")
public class TrainingMatrixController {
    public record CreateMatrixRequest(UUID departmentId) {}

    private final TrainingMatrixService matrices;
    private final CurrentUserService users;
    private final TrainingMatrixFormService forms;

    public TrainingMatrixController(TrainingMatrixService matrices, CurrentUserService users, TrainingMatrixFormService forms) {
        this.forms = forms;
        this.matrices = matrices;
        this.users = users;
    }

    @GetMapping("/matrices")
    public ResponseEntity<?> list(@RequestParam(required = false) String search, @RequestParam(required = false) String state,
                                  @RequestParam(required = false) String sortBy, @RequestParam(required = false) String sortDirection,
                                  @RequestParam(defaultValue = "1") int page, @RequestParam(defaultValue = "10") int limit) {
        return ResponseEntity.ok(matrices.matrices(users.requireCurrentUser(), search, state, sortBy, sortDirection, page, limit));
    }

    @GetMapping("/matrices/{id}/versions")
    public ResponseEntity<?> versions(@PathVariable UUID id, @RequestParam(required = false) String search, @RequestParam(required = false) String status,
                                      @RequestParam(required = false) String sortBy, @RequestParam(defaultValue = "desc") String sortDirection,
                                      @RequestParam(defaultValue = "1") int page, @RequestParam(defaultValue = "10") int limit) {
        return ResponseEntity.ok(matrices.versionsPage(users.requireCurrentUser(), id, search, status, sortBy, sortDirection, page, limit));
    }

    @PostMapping("/matrices")
    public ResponseEntity<?> create(@RequestBody CreateMatrixRequest request) { return ResponseEntity.ok(matrices.createMatrix(users.requireCurrentUser(), request.departmentId())); }

    @GetMapping("/matrices/{id}")
    public ResponseEntity<?> get(@PathVariable UUID id) { return ResponseEntity.ok(matrices.matrix(users.requireCurrentUser(), id)); }

    @PostMapping("/matrices/{id}/upgrade")
    public ResponseEntity<?> upgrade(@PathVariable UUID id) { return ResponseEntity.ok(matrices.upgrade(users.requireCurrentUser(), id)); }

    @GetMapping("/matrices/{id}/coverage")
    public ResponseEntity<?> coverage(@PathVariable UUID id, @RequestParam UUID position) {
        return ResponseEntity.ok(Map.of("data", matrices.coverage(users.requireCurrentUser(), id, position)));
    }

    @GetMapping("/matrix-versions/{id}")
    public ResponseEntity<?> version(@PathVariable UUID id) { return ResponseEntity.ok(matrices.version(users.requireCurrentUser(), id)); }

    @PutMapping("/matrix-versions/{id}")
    public ResponseEntity<?> save(@PathVariable UUID id, @RequestBody SaveRequest request) { return ResponseEntity.ok(matrices.save(users.requireCurrentUser(), id, request)); }

    @PostMapping("/matrix-versions/{id}/apply-locked-rows")
    public ResponseEntity<?> applyLockedRows(@PathVariable UUID id) { return ResponseEntity.ok(matrices.applyLockedRows(users.requireCurrentUser(), id)); }

    @GetMapping("/matrix-versions/{id}/eligible-approvers")
    public ResponseEntity<?> eligible(@PathVariable UUID id, @RequestParam(required = false) String search, @RequestParam(defaultValue = "1") int page, @RequestParam(defaultValue = "20") int limit) {
        return ResponseEntity.ok(matrices.eligibleApprovers(users.requireCurrentUser(), id, search, page, limit));
    }

    @PostMapping("/matrix-versions/{id}/submit")
    public ResponseEntity<?> submit(@PathVariable UUID id, @RequestBody SubmitRequest request) { return ResponseEntity.ok(matrices.submit(users.requireCurrentUser(), id, request)); }

    @PostMapping("/matrix-versions/{id}/approve")
    public ResponseEntity<?> approve(@PathVariable UUID id, @RequestBody SignRequest request) { return ResponseEntity.ok(matrices.approve(users.requireCurrentUser(), id, request)); }

    @PostMapping("/matrix-versions/{id}/reject")
    public ResponseEntity<?> reject(@PathVariable UUID id, @RequestBody RejectRequest request) { return ResponseEntity.ok(matrices.reject(users.requireCurrentUser(), id, request)); }

    /** The matrix version in the form APD.0011, filled in the Word template that Training Administration enabled; as Word (default) or PDF. */
    @GetMapping("/matrix-versions/{id}/export")
    public ResponseEntity<byte[]> export(@PathVariable UUID id, @RequestParam(defaultValue = "docx") String format) {
        Map<String, Object> file = forms.export(users.requireCurrentUser(), id, format);
        return ResponseEntity.ok().contentType(MediaType.parseMediaType((String) file.get("contentType"))).cacheControl(CacheControl.noStore())
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment().filename((String) file.get("name")).build().toString()).body((byte[]) file.get("bytes"));
    }

    @GetMapping("/matrix-versions/{a}/compare/{b}")
    public ResponseEntity<?> compare(@PathVariable UUID a, @PathVariable UUID b) { return ResponseEntity.ok(matrices.compare(users.requireCurrentUser(), a, b)); }


    @GetMapping("/positions")
    public ResponseEntity<?> positions() { return ResponseEntity.ok(Map.of("data", matrices.allPositions(users.requireCurrentUser()))); }

    @GetMapping("/person-positions")
    public ResponseEntity<?> personPositions(@RequestParam(required = false) String search, @RequestParam(defaultValue = "false") boolean unmatchedOnly,
                                             @RequestParam(required = false) String department, @RequestParam(required = false) UUID positionId, @RequestParam(required = false) String mapped,
                                             @RequestParam(required = false) String suggested, @RequestParam(required = false) String sortBy, @RequestParam(required = false) String sortDirection,
                                  @RequestParam(defaultValue = "1") int page, @RequestParam(defaultValue = "20") int limit) {
        return ResponseEntity.ok(matrices.personPositions(users.requireCurrentUser(), search, unmatchedOnly, department, positionId, mapped, suggested, sortBy, sortDirection, page, limit));
    }

    @GetMapping("/person-positions/{personId}")
    public ResponseEntity<?> personPositionDetails(@PathVariable UUID personId, @RequestParam(required = false) String search,
                                                   @RequestParam(defaultValue = "1") int page, @RequestParam(defaultValue = "20") int limit) {
        return ResponseEntity.ok(matrices.personPositionDetails(users.requireCurrentUser(), personId, search, page, limit));
    }

}
