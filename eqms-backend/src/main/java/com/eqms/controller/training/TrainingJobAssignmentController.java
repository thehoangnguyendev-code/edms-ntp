package com.eqms.controller.training;

import com.eqms.auth.CurrentUserService;
import com.eqms.service.training.TrainingJobAssignmentService;
import com.eqms.service.training.TrainingJobAssignmentService.*;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

/** Job assignments (APD.0024). Every command is checked again in the service. */
@RestController
@RequestMapping("/training/job-assignments")
public class TrainingJobAssignmentController {
    private final TrainingJobAssignmentService jobs;
    private final CurrentUserService users;

    public TrainingJobAssignmentController(TrainingJobAssignmentService jobs, CurrentUserService users) {
        this.jobs = jobs;
        this.users = users;
    }

    @GetMapping
    public ResponseEntity<?> list(@RequestParam(required = false) String search, @RequestParam(required = false) String status,
                                  @RequestParam(defaultValue = "1") int page, @RequestParam(defaultValue = "10") int limit) {
        return ResponseEntity.ok(jobs.list(users.requireCurrentUser(), search, status, page, limit));
    }

    @GetMapping("/eligibility")
    public ResponseEntity<?> eligibility(@RequestParam UUID person, @RequestParam UUID position) { return ResponseEntity.ok(jobs.eligibility(users.requireCurrentUser(), person, position)); }

    @PostMapping
    public ResponseEntity<?> create(@RequestBody SaveRequest request) { return ResponseEntity.ok(jobs.create(users.requireCurrentUser(), request)); }

    @GetMapping("/{id}")
    public ResponseEntity<?> get(@PathVariable UUID id) { return ResponseEntity.ok(jobs.get(users.requireCurrentUser(), id)); }

    @PutMapping("/{id}")
    public ResponseEntity<?> update(@PathVariable UUID id, @RequestBody SaveRequest request) { return ResponseEntity.ok(jobs.update(users.requireCurrentUser(), id, request)); }

    @PostMapping("/{id}/exception")
    public ResponseEntity<?> requestException(@PathVariable UUID id, @RequestBody ExceptionRequest request) { return ResponseEntity.ok(jobs.requestException(users.requireCurrentUser(), id, request)); }

    @GetMapping("/{id}/exception/eligible-approvers")
    public ResponseEntity<?> eligible(@PathVariable UUID id, @RequestParam(required = false) String search, @RequestParam(defaultValue = "1") int page, @RequestParam(defaultValue = "20") int limit) {
        return ResponseEntity.ok(jobs.eligibleExceptionApprovers(users.requireCurrentUser(), id, search, page, limit));
    }

    @PostMapping("/{id}/exception/approve")
    public ResponseEntity<?> approveException(@PathVariable UUID id, @RequestBody SignRequest request) { return ResponseEntity.ok(jobs.approveException(users.requireCurrentUser(), id, request)); }

    @PostMapping("/{id}/submit")
    public ResponseEntity<?> submit(@PathVariable UUID id, @RequestBody SignRequest request) { return ResponseEntity.ok(jobs.submit(users.requireCurrentUser(), id, request)); }

    @PostMapping("/{id}/accept")
    public ResponseEntity<?> accept(@PathVariable UUID id, @RequestBody SignRequest request) { return ResponseEntity.ok(jobs.accept(users.requireCurrentUser(), id, request)); }

    @PostMapping("/{id}/cancel")
    public ResponseEntity<?> cancel(@PathVariable UUID id, @RequestBody CancelRequest request) { return ResponseEntity.ok(jobs.cancel(users.requireCurrentUser(), id, request)); }
}
