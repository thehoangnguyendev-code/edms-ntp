package com.eqms.controller.training;

import com.eqms.auth.CurrentUserService;
import com.eqms.service.training.TrainingComplianceService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

/** Training compliance of a department: coverage of the effective matrix and what is overdue. */
@RestController
@RequestMapping("/training/compliance")
public class TrainingComplianceController {
    private final TrainingComplianceService compliance;
    private final CurrentUserService users;

    public TrainingComplianceController(TrainingComplianceService compliance, CurrentUserService users) {
        this.compliance = compliance;
        this.users = users;
    }

    @GetMapping("/summary")
    public ResponseEntity<?> summary(@RequestParam(required = false) UUID departmentId) { return ResponseEntity.ok(compliance.summary(users.requireCurrentUser(), departmentId)); }

    @GetMapping("/coverage")
    public ResponseEntity<?> coverage(@RequestParam(required = false) UUID departmentId, @RequestParam(required = false) String status, @RequestParam(required = false) String search,
                                      @RequestParam(defaultValue = "1") int page, @RequestParam(defaultValue = "10") int limit) {
        return ResponseEntity.ok(compliance.coverage(users.requireCurrentUser(), departmentId, status, search, page, limit));
    }
}
