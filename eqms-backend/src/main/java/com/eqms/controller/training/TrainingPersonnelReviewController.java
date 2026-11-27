package com.eqms.controller.training;

import com.eqms.auth.CurrentUserService;
import com.eqms.service.training.TrainingPersonnelReviewService;
import com.eqms.service.training.TrainingPersonnelReviewService.*;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

/** Training reviews after an event of a person (new employee, return after absence, transfer): a checklist worked by people, closed with a signature. */
@RestController
@RequestMapping("/training/personnel-reviews")
public class TrainingPersonnelReviewController {
    private final TrainingPersonnelReviewService reviews;
    private final CurrentUserService users;

    public TrainingPersonnelReviewController(TrainingPersonnelReviewService reviews, CurrentUserService users) {
        this.reviews = reviews;
        this.users = users;
    }

    @GetMapping
    public ResponseEntity<?> list(@RequestParam(required = false) String status, @RequestParam(required = false) String kind, @RequestParam(required = false) String search,
                                  @RequestParam(required = false) String sortBy, @RequestParam(required = false) String sortDirection,
                                  @RequestParam(defaultValue = "1") int page, @RequestParam(defaultValue = "10") int limit,
                                  @RequestParam Map<String, String> filters) {
        return ResponseEntity.ok(reviews.list(users.requireCurrentUser(), status, kind, search, sortBy, sortDirection, page, limit, filters));
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> get(@PathVariable UUID id) { return ResponseEntity.ok(reviews.open(users.requireCurrentUser(), id)); }

    @PostMapping
    public ResponseEntity<?> create(@RequestBody CreateRequest request) { return ResponseEntity.ok(reviews.create(users.requireCurrentUser(), request)); }

    @PutMapping("/{id}/items/{item}")
    public ResponseEntity<?> item(@PathVariable UUID id, @PathVariable String item, @RequestBody ItemRequest request) { return ResponseEntity.ok(reviews.updateItem(users.requireCurrentUser(), id, item, request)); }

    @PutMapping("/{id}/job-roles")
    public ResponseEntity<?> jobRoles(@PathVariable UUID id, @RequestBody JobRolesRequest request) { return ResponseEntity.ok(reviews.setJobRoles(users.requireCurrentUser(), id, request)); }

    @GetMapping("/{id}/requirements")
    public ResponseEntity<?> requirements(@PathVariable UUID id) { return ResponseEntity.ok(reviews.requirementChoices(users.requireCurrentUser(), id)); }

    @PutMapping("/{id}/retraining")
    public ResponseEntity<?> retraining(@PathVariable UUID id, @RequestBody RetrainRequest request) { return ResponseEntity.ok(reviews.setRetraining(users.requireCurrentUser(), id, request)); }

    @GetMapping("/{id}/classes")
    public ResponseEntity<?> classes(@PathVariable UUID id) { return ResponseEntity.ok(reviews.classes(users.requireCurrentUser(), id)); }

    @PostMapping("/{id}/classes/{activityId}/add")
    public ResponseEntity<?> addToClass(@PathVariable UUID id, @PathVariable UUID activityId) { return ResponseEntity.ok(reviews.addToClass(users.requireCurrentUser(), id, activityId)); }

    @PostMapping("/{id}/classes")
    public ResponseEntity<?> createClass(@PathVariable UUID id, @RequestBody(required = false) ClassRequest request) { return ResponseEntity.ok(reviews.createClass(users.requireCurrentUser(), id, request)); }

    @GetMapping("/plan")
    public ResponseEntity<?> plan(@RequestParam UUID personId, @RequestParam(required = false) String kind, @RequestParam(required = false) String departmentTo) {
        return ResponseEntity.ok(reviews.plan(users.requireCurrentUser(), personId, kind, departmentTo));
    }

    @GetMapping("/closers")
    public ResponseEntity<?> closers() { return ResponseEntity.ok(Map.of("data", reviews.closers(users.requireCurrentUser()))); }

    @GetMapping("/eligible-closers")
    public ResponseEntity<?> eligibleClosers(@RequestParam UUID personId, @RequestParam(required = false) String search, @RequestParam(defaultValue = "1") int page, @RequestParam(defaultValue = "20") int limit) {
        return ResponseEntity.ok(reviews.eligibleClosers(users.requireCurrentUser(), personId, search, page, limit));
    }

    @PutMapping("/{id}/closer")
    public ResponseEntity<?> changeCloser(@PathVariable UUID id, @RequestBody ChangeCloserRequest request) { return ResponseEntity.ok(reviews.changeCloser(users.requireCurrentUser(), id, request)); }

    @PostMapping("/{id}/close")
    public ResponseEntity<?> close(@PathVariable UUID id, @RequestBody CloseRequest request) { return ResponseEntity.ok(reviews.close(users.requireCurrentUser(), id, request)); }

    @PostMapping("/{id}/cancel")
    public ResponseEntity<?> cancel(@PathVariable UUID id, @RequestBody CancelRequest request) { return ResponseEntity.ok(reviews.cancel(users.requireCurrentUser(), id, request)); }
}
