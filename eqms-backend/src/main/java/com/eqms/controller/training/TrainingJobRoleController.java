package com.eqms.controller.training;

import com.eqms.auth.CurrentUserService;
import com.eqms.service.training.TrainingJobRoleService;
import com.eqms.service.training.TrainingJobRoleService.SaveRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

/** Job Roles of Training (the columns of the matrix, what a job assignment gives). Every command is checked again in the service. */
@RestController
@RequestMapping("/training/job-roles")
public class TrainingJobRoleController {
    private final TrainingJobRoleService roles;
    private final CurrentUserService users;

    public TrainingJobRoleController(TrainingJobRoleService roles, CurrentUserService users) {
        this.roles = roles;
        this.users = users;
    }

    @GetMapping
    public ResponseEntity<?> list(@RequestParam(required = false) String search, @RequestParam(required = false) String status,
                                  @RequestParam(required = false) UUID departmentId, @RequestParam(required = false) UUID titlePositionId,
                                  @RequestParam(required = false) String sortBy, @RequestParam(required = false) String sortDirection,
                                  @RequestParam(defaultValue = "1") int page, @RequestParam(defaultValue = "10") int limit) {
        return ResponseEntity.ok(roles.list(users.requireCurrentUser(), search, status, departmentId, titlePositionId, sortBy, sortDirection, page, limit));
    }

    @GetMapping("/options")
    public ResponseEntity<?> options(@RequestParam(required = false) UUID departmentId) {
        return ResponseEntity.ok(Map.of("data", roles.options(users.requireCurrentUser(), departmentId)));
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> get(@PathVariable UUID id) { return ResponseEntity.ok(roles.get(users.requireCurrentUser(), id)); }

    @PostMapping
    public ResponseEntity<?> create(@RequestBody SaveRequest request) { return ResponseEntity.ok(roles.save(users.requireCurrentUser(), null, request)); }

    @PutMapping("/{id}")
    public ResponseEntity<?> update(@PathVariable UUID id, @RequestBody SaveRequest request) { return ResponseEntity.ok(roles.save(users.requireCurrentUser(), id, request)); }
}
