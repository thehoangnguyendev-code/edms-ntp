package com.eqms.controller.training;

import com.eqms.auth.CurrentUserService;
import com.eqms.service.training.TrainingCopyService;
import com.eqms.service.training.TrainingPreparationService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

/** The preparation checklist of the sessions of an activity, and the log of the copies sent to departments. */
@RestController
@RequestMapping("/training")
public class TrainingPreparationController {
    private final TrainingPreparationService preparation;
    private final TrainingCopyService copies;
    private final CurrentUserService users;

    public TrainingPreparationController(TrainingPreparationService preparation, TrainingCopyService copies, CurrentUserService users) {
        this.preparation = preparation;
        this.copies = copies;
        this.users = users;
    }

    @GetMapping("/activities/{id}/preparation")
    public ResponseEntity<?> get(@PathVariable UUID id) { return ResponseEntity.ok(preparation.get(users.requireCurrentUser(), id)); }

    @PutMapping("/sessions/{id}/preparation/{item}")
    public ResponseEntity<?> update(@PathVariable UUID id, @PathVariable String item, @RequestBody TrainingPreparationService.UpdateRequest request) {
        return ResponseEntity.ok(preparation.update(users.requireCurrentUser(), id, item, request));
    }

    @GetMapping("/copies/{type}/{id}")
    public ResponseEntity<?> copies(@PathVariable String type, @PathVariable UUID id) { return ResponseEntity.ok(copies.list(users.requireCurrentUser(), type(type), id)); }

    @PostMapping("/copies/{type}/{id}")
    public ResponseEntity<?> send(@PathVariable String type, @PathVariable UUID id, @RequestBody TrainingCopyService.SendRequest request) {
        return ResponseEntity.ok(copies.send(users.requireCurrentUser(), type(type), id, request));
    }

    @GetMapping("/copy-distributions/mine")
    public ResponseEntity<?> mine(@RequestParam(required = false) String sortBy, @RequestParam(required = false) String sortDirection) { return ResponseEntity.ok(copies.mine(users.requireCurrentUser(), sortBy, sortDirection)); }

    @PostMapping("/copy-distributions/{id}/receive")
    public ResponseEntity<?> receive(@PathVariable UUID id) { return ResponseEntity.ok(copies.receive(users.requireCurrentUser(), id)); }

    /** The address says requirement or job-assignment; the service takes the object type. */
    private static String type(String path) {
        return switch (path) {
            case "requirement" -> TrainingCopyService.REQUIREMENT;
            case "job-assignment" -> TrainingCopyService.JOB;
            default -> throw new IllegalArgumentException("TRAINING_COPY_TYPE_INVALID");
        };
    }
}
