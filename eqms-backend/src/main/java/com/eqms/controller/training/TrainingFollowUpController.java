package com.eqms.controller.training;

import com.eqms.auth.CurrentUserService;
import com.eqms.service.training.TrainingImpactService;
import com.eqms.service.training.TrainingImpactService.AssessRequest;
import com.eqms.service.training.TrainingRetentionService;
import com.eqms.service.training.TrainingSuspensionService;
import com.eqms.service.training.TrainingSuspensionService.ResumeRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

/** The follow-up of SOP.0003 that the people have to see: work suspended after a failed assessment, how long records are kept, and the effect of a new document on the matrix. */
@RestController
@RequestMapping("/training")
public class TrainingFollowUpController {
    private final TrainingSuspensionService suspensions;
    private final TrainingRetentionService retention;
    private final TrainingImpactService impacts;
    private final CurrentUserService users;

    public TrainingFollowUpController(TrainingSuspensionService suspensions, TrainingRetentionService retention, TrainingImpactService impacts, CurrentUserService users) {
        this.suspensions = suspensions;
        this.retention = retention;
        this.impacts = impacts;
        this.users = users;
    }

    @GetMapping("/compliance/suspensions")
    public ResponseEntity<?> suspensions(@RequestParam(required = false) UUID departmentId, @RequestParam(required = false) String status, @RequestParam(required = false) String search,
                                         @RequestParam(required = false) String sortBy, @RequestParam(required = false) String sortDirection,
                                         @RequestParam(defaultValue = "1") int page, @RequestParam(defaultValue = "10") int limit) {
        return ResponseEntity.ok(suspensions.list(users.requireCurrentUser(), departmentId, status, search, sortBy, sortDirection, page, limit));
    }

    @PostMapping("/compliance/suspensions/{id}/resume")
    public ResponseEntity<?> resume(@PathVariable UUID id, @RequestBody ResumeRequest request) { return ResponseEntity.ok(suspensions.resume(users.requireCurrentUser(), id, request)); }

    @GetMapping("/compliance/retention")
    public ResponseEntity<?> retention(@RequestParam(required = false) UUID departmentId, @RequestParam(required = false) String state, @RequestParam(required = false) String search,
                                       @RequestParam(required = false) String sortBy, @RequestParam(required = false) String sortDirection,
                                       @RequestParam(defaultValue = "1") int page, @RequestParam(defaultValue = "10") int limit) {
        return ResponseEntity.ok(retention.list(users.requireCurrentUser(), departmentId, state, search, sortBy, sortDirection, page, limit));
    }

    @GetMapping("/document-trainings")
    public ResponseEntity<?> documentTrainings(@RequestParam(required = false) UUID departmentId, @RequestParam(required = false) String status, @RequestParam(required = false) String search,
                                               @RequestParam(required = false) String sortBy, @RequestParam(required = false) String sortDirection,
                                               @RequestParam(defaultValue = "1") int page, @RequestParam(defaultValue = "10") int limit) {
        return ResponseEntity.ok(impacts.list(users.requireCurrentUser(), departmentId, status, search, sortBy, sortDirection, page, limit));
    }

    @GetMapping("/document-trainings/summary")
    public ResponseEntity<?> documentTrainingsSummary(@RequestParam(required = false) UUID departmentId) { return ResponseEntity.ok(impacts.summary(users.requireCurrentUser(), departmentId)); }

    @GetMapping("/activities/{id}/impact-assessment")
    public ResponseEntity<?> impactContext(@PathVariable UUID id) { return ResponseEntity.ok(impacts.context(users.requireCurrentUser(), id)); }

    @PostMapping("/activities/{id}/impact-assessment")
    public ResponseEntity<?> assess(@PathVariable UUID id, @RequestBody AssessRequest request) { return ResponseEntity.ok(impacts.assess(users.requireCurrentUser(), id, request)); }
}
