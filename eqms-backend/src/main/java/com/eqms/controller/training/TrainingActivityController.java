package com.eqms.controller.training;

import com.eqms.auth.CurrentUserService;
import com.eqms.service.training.TrainingActivityService;
import com.eqms.service.training.TrainingActivityService.*;
import com.eqms.service.training.TrainingApprovalService;
import com.eqms.service.training.TrainingRows;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

/** Training activities, their sessions and people, and the approval steps. Every command is checked again in the service. */
@RestController
@RequestMapping("/training")
public class TrainingActivityController {
    public record DesignateRequest(String step, UUID assigneeUserId) {}
    public record ReassignRequest(UUID assigneeUserId, String reason) {}
    public record StepRequest(String step, Integer version, String signatureToken) {}

    private final TrainingActivityService activities;
    private final TrainingApprovalService approvals;
    private final CurrentUserService users;

    public TrainingActivityController(TrainingActivityService activities, TrainingApprovalService approvals, CurrentUserService users) {
        this.activities = activities;
        this.approvals = approvals;
        this.users = users;
    }

    @GetMapping("/activities")
    public ResponseEntity<?> list(@RequestParam(required = false) String search, @RequestParam(required = false) String status, @RequestParam(required = false) String kind,
                                  @RequestParam(required = false) UUID departmentId, @RequestParam(required = false) Integer year, @RequestParam(required = false) String documentNumber,
                                  @RequestParam(defaultValue = "false") boolean overdue, @RequestParam(defaultValue = "createdAt") String sortBy,
                                  @RequestParam(defaultValue = "desc") String sortDirection, @RequestParam(defaultValue = "1") int page, @RequestParam(defaultValue = "10") int limit) {
        return ResponseEntity.ok(activities.list(users.requireCurrentUser(), search, status, kind, departmentId, year, documentNumber, overdue, sortBy, sortDirection, page, limit));
    }

    @PostMapping("/activities")
    public ResponseEntity<?> create(@RequestBody CreateRequest request) { return ResponseEntity.ok(activities.create(users.requireCurrentUser(), request)); }

    @GetMapping("/activities/{id}")
    public ResponseEntity<?> get(@PathVariable UUID id) { return ResponseEntity.ok(activities.get(users.requireCurrentUser(), id)); }

    @PutMapping("/activities/{id}")
    public ResponseEntity<?> update(@PathVariable UUID id, @RequestBody UpdateRequest request) { return ResponseEntity.ok(activities.update(users.requireCurrentUser(), id, request)); }

    @PostMapping("/activities/{id}/sessions")
    public ResponseEntity<?> addSession(@PathVariable UUID id, @RequestBody SessionRequest request) { return ResponseEntity.ok(activities.addSession(users.requireCurrentUser(), id, request)); }

    @PostMapping("/activities/{id}/participants")
    public ResponseEntity<?> addParticipants(@PathVariable UUID id, @RequestBody ParticipantsRequest request) { return ResponseEntity.ok(activities.addParticipants(users.requireCurrentUser(), id, request)); }

    @GetMapping("/activities/{id}/sessions/{sessionId}/suggested-participants")
    public ResponseEntity<?> suggested(@PathVariable UUID id, @PathVariable UUID sessionId) {
        return ResponseEntity.ok(Map.of("data", activities.suggestedParticipants(users.requireCurrentUser(), id, sessionId)));
    }

    @PostMapping("/activities/{id}/confirm-list")
    public ResponseEntity<?> confirmList(@PathVariable UUID id, @RequestBody CommandRequest request) { return ResponseEntity.ok(activities.confirmList(users.requireCurrentUser(), id, request)); }

    @GetMapping("/activities/{id}/eligible-approvers")
    public ResponseEntity<?> eligible(@PathVariable UUID id, @RequestParam String step, @RequestParam(required = false) String search,
                                      @RequestParam(defaultValue = "1") int page, @RequestParam(defaultValue = "20") int limit) {
        return ResponseEntity.ok(activities.eligibleApprovers(users.requireCurrentUser(), id, step, search, page, limit));
    }

    @PutMapping("/activities/{id}/approvers")
    public ResponseEntity<?> designate(@PathVariable UUID id, @RequestBody DesignateRequest request) {
        return ResponseEntity.ok(activities.designate(users.requireCurrentUser(), id, request.step(), request.assigneeUserId()));
    }

