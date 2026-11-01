package com.eqms.controller.training;

import com.eqms.auth.CurrentUserService;
import com.eqms.service.training.TrainingCodeService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/** The rules of the codes of the Training Requirement, the Training Matrix and the Training Assessment, in Training Administration. */
@RestController
@RequestMapping("/training/code-rules")
public class TrainingCodeRuleController {
    private final TrainingCodeService codes;
    private final CurrentUserService users;

    public TrainingCodeRuleController(TrainingCodeService codes, CurrentUserService users) {
        this.codes = codes;
        this.users = users;
    }

    @GetMapping
    public ResponseEntity<?> list(@RequestParam(required = false) String search, @RequestParam(required = false) String entity, @RequestParam(required = false) String changed,
                                  @RequestParam(required = false) String sortBy, @RequestParam(required = false) String sortDirection,
                                  @RequestParam(defaultValue = "1") int page, @RequestParam(defaultValue = "10") int limit) {
        return ResponseEntity.ok(codes.rulesPage(users.requireCurrentUser(), search, entity, changed, sortBy, sortDirection, page, limit));
    }

    @PutMapping("/{entity}")
    public ResponseEntity<?> update(@PathVariable String entity, @RequestBody TrainingCodeService.RuleWrite request) {
        return ResponseEntity.ok(codes.update(users.requireCurrentUser(), entity, request));
    }

    @PostMapping("/preview")
    public ResponseEntity<?> preview(@RequestBody TrainingCodeService.PreviewRequest request) {
        return ResponseEntity.ok(codes.preview(users.requireCurrentUser(), request));
    }
}
