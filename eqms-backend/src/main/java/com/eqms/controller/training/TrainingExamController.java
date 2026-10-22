package com.eqms.controller.training;

import com.eqms.auth.CurrentUserService;
import com.eqms.service.training.TrainingExamService;
import com.eqms.service.training.TrainingExamService.*;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

/** The test of APD.0009 in the system: written by the trainer, taken and signed by the trainee, graded by the server. */
@RestController
@RequestMapping("/training")
public class TrainingExamController {
    private final TrainingExamService exams;
    private final CurrentUserService users;

    public TrainingExamController(TrainingExamService exams, CurrentUserService users) {
        this.exams = exams;
        this.users = users;
    }

    @GetMapping("/activities/{id}/exam")
    public ResponseEntity<?> get(@PathVariable UUID id) { return ResponseEntity.ok(exams.get(users.requireCurrentUser(), id)); }

    @PutMapping("/activities/{id}/exam")
    public ResponseEntity<?> save(@PathVariable UUID id, @RequestBody SaveRequest request) { return ResponseEntity.ok(exams.save(users.requireCurrentUser(), id, request)); }

    @GetMapping("/me/participations/{participantId}/exam")
    public ResponseEntity<?> mine(@PathVariable UUID participantId) { return ResponseEntity.ok(exams.mine(users.requireCurrentUser(), participantId)); }

    @PostMapping("/me/participations/{participantId}/exam/start")
    public ResponseEntity<?> start(@PathVariable UUID participantId) { return ResponseEntity.ok(exams.start(users.requireCurrentUser(), participantId)); }

    @PostMapping("/exam-attempts/{attemptId}/submit")
    public ResponseEntity<?> submit(@PathVariable UUID attemptId, @RequestBody SubmitRequest request) { return ResponseEntity.ok(exams.submit(users.requireCurrentUser(), attemptId, request)); }

    @PostMapping("/participants/{participantId}/exam/release")
    public ResponseEntity<?> release(@PathVariable UUID participantId, @RequestBody ResetRequest request) { return ResponseEntity.ok(exams.release(users.requireCurrentUser(), participantId, request)); }
}
