package com.eqms.controller.training;

import com.eqms.auth.CurrentUserService;
import com.eqms.service.training.TrainingRequirementService;
import com.eqms.service.training.TrainingRequirementService.*;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

/** Training requirements (APD.0118): the plan of the trainings of a year. Every command is checked again in the service. */
@RestController
@RequestMapping("/training/requirements")
public class TrainingRequirementController {
    private final TrainingRequirementService requirements;
    private final CurrentUserService users;

    public TrainingRequirementController(TrainingRequirementService requirements, CurrentUserService users) {
        this.requirements = requirements;
        this.users = users;
    }

    @GetMapping
    public ResponseEntity<?> list(@RequestParam(required = false) Integer year, @RequestParam(required = false) String status, @RequestParam(required = false) String search,
                                  @RequestParam(defaultValue = "1") int page, @RequestParam(defaultValue = "10") int limit) {
        return ResponseEntity.ok(requirements.list(users.requireCurrentUser(), year, status, search, page, limit));
    }

    @GetMapping("/suggestions")
    public ResponseEntity<?> suggestions(@RequestParam(required = false) Integer year, @RequestParam(required = false) UUID departmentId) {
        return ResponseEntity.ok(Map.of("data", requirements.suggestions(users.requireCurrentUser(), year, departmentId)));
    }

    @PostMapping
    public ResponseEntity<?> create(@RequestBody CreateRequest request) { return ResponseEntity.ok(requirements.create(users.requireCurrentUser(), request)); }

    @GetMapping("/{id}")
    public ResponseEntity<?> get(@PathVariable UUID id) { return ResponseEntity.ok(requirements.get(users.requireCurrentUser(), id)); }

    @PutMapping("/{id}")
    public ResponseEntity<?> save(@PathVariable UUID id, @RequestBody SaveRequest request) { return ResponseEntity.ok(requirements.save(users.requireCurrentUser(), id, request)); }

    @GetMapping("/{id}/eligible-approvers")
    public ResponseEntity<?> eligible(@PathVariable UUID id, @RequestParam String step, @RequestParam(required = false) String search,
                                      @RequestParam(defaultValue = "1") int page, @RequestParam(defaultValue = "20") int limit) {
        return ResponseEntity.ok(requirements.eligibleApprovers(users.requireCurrentUser(), id, step, search, page, limit));
    }

    @PostMapping("/{id}/submit")
    public ResponseEntity<?> submit(@PathVariable UUID id, @RequestBody SubmitRequest request) { return ResponseEntity.ok(requirements.submit(users.requireCurrentUser(), id, request)); }

    @PostMapping("/{id}/review")
    public ResponseEntity<?> review(@PathVariable UUID id, @RequestBody SubmitRequest request) { return ResponseEntity.ok(requirements.review(users.requireCurrentUser(), id, request)); }

    @PostMapping("/{id}/approve")
    public ResponseEntity<?> approve(@PathVariable UUID id, @RequestBody SignRequest request) { return ResponseEntity.ok(requirements.approve(users.requireCurrentUser(), id, request)); }

    @PostMapping("/{id}/reject")
    public ResponseEntity<?> reject(@PathVariable UUID id, @RequestBody RejectRequest request) { return ResponseEntity.ok(requirements.reject(users.requireCurrentUser(), id, request)); }

    @PostMapping("/lines/{lineId}/postpone")
    public ResponseEntity<?> postpone(@PathVariable UUID lineId, @RequestBody PostponeRequest request) { return ResponseEntity.ok(requirements.postpone(users.requireCurrentUser(), lineId, request)); }

    @PostMapping("/lines/{lineId}/open-activity")
    public ResponseEntity<?> open(@PathVariable UUID lineId) { return ResponseEntity.ok(requirements.openActivity(users.requireCurrentUser(), lineId)); }

    @PostMapping("/lines/{lineId}/qa-sign")
    public ResponseEntity<?> qaSign(@PathVariable UUID lineId, @RequestBody QaRequest request) { return ResponseEntity.ok(requirements.qaSign(users.requireCurrentUser(), lineId, request)); }
}
