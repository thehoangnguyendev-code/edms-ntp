package com.eqms.controller.training;

import com.eqms.auth.CurrentUserService;
import com.eqms.service.training.TrainingCalendarService;
import com.eqms.service.training.TrainingSettingsService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/** The settings of Training Management, in Training Administration. */
@RestController
@RequestMapping("/training/settings")
public class TrainingSettingsController {
    private final TrainingSettingsService settings;
    private final TrainingCalendarService calendar;
    private final CurrentUserService users;
    public record DayRequest(java.time.LocalDate day, String name, String reason) {}
    public record RemoveRequest(String reason) {}

    public TrainingSettingsController(TrainingSettingsService settings, TrainingCalendarService calendar, CurrentUserService users) {
        this.calendar = calendar;
        this.settings = settings;
        this.users = users;
    }

    @GetMapping
    public ResponseEntity<?> get() { return ResponseEntity.ok(settings.get(users.requireCurrentUser())); }

    @PutMapping
    public ResponseEntity<?> update(@RequestBody TrainingSettingsService.SettingsWrite request) {
        return ResponseEntity.ok(settings.update(users.requireCurrentUser(), request));
    }

    @GetMapping("/non-working-days")
    public ResponseEntity<?> days(@RequestParam(required = false) Integer year) { return ResponseEntity.ok(calendar.list(users.requireCurrentUser(), year)); }

    @PostMapping("/non-working-days")
    public ResponseEntity<?> addDay(@RequestBody DayRequest request) { return ResponseEntity.ok(calendar.add(users.requireCurrentUser(), request.day(), request.name(), request.reason())); }

    @DeleteMapping("/non-working-days/{day}")
    public ResponseEntity<?> removeDay(@PathVariable java.time.LocalDate day, @RequestBody RemoveRequest request) { return ResponseEntity.ok(calendar.remove(users.requireCurrentUser(), day, request.reason())); }
}
