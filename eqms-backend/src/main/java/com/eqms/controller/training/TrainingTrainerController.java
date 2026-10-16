package com.eqms.controller.training;

import com.eqms.auth.CurrentUserService;
import com.eqms.service.training.TrainingTrainerService;
import com.eqms.service.training.TrainingTrainerService.*;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

/** Exceptions for a trainer who is not yet qualified for a session (TR-19). */
@RestController
@RequestMapping("/training")
public class TrainingTrainerController {
    private final TrainingTrainerService trainers;
    private final CurrentUserService users;

    public TrainingTrainerController(TrainingTrainerService trainers, CurrentUserService users) {
        this.trainers = trainers;
        this.users = users;
    }

    @GetMapping("/sessions/{id}/trainer-exception/eligible-approvers")
    public ResponseEntity<?> eligible(@PathVariable UUID id, @RequestParam(required = false) String search, @RequestParam(defaultValue = "1") int page, @RequestParam(defaultValue = "20") int limit) {
        return ResponseEntity.ok(trainers.eligibleApprovers(users.requireCurrentUser(), id, search, page, limit));
    }

    @PostMapping("/sessions/{id}/trainer-exception")
    public ResponseEntity<?> request(@PathVariable UUID id, @RequestBody ExceptionRequest request) { return ResponseEntity.ok(trainers.requestException(users.requireCurrentUser(), id, request)); }

    @PostMapping("/trainer-exceptions/{id}/approve")
    public ResponseEntity<?> approve(@PathVariable UUID id, @RequestBody SignRequest request) { return ResponseEntity.ok(trainers.approve(users.requireCurrentUser(), id, request)); }

    @PostMapping("/trainer-exceptions/{id}/reject")
    public ResponseEntity<?> reject(@PathVariable UUID id, @RequestBody RejectRequest request) { return ResponseEntity.ok(trainers.reject(users.requireCurrentUser(), id, request)); }
}
