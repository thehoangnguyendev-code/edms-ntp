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

    @PutMapping
    public ResponseEntity<?> update(@RequestBody TrainingSettingsService.SettingsWrite request) {
        return ResponseEntity.ok(settings.update(users.requireCurrentUser(), request));
    }
}
