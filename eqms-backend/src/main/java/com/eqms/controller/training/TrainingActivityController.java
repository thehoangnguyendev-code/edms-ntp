package com.eqms.controller.training;

import com.eqms.auth.CurrentUserService;
import com.eqms.service.training.TrainingActivityService;
import com.eqms.service.training.TrainingActivityService.*;
import com.eqms.service.training.TrainingApprovalService;
import com.eqms.service.training.TrainingRows;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
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
                                  @RequestParam(defaultValue = "false") boolean overdue,
                                  @RequestParam(required = false) String method, @RequestParam(required = false) String kindReason, @RequestParam(required = false) Boolean onPaper,
                                  @RequestParam(required = false) String scheduledFrom, @RequestParam(required = false) String scheduledTo,
                                  @RequestParam(required = false) String dueFrom, @RequestParam(required = false) String dueTo,
                                  @RequestParam(required = false) String createdFrom, @RequestParam(required = false) String createdTo,
                                  @RequestParam(defaultValue = "createdAt") String sortBy,
                                  @RequestParam(defaultValue = "desc") String sortDirection, @RequestParam(defaultValue = "1") int page, @RequestParam(defaultValue = "10") int limit) {
        return ResponseEntity.ok(activities.list(users.requireCurrentUser(), search, status, kind, departmentId, year, documentNumber, overdue,
                new TrainingActivityService.ListFilters(method, kindReason, onPaper, scheduledFrom, scheduledTo, dueFrom, dueTo, createdFrom, createdTo), sortBy, sortDirection, page, limit));
    }

    @PostMapping("/activities")
    public ResponseEntity<?> create(@RequestBody CreateRequest request) { return ResponseEntity.ok(activities.create(users.requireCurrentUser(), request)); }

    @GetMapping("/activities/{id}")
    public ResponseEntity<?> get(@PathVariable UUID id) { return ResponseEntity.ok(activities.get(users.requireCurrentUser(), id)); }

    @GetMapping("/activities/{id}/overview")
    public ResponseEntity<?> overview(@PathVariable UUID id, @RequestParam(required = false) UUID sessionId,
            @RequestParam(defaultValue = "false") boolean participantContext) {
        return ResponseEntity.ok(activities.overview(users.requireCurrentUser(), id, sessionId, participantContext));
    }

    @GetMapping("/activities/{id}/participants")
    public ResponseEntity<?> participantPage(@PathVariable UUID id, @RequestParam(required = false) UUID sessionId,
            @RequestParam(defaultValue = "ALL") String group, @RequestParam(required = false) String search,
            @RequestParam(defaultValue = "1") int page, @RequestParam(defaultValue = "10") int limit,
            @RequestParam(required = false) String sortBy, @RequestParam(required = false) String sortDirection) {
        return ResponseEntity.ok(activities.participantPage(users.requireCurrentUser(), id, sessionId, group, search, page, limit, sortBy, sortDirection));
    }

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

    @PostMapping("/activities/{id}/send-attendance-list")
    public ResponseEntity<?> sendAttendanceList(@PathVariable UUID id, @RequestBody CommandRequest request) { return ResponseEntity.ok(activities.sendAttendanceList(users.requireCurrentUser(), id, request)); }

    @PostMapping("/activities/{id}/finish-training")
    public ResponseEntity<?> finishTraining(@PathVariable UUID id, @RequestBody CommandRequest request) { return ResponseEntity.ok(activities.finishTraining(users.requireCurrentUser(), id, request)); }


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

    @PostMapping("/participants/{id}/remove")
    public ResponseEntity<?> removeParticipant(@PathVariable UUID id, @RequestBody ReasonRequest request) { return ResponseEntity.ok(activities.removeParticipant(users.requireCurrentUser(), id, request)); }

    @PostMapping("/participants/{id}/planned-absence")
    public ResponseEntity<?> plannedAbsence(@PathVariable UUID id, @RequestBody ReasonRequest request) { return ResponseEntity.ok(activities.setPlannedAbsence(users.requireCurrentUser(), id, request)); }

    @PostMapping("/participants/{id}/attendance/correct")
    public ResponseEntity<?> correctAttendance(@PathVariable UUID id, @RequestBody TrainingActivityService.CorrectionRequest request) { return ResponseEntity.ok(activities.correctAttendance(users.requireCurrentUser(), id, request)); }

    @PostMapping("/participants/{id}/participation")
    public ResponseEntity<?> participation(@PathVariable UUID id, @RequestBody TrainingActivityService.ParticipationRequest request) { return ResponseEntity.ok(activities.setParticipation(users.requireCurrentUser(), id, request)); }

    @PostMapping("/participants/{id}/attendance")
    public ResponseEntity<?> attendance(@PathVariable UUID id, @RequestBody AttendanceRequest request) { return ResponseEntity.ok(activities.recordAttendance(users.requireCurrentUser(), id, request)); }

    @PostMapping("/participants/{id}/assessments")
    public ResponseEntity<?> assessment(@PathVariable UUID id, @RequestBody AssessmentRequest request) { return ResponseEntity.ok(activities.recordAssessment(users.requireCurrentUser(), id, request)); }

    @PostMapping("/me/participations/{id}/confirm-read")
    public ResponseEntity<?> confirmRead(@PathVariable UUID id, @RequestBody CommandRequest request) { return ResponseEntity.ok(activities.confirmRead(users.requireCurrentUser(), id, request)); }

    @PutMapping("/sessions/{sessionId}")
    public ResponseEntity<?> updateSession(@PathVariable UUID sessionId, @RequestBody SessionUpdateRequest request) { return ResponseEntity.ok(activities.updateSession(users.requireCurrentUser(), sessionId, request)); }

    @PostMapping("/activities/{id}/content-exemptions")
    public ResponseEntity<?> contentExemptions(@PathVariable UUID id, @RequestBody TrainingActivityService.ExemptionRequest request) { return ResponseEntity.ok(activities.setContentExemptions(users.requireCurrentUser(), id, request)); }

    @PostMapping("/activities/{id}/reopen-content")
    public ResponseEntity<?> reopenContent(@PathVariable UUID id, @RequestBody CommandRequest request) { return ResponseEntity.ok(activities.reopenContent(users.requireCurrentUser(), id, request)); }

    @PostMapping("/activities/{id}/return-for-correction")
    public ResponseEntity<?> returnForCorrection(@PathVariable UUID id, @RequestBody CommandRequest request) { return ResponseEntity.ok(activities.returnForCorrection(users.requireCurrentUser(), id, request)); }

    @GetMapping("/people/groups")
    public ResponseEntity<?> peopleGroups(@RequestParam String by) {
        return ResponseEntity.ok(Map.of("data", activities.peopleGroups(users.requireCurrentUser(), by)));
    }

    @GetMapping("/people/in-groups")
    public ResponseEntity<?> peopleInGroups(@RequestParam String by, @RequestParam List<String> names) {
        return ResponseEntity.ok(Map.of("data", activities.peopleInGroups(users.requireCurrentUser(), by, names)));
    }

    @GetMapping("/people")
    public ResponseEntity<?> people(@RequestParam(required = false) String search, @RequestParam(defaultValue = "20") int limit) {
        return ResponseEntity.ok(Map.of("data", activities.people(users.requireCurrentUser(), search, limit)));
    }

    @GetMapping("/me/approvals")
    public ResponseEntity<?> myApprovals() { return ResponseEntity.ok(Map.of("data", TrainingRows.camel(approvals.myApprovals(users.requireCurrentUser())))); }
}
