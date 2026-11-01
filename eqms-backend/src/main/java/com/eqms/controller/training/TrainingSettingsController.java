package com.eqms.controller.training;

import com.eqms.auth.CurrentUserService;
import com.eqms.service.training.TrainingSettingsService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/** The settings of Training Management, in Training Administration. */
@RestController
@RequestMapping("/training/settings")
public class TrainingSettingsController {
    private final TrainingSettingsService settings;
    private final CurrentUserService users;

    public TrainingSettingsController(TrainingSettingsService settings, CurrentUserService users) {
        this.settings = settings;
        this.users = users;
    }

    @GetMapping
    public ResponseEntity<?> get() { return ResponseEntity.ok(settings.get(users.requireCurrentUser())); }

    /** The counters of the Training Numbers of each department and year. */
    @GetMapping("/number-counters")
    public ResponseEntity<?> numberCounters(@RequestParam(defaultValue = "1") int page, @RequestParam(defaultValue = "10") int limit) {
        return ResponseEntity.ok(settings.numberCounters(users.requireCurrentUser(), page, limit));
    }

    /** Raises a counter to the last serial of the paper log (it never goes down). */
    @PostMapping("/number-counters/raise")
    public ResponseEntity<?> raiseNumberCounter(@RequestBody TrainingSettingsService.NumberCounterRaise request) {
        return ResponseEntity.ok(settings.raiseNumberCounter(users.requireCurrentUser(), request));
    }

    @PutMapping
    public ResponseEntity<?> update(@RequestBody TrainingSettingsService.SettingsWrite request) {
        return ResponseEntity.ok(settings.update(users.requireCurrentUser(), request));
    }
}
