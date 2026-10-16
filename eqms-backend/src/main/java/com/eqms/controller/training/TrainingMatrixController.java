package com.eqms.controller.training;

import com.eqms.auth.CurrentUserService;
import com.eqms.service.training.TrainingMatrixService;
import com.eqms.service.training.TrainingMatrixService.*;
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

    public TrainingMatrixController(TrainingMatrixService matrices, CurrentUserService users) {
        this.matrices = matrices;
        this.users = users;
    }

    @GetMapping("/matrices")
    public ResponseEntity<?> list() { return ResponseEntity.ok(Map.of("data", matrices.matrices(users.requireCurrentUser()))); }

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

    @GetMapping("/matrix-versions/{a}/compare/{b}")
    public ResponseEntity<?> compare(@PathVariable UUID a, @PathVariable UUID b) { return ResponseEntity.ok(matrices.compare(users.requireCurrentUser(), a, b)); }

    @GetMapping("/topics")
    public ResponseEntity<?> topics(@RequestParam(required = false) String search, @RequestParam(defaultValue = "false") boolean activeOnly) {
        return ResponseEntity.ok(Map.of("data", matrices.topics(users.requireCurrentUser(), search, activeOnly)));
    }

    @PostMapping("/topics")
    public ResponseEntity<?> createTopic(@RequestBody TopicRequest request) { return ResponseEntity.ok(matrices.saveTopic(users.requireCurrentUser(), null, request)); }

    @PutMapping("/topics/{id}")
    public ResponseEntity<?> updateTopic(@PathVariable UUID id, @RequestBody TopicRequest request) { return ResponseEntity.ok(matrices.saveTopic(users.requireCurrentUser(), id, request)); }

    @GetMapping("/positions")
    public ResponseEntity<?> positions() { return ResponseEntity.ok(Map.of("data", matrices.allPositions(users.requireCurrentUser()))); }

    @GetMapping("/person-positions")
    public ResponseEntity<?> personPositions(@RequestParam(required = false) String search, @RequestParam(defaultValue = "false") boolean unmatchedOnly,
                                             @RequestParam(defaultValue = "1") int page, @RequestParam(defaultValue = "20") int limit) {
        return ResponseEntity.ok(matrices.personPositions(users.requireCurrentUser(), search, unmatchedOnly, page, limit));
    }

    @PutMapping("/person-positions")
    public ResponseEntity<?> setPersonPosition(@RequestBody PersonPositionRequest request) { return ResponseEntity.ok(matrices.setPersonPosition(users.requireCurrentUser(), request.personUserId(), request.positionId())); }
}
