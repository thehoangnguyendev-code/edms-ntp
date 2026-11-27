package com.eqms.controller.training;

import com.eqms.auth.CurrentUserService;
import com.eqms.service.training.TrainingReviewTemplateService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

/** The checklist template of the personnel training reviews (the items that are not training lines of the matrix). */
@RestController
@RequestMapping("/training/review-templates")
public class TrainingReviewTemplateController {
    private final TrainingReviewTemplateService templates;
    private final CurrentUserService users;

    public TrainingReviewTemplateController(TrainingReviewTemplateService templates, CurrentUserService users) {
        this.templates = templates;
        this.users = users;
    }

    @GetMapping
    public ResponseEntity<?> list(@RequestParam(required = false) String kind, @RequestParam(required = false) String search, @RequestParam(required = false) String sortBy,
                                  @RequestParam(required = false) String sortDirection, @RequestParam(defaultValue = "1") int page, @RequestParam(defaultValue = "10") int limit) {
        return ResponseEntity.ok(templates.list(users.requireCurrentUser(), kind, search, sortBy, sortDirection, page, limit));
    }

    @PostMapping
    public ResponseEntity<?> create(@RequestBody TrainingReviewTemplateService.Write request) { return ResponseEntity.ok(templates.create(users.requireCurrentUser(), request)); }

    @PutMapping("/{id}")
    public ResponseEntity<?> update(@PathVariable UUID id, @RequestBody TrainingReviewTemplateService.Write request) { return ResponseEntity.ok(templates.update(users.requireCurrentUser(), id, request)); }
}
