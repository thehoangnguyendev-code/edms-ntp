package com.eqms.controller.training;

import com.eqms.auth.CurrentUserService;
import com.eqms.service.training.TrainingAttendanceListService;
import com.eqms.service.training.TrainingCheckInService;
import com.eqms.service.training.TrainingExamPackService;
import com.eqms.service.training.TrainingPaperService;
import com.eqms.service.training.TrainingRollCallService;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

/** Training held on paper: the delivery mode of a session and the controlled print of its attendance and assessment sheet. */
@RestController
@RequestMapping("/training")
public class TrainingPaperController {
    public record ModeRequest(String mode, String reason) {}
    public record PrintRequest(String reason) {}

    private final TrainingPaperService paper;
    private final TrainingRollCallService rollCalls;
    private final TrainingExamPackService exams;
    private final TrainingCheckInService checkIns;
    private final TrainingAttendanceListService attendanceLists;
    private final CurrentUserService users;

    public TrainingPaperController(TrainingPaperService paper, TrainingRollCallService rollCalls, TrainingExamPackService exams, TrainingCheckInService checkIns, TrainingAttendanceListService attendanceLists, CurrentUserService users) {
        this.attendanceLists = attendanceLists;
        this.checkIns = checkIns;
        this.exams = exams;
        this.paper = paper;
        this.rollCalls = rollCalls;
        this.users = users;
    }

    @GetMapping("/activities/{id}/paper-packs")
    public ResponseEntity<?> packs(@PathVariable UUID id) { return ResponseEntity.ok(paper.packs(users.requireCurrentUser(), id)); }

    /** The attendance list of the activity in the form APD.0117, filled in the Word template that Training Administration enabled; as Word (default) or PDF. */
    @GetMapping("/activities/{id}/attendance-list")
    public ResponseEntity<byte[]> attendanceList(@PathVariable UUID id, @RequestParam(defaultValue = "docx") String format) {
        Map<String, Object> file = attendanceLists.export(users.requireCurrentUser(), id, format);
        return ResponseEntity.ok().contentType(MediaType.parseMediaType((String) file.get("contentType"))).cacheControl(CacheControl.noStore())
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment().filename((String) file.get("name")).build().toString()).body((byte[]) file.get("bytes"));
    }

    @PostMapping("/sessions/{id}/delivery-mode")
    public ResponseEntity<?> mode(@PathVariable UUID id, @RequestBody ModeRequest request) { return ResponseEntity.ok(paper.setDeliveryMode(users.requireCurrentUser(), id, request.mode(), request.reason())); }

    @PostMapping("/sessions/{id}/paper-pack")
    public ResponseEntity<byte[]> print(@PathVariable UUID id, @RequestBody(required = false) PrintRequest request) {
        Map<String, Object> file = paper.print(users.requireCurrentUser(), id, request == null ? null : request.reason());
        return ResponseEntity.ok().contentType(MediaType.APPLICATION_PDF).cacheControl(CacheControl.noStore())
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment().filename((String) file.get("name")).build().toString()).body((byte[]) file.get("bytes"));
    }

    @PostMapping("/sessions/{id}/test-key")
    public ResponseEntity<byte[]> printKey(@PathVariable UUID id) {
        Map<String, Object> file = exams.printKey(users.requireCurrentUser(), id);
        return ResponseEntity.ok().contentType(MediaType.APPLICATION_PDF).cacheControl(CacheControl.noStore())
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment().filename((String) file.get("name")).build().toString()).body((byte[]) file.get("bytes"));
    }

    @PostMapping("/sessions/{id}/exam-pack")
    public ResponseEntity<byte[]> printExam(@PathVariable UUID id, @RequestBody(required = false) PrintRequest request) {
        Map<String, Object> file = exams.print(users.requireCurrentUser(), id, request == null ? null : request.reason());
        return ResponseEntity.ok().contentType(MediaType.APPLICATION_PDF).cacheControl(CacheControl.noStore())
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment().filename((String) file.get("name")).build().toString()).body((byte[]) file.get("bytes"));
    }

    @PostMapping("/sessions/{id}/roll-call")
    public ResponseEntity<?> rollCall(@PathVariable UUID id, @RequestBody TrainingRollCallService.Request request) { return ResponseEntity.ok(rollCalls.rollCall(users.requireCurrentUser(), id, request)); }

    @GetMapping("/sessions/{id}/check-in")
    public ResponseEntity<?> checkInStatus(@PathVariable UUID id) { return ResponseEntity.ok(checkIns.status(users.requireCurrentUser(), id)); }

    @PostMapping("/sessions/{id}/check-in/open")
    public ResponseEntity<?> checkInOpen(@PathVariable UUID id) { return ResponseEntity.ok(checkIns.open(users.requireCurrentUser(), id)); }

    @PostMapping("/sessions/{id}/check-in/close")
    public ResponseEntity<?> checkInClose(@PathVariable UUID id) { return ResponseEntity.ok(checkIns.close(users.requireCurrentUser(), id)); }

    @PostMapping("/me/check-in")
    public ResponseEntity<?> checkIn(@RequestBody TrainingCheckInService.CheckInRequest request) { return ResponseEntity.ok(checkIns.checkIn(users.requireCurrentUser(), request)); }
}
