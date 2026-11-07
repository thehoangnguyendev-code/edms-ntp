package com.eqms.controller.training;

import com.eqms.auth.CurrentUserService;
import com.eqms.service.training.TrainingDocumentIntegrationService;
import com.eqms.service.training.TrainingNumberService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

/** Manual Training Numbers (Document Properties > Training Number entry = MANUAL): the live check of a typed number, and the change of a number that has not opened. */
@RestController
@RequestMapping("/training/numbers")
public class TrainingNumberController {
    private final TrainingNumberService numbers;
    private final TrainingDocumentIntegrationService integration;
    private final CurrentUserService users;

    public TrainingNumberController(TrainingNumberService numbers, TrainingDocumentIntegrationService integration, CurrentUserService users) {
        this.numbers = numbers;
        this.integration = integration;
        this.users = users;
    }

    /** How a Training Number is given (Training Properties); the document screens ask it to know whether to show the box. */
    @GetMapping("/mode")
    public ResponseEntity<Map<String, String>> mode() {
        users.requireCurrentUser();
        return ResponseEntity.ok(Map.of("mode", integration.entryMode()));
    }

    @GetMapping("/check")
    public ResponseEntity<TrainingNumberService.Check> check(@RequestParam(required = false) UUID departmentId,
                                                             @RequestParam(required = false) String number,
                                                             @RequestParam(required = false) UUID excludeActivityId) {
        users.requireCurrentUser();
        return ResponseEntity.ok(numbers.check(departmentId, number, excludeActivityId));
    }

    @GetMapping("/activities/{id}/state")
    public ResponseEntity<TrainingDocumentIntegrationService.NumberState> state(@PathVariable UUID id) {
        return ResponseEntity.ok(integration.numberState(id));
    }

    public record ChangeRequest(String number, String reason) {}

    @PutMapping("/activities/{id}")
    public ResponseEntity<Map<String, String>> change(@PathVariable UUID id, @RequestBody ChangeRequest request) {
        integration.changeNumber(id, request.number(), request.reason());
        return ResponseEntity.ok(Map.of("status", "CHANGED"));
    }
}
