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

    @GetMapping("/suggestions")
    public ResponseEntity<?> suggestions() { return ResponseEntity.ok(reviews.suggestions(users.requireCurrentUser())); }

    @GetMapping("/{id}/matrix-gaps")
    public ResponseEntity<?> matrixGaps(@PathVariable UUID id) { return ResponseEntity.ok(reviews.matrixGaps(users.requireCurrentUser(), id)); }

    @GetMapping("/{id}")
    public ResponseEntity<?> get(@PathVariable UUID id) { return ResponseEntity.ok(reviews.get(users.requireCurrentUser(), id)); }

    @PostMapping
    public ResponseEntity<?> create(@RequestBody CreateRequest request) { return ResponseEntity.ok(reviews.create(users.requireCurrentUser(), request)); }

    @PutMapping("/{id}/items/{item}")
    public ResponseEntity<?> item(@PathVariable UUID id, @PathVariable String item, @RequestBody ItemRequest request) { return ResponseEntity.ok(reviews.updateItem(users.requireCurrentUser(), id, item, request)); }

    @PostMapping("/{id}/items/{item}/training")
    public ResponseEntity<?> createTraining(@PathVariable UUID id, @PathVariable String item) { return ResponseEntity.ok(reviews.createActivity(users.requireCurrentUser(), id, item)); }

    @GetMapping("/plan")
    public ResponseEntity<?> plan(@RequestParam UUID personId, @RequestParam(required = false) String kind, @RequestParam(required = false) String departmentTo) {
        return ResponseEntity.ok(reviews.plan(users.requireCurrentUser(), personId, kind, departmentTo));
    }

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