    @PostMapping("/activities/{id}/approvers/{assignmentId}/reassign")
    public ResponseEntity<?> reassign(@PathVariable UUID id, @PathVariable UUID assignmentId, @RequestBody ReassignRequest request) {
        return ResponseEntity.ok(activities.reassign(users.requireCurrentUser(), id, assignmentId, request.assigneeUserId(), request.reason()));
    }

    @PostMapping("/activities/{id}/confirm-content")
    public ResponseEntity<?> confirmContent(@PathVariable UUID id, @RequestBody StepRequest request) {
        return ResponseEntity.ok(activities.confirmContent(users.requireCurrentUser(), id, request.step(), new CommandRequest(request.version(), null, request.signatureToken())));
    }

    @PostMapping("/activities/{id}/notify")
    public ResponseEntity<?> notifyActivity(@PathVariable UUID id, @RequestBody CommandRequest request) { return ResponseEntity.ok(activities.notifyActivity(users.requireCurrentUser(), id, request)); }

    @PostMapping("/activities/{id}/verify-self-reading")
    public ResponseEntity<?> verifySelfReading(@PathVariable UUID id, @RequestBody CommandRequest request) { return ResponseEntity.ok(activities.verifySelfReading(users.requireCurrentUser(), id, request)); }

    @PostMapping("/activities/{id}/submit-for-confirmation")
    public ResponseEntity<?> submit(@PathVariable UUID id, @RequestBody CommandRequest request) { return ResponseEntity.ok(activities.submitForConfirmation(users.requireCurrentUser(), id, request)); }

    @PostMapping("/activities/{id}/confirm-completion")
    public ResponseEntity<?> complete(@PathVariable UUID id, @RequestBody CommandRequest request) { return ResponseEntity.ok(activities.confirmCompletion(users.requireCurrentUser(), id, request)); }

    @PostMapping("/activities/{id}/cancel")
    public ResponseEntity<?> cancel(@PathVariable UUID id, @RequestBody CommandRequest request) { return ResponseEntity.ok(activities.cancel(users.requireCurrentUser(), id, request)); }

    @PostMapping("/activities/{id}/supplementary")
    public ResponseEntity<?> supplementary(@PathVariable UUID id, @RequestBody SupplementaryRequest request) { return ResponseEntity.ok(activities.supplementary(users.requireCurrentUser(), id, request)); }

    @PostMapping("/sessions/{id}/hold")
    public ResponseEntity<?> hold(@PathVariable UUID id, @RequestBody(required = false) HoldRequest request) { return ResponseEntity.ok(activities.holdSession(users.requireCurrentUser(), id, request)); }

    @PostMapping("/sessions/{id}/postpone")
    public ResponseEntity<?> postpone(@PathVariable UUID id, @RequestBody PostponeRequest request) { return ResponseEntity.ok(activities.postponeSession(users.requireCurrentUser(), id, request)); }

    @PostMapping("/participants/{id}/attendance")
    public ResponseEntity<?> attendance(@PathVariable UUID id, @RequestBody AttendanceRequest request) { return ResponseEntity.ok(activities.recordAttendance(users.requireCurrentUser(), id, request)); }

    @PostMapping("/participants/{id}/assessments")
    public ResponseEntity<?> assessment(@PathVariable UUID id, @RequestBody AssessmentRequest request) { return ResponseEntity.ok(activities.recordAssessment(users.requireCurrentUser(), id, request)); }

    @PostMapping("/me/participations/{id}/confirm-read")
    public ResponseEntity<?> confirmRead(@PathVariable UUID id, @RequestBody CommandRequest request) { return ResponseEntity.ok(activities.confirmRead(users.requireCurrentUser(), id, request)); }

    @GetMapping("/people")
    public ResponseEntity<?> people(@RequestParam(required = false) String search, @RequestParam(defaultValue = "20") int limit) {
        return ResponseEntity.ok(Map.of("data", activities.people(users.requireCurrentUser(), search, limit)));
    }

    @GetMapping("/me/approvals")
    public ResponseEntity<?> myApprovals() { return ResponseEntity.ok(Map.of("data", TrainingRows.camel(approvals.myApprovals(users.requireCurrentUser())))); }
}
