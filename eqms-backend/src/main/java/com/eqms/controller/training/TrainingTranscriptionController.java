package com.eqms.controller.training;

import com.eqms.auth.CurrentUserService;
import com.eqms.service.training.TrainingTranscriptionService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

/** Results written on paper and typed into the system: typed by one person, checked and signed by another. */
@RestController
@RequestMapping("/training")
public class TrainingTranscriptionController {
    public record VerifyRequest(String signatureToken) {}
    public record RejectRequest(String reason) {}

    private final TrainingTranscriptionService transcriptions;
    private final CurrentUserService users;

    public TrainingTranscriptionController(TrainingTranscriptionService transcriptions, CurrentUserService users) {
        this.transcriptions = transcriptions;
        this.users = users;
    }

    @GetMapping("/activities/{id}/transcriptions")
    public ResponseEntity<?> list(@PathVariable UUID id) { return ResponseEntity.ok(transcriptions.list(users.requireCurrentUser(), id)); }

    @PostMapping("/sessions/{id}/transcriptions")
    public ResponseEntity<?> enter(@PathVariable UUID id, @RequestBody TrainingTranscriptionService.EnterRequest request) { return ResponseEntity.ok(transcriptions.enter(users.requireCurrentUser(), id, request)); }

    @PostMapping("/transcriptions/{id}/verify")
    public ResponseEntity<?> verify(@PathVariable UUID id, @RequestBody VerifyRequest request) { return ResponseEntity.ok(transcriptions.verify(users.requireCurrentUser(), id, request.signatureToken())); }

    @PostMapping("/transcriptions/{id}/reject")
    public ResponseEntity<?> reject(@PathVariable UUID id, @RequestBody RejectRequest request) { return ResponseEntity.ok(transcriptions.reject(users.requireCurrentUser(), id, request.reason())); }
}
