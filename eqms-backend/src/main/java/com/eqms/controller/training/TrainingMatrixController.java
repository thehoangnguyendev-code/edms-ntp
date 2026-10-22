package com.eqms.controller.training;

import com.eqms.auth.CurrentUserService;
import com.eqms.service.training.TrainingPrintService;
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
    public record PersonPositionRequest(UUID personUserId, UUID positionId) {}

    private final TrainingMatrixService matrices;
    private final CurrentUserService users;
    private final TrainingPrintService prints;

    public TrainingMatrixController(TrainingMatrixService matrices, CurrentUserService users, TrainingPrintService prints) {
        this.prints = prints;
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

    @GetMapping("/matrix-versions/{id}/print")
    public ResponseEntity<byte[]> print(@PathVariable UUID id) { return pdf(prints.matrixVersion(users.requireCurrentUser(), id)); }

    private static ResponseEntity<byte[]> pdf(Map<String, Object> file) {
        return ResponseEntity.ok().contentType(MediaType.APPLICATION_PDF).cacheControl(CacheControl.noStore())
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment().filename((String) file.get("name")).build().toString()).body((byte[]) file.get("bytes"));
    }

    @GetMapping("/matrix-versions/{a}/compare/{b}")
    public ResponseEntity<?> compare(@PathVariable UUID a, @PathVariable UUID b) { return ResponseEntity.ok(matrices.compare(users.requireCurrentUser(), a, b)); }

    @GetMapping("/topics")
    public ResponseEntity<?> topics(@RequestParam(required = false) String search, @RequestParam(defaultValue = "false") boolean activeOnly) {
        return ResponseEntity.ok(Map.of("data", matrices.topics(users.requireCurrentUser(), search, activeOnly)));
    }

    @GetMapping("/topics/page")
    public ResponseEntity<?> topicsPage(@RequestParam(required = false) String search,
                                        @RequestParam(required = false) String scope,
                                        @RequestParam(required = false) String status,
                                        @RequestParam(required = false) String sortBy,
                                        @RequestParam(defaultValue = "asc") String sortDirection,
                                        @RequestParam(defaultValue = "1") int page,
                                        @RequestParam(defaultValue = "10") int limit) {
        return ResponseEntity.ok(matrices.topicsPage(users.requireCurrentUser(), search, scope, status, sortBy, sortDirection, page, limit));
    }

    @PostMapping("/topics")
    public ResponseEntity<?> createTopic(@RequestBody TopicRequest request) { return ResponseEntity.ok(matrices.saveTopic(users.requireCurrentUser(), null, request)); }

    @PutMapping("/topics/{id}")
    public ResponseEntity<?> updateTopic(@PathVariable UUID id, @RequestBody TopicRequest request) { return ResponseEntity.ok(matrices.saveTopic(users.requireCurrentUser(), id, request)); }

    @GetMapping("/positions")
    public ResponseEntity<?> positions() { return ResponseEntity.ok(Map.of("data", matrices.allPositions(users.requireCurrentUser()))); }

    @GetMapping("/person-positions")
    public ResponseEntity<?> personPositions(@RequestParam(required = false) String search, @RequestParam(defaultValue = "false") boolean unmatchedOnly,
                                             @RequestParam(required = false) String sortBy, @RequestParam(required = false) String sortDirection,
                                  @RequestParam(defaultValue = "1") int page, @RequestParam(defaultValue = "20") int limit) {
        return ResponseEntity.ok(matrices.personPositions(users.requireCurrentUser(), search, unmatchedOnly, sortBy, sortDirection, page, limit));
    }

    @PutMapping("/person-positions")
    public ResponseEntity<?> setPersonPosition(@RequestBody PersonPositionRequest request) { return ResponseEntity.ok(matrices.setPersonPosition(users.requireCurrentUser(), request.personUserId(), request.positionId())); }
}
