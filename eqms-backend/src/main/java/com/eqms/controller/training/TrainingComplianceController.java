package com.eqms.controller.training;

import com.eqms.auth.CurrentUserService;
import com.eqms.service.training.TrainingComplianceService;
import com.eqms.service.training.TrainingMatrixCompletionService;
import com.eqms.service.training.TrainingPrintService;
import org.springframework.http.*;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

/** Training compliance of a department: coverage of the effective matrix and what is overdue. */
@RestController
@RequestMapping("/training/compliance")
public class TrainingComplianceController {
    private final TrainingComplianceService compliance;
    private final TrainingMatrixCompletionService completion;
    private final TrainingPrintService prints;
    private final CurrentUserService users;

    public TrainingComplianceController(TrainingComplianceService compliance, TrainingMatrixCompletionService completion, TrainingPrintService prints, CurrentUserService users) {
        this.prints = prints;
        this.compliance = compliance;
        this.completion = completion;
        this.users = users;
    }

    @GetMapping("/summary")
    public ResponseEntity<?> summary(@RequestParam(required = false) UUID departmentId) { return ResponseEntity.ok(compliance.summary(users.requireCurrentUser(), departmentId)); }

    @GetMapping("/coverage")
    public ResponseEntity<?> coverage(@RequestParam(required = false) UUID departmentId, @RequestParam(required = false) String status, @RequestParam(defaultValue = "false") boolean newOnly, @RequestParam(required = false) String search,
                                      @RequestParam(required = false) String sortBy, @RequestParam(required = false) String sortDirection,
                                  @RequestParam(defaultValue = "1") int page, @RequestParam(defaultValue = "10") int limit) {
        return ResponseEntity.ok(compliance.coverage(users.requireCurrentUser(), departmentId, status, newOnly, search, sortBy, sortDirection, page, limit));
    }

    /** The training activities that are planned for a training, to add people to one of them. */
    @GetMapping("/planned-trainings")
    public ResponseEntity<?> plannedTrainings(@RequestParam(required = false) String topicName, @RequestParam(required = false) String documentNumber) {
        return ResponseEntity.ok(java.util.Map.of("data", compliance.plannedTrainings(users.requireCurrentUser(), topicName, documentNumber)));
    }

    @GetMapping("/positions")
    public ResponseEntity<?> positions(@RequestParam(required = false) UUID departmentId) { return ResponseEntity.ok(completion.positions(users.requireCurrentUser(), departmentId)); }

    @GetMapping("/matrix-completion")
    public ResponseEntity<?> matrixCompletion(@RequestParam(required = false) UUID departmentId, @RequestParam UUID positionId, @RequestParam(required = false) String search,
                                              @RequestParam(required = false) String status, @RequestParam(defaultValue = "false") boolean gapsOnly,
                                              @RequestParam(defaultValue = "1") int page, @RequestParam(defaultValue = "20") int limit,
                                              @RequestParam(defaultValue = "1") int columnPage, @RequestParam(defaultValue = "12") int columnLimit) {
        return ResponseEntity.ok(completion.completion(users.requireCurrentUser(), departmentId, positionId, search, status, gapsOnly, page, limit, columnPage, columnLimit));
    }

    @GetMapping("/matrix-completion/cell")
    public ResponseEntity<?> cell(@RequestParam(required = false) UUID departmentId, @RequestParam UUID personId, @RequestParam UUID rowId) {
        return ResponseEntity.ok(completion.cellDetail(users.requireCurrentUser(), departmentId, personId, rowId));
    }

    @GetMapping("/matrix-completion/print")
    public ResponseEntity<byte[]> printCompletion(@RequestParam(required = false) UUID departmentId, @RequestParam UUID positionId, @RequestParam(required = false) String search,
                                                  @RequestParam(required = false) String status, @RequestParam(defaultValue = "false") boolean gapsOnly) {
        java.util.Map<String, Object> file = prints.completion(users.requireCurrentUser(), departmentId, positionId, search, status, gapsOnly);
        return ResponseEntity.ok().contentType(MediaType.APPLICATION_PDF).cacheControl(CacheControl.noStore())
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment().filename((String) file.get("name")).build().toString()).body((byte[]) file.get("bytes"));
    }
}
