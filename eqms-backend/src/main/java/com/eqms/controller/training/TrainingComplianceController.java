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
    public ResponseEntity<?> coverage(@RequestParam(required = false) UUID departmentId, @RequestParam(required = false) String status, @RequestParam(required = false) String search,
                                      @RequestParam(defaultValue = "1") int page, @RequestParam(defaultValue = "10") int limit) {
        return ResponseEntity.ok(compliance.coverage(users.requireCurrentUser(), departmentId, status, search, page, limit));
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

    @GetMapping("/matrix-completion/print")
    public ResponseEntity<byte[]> printCompletion(@RequestParam(required = false) UUID departmentId, @RequestParam UUID positionId, @RequestParam(required = false) String search,
                                                  @RequestParam(required = false) String status, @RequestParam(defaultValue = "false") boolean gapsOnly) {
        java.util.Map<String, Object> file = prints.completion(users.requireCurrentUser(), departmentId, positionId, search, status, gapsOnly);
        return ResponseEntity.ok().contentType(MediaType.APPLICATION_PDF).cacheControl(CacheControl.noStore())
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment().filename((String) file.get("name")).build().toString()).body((byte[]) file.get("bytes"));
    }
}
