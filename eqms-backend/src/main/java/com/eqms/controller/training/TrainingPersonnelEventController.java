package com.eqms.controller.training;

import com.eqms.auth.CurrentUserService;
import com.eqms.service.training.TrainingPersonnelEventService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

/** The alerts that tell people that SOP.0003 asks for training after an event (a new employee, a return, a transfer, a change of position). */
@RestController
@RequestMapping("/training/personnel-events")
public class TrainingPersonnelEventController {
    private final TrainingPersonnelEventService events;
    private final CurrentUserService users;

    public TrainingPersonnelEventController(TrainingPersonnelEventService events, CurrentUserService users) {
        this.events = events;
        this.users = users;
    }

    @GetMapping
    public ResponseEntity<?> list(@RequestParam(required = false) String status, @RequestParam(required = false) String kind, @RequestParam(required = false) String search,
                                  @RequestParam(required = false) String sortBy, @RequestParam(required = false) String sortDirection,
                                  @RequestParam(defaultValue = "1") int page, @RequestParam(defaultValue = "20") int limit,
                                  @RequestParam Map<String, String> filters) {
        return ResponseEntity.ok(events.list(users.requireCurrentUser(), status, kind, search, sortBy, sortDirection, page, limit, filters));
    }

    @PostMapping("/scan")
    public ResponseEntity<?> scan() { return ResponseEntity.ok(events.scanNow(users.requireCurrentUser())); }

    @GetMapping("/count")
    public ResponseEntity<?> count() { return ResponseEntity.ok(Map.of("open", events.openCount(users.requireCurrentUser()))); }

    @PostMapping("/{id}/dismiss")
    public ResponseEntity<?> dismiss(@PathVariable UUID id, @RequestBody TrainingPersonnelEventService.DismissRequest request) { return ResponseEntity.ok(events.dismiss(users.requireCurrentUser(), id, request)); }
}
