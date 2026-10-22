package com.eqms.controller.training;

import com.eqms.auth.CurrentUserService;
import com.eqms.service.training.TrainingRecordService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

/** Personal training records, My Training, the Training Number log. */
@RestController
@RequestMapping("/training")
public class TrainingRecordController {
    private final TrainingRecordService records;
    private final CurrentUserService users;

    public TrainingRecordController(TrainingRecordService records, CurrentUserService users) {
        this.records = records;
        this.users = users;
    }

    @GetMapping("/me/records")
    public ResponseEntity<?> myRecords(@RequestParam(required = false) String search, @RequestParam(defaultValue = "desc") String sortDirection,
                                       @RequestParam(defaultValue = "1") int page, @RequestParam(defaultValue = "10") int limit) {
        return ResponseEntity.ok(records.myRecords(users.requireCurrentUser(), search, sortDirection, page, limit));
    }

    @GetMapping("/me/tasks")
    public ResponseEntity<?> myTasks() { return ResponseEntity.ok(Map.of("data", records.myTasks(users.requireCurrentUser()))); }

    @GetMapping("/records")
    public ResponseEntity<?> list(@RequestParam(required = false) String search, @RequestParam(required = false) UUID personId, @RequestParam(required = false) String documentNumber,
                                  @RequestParam(required = false) String trainingNumber, @RequestParam(defaultValue = "false") boolean includeVoided,
                                  @RequestParam(defaultValue = "completedOn") String sortBy, @RequestParam(defaultValue = "desc") String sortDirection,
                                  @RequestParam(defaultValue = "1") int page, @RequestParam(defaultValue = "10") int limit,
                                  @RequestParam Map<String, String> filters) {
        return ResponseEntity.ok(records.records(users.requireCurrentUser(), search, personId, documentNumber, trainingNumber, includeVoided, sortBy, sortDirection, page, limit, filters));
    }

    @PostMapping("/records/{id}/void")
    public ResponseEntity<?> voidRecord(@PathVariable UUID id, @RequestBody TrainingRecordService.VoidRequest request) {
        return ResponseEntity.ok(records.voidRecord(users.requireCurrentUser(), id, request));
    }

    @GetMapping("/number-log")
    public ResponseEntity<?> numberLog(@RequestParam(required = false) UUID departmentId, @RequestParam(required = false) Integer year, @RequestParam(required = false) String search,
                                       @RequestParam(required = false) String sortBy, @RequestParam(required = false) String sortDirection,
                                  @RequestParam(defaultValue = "1") int page, @RequestParam(defaultValue = "20") int limit) {
        return ResponseEntity.ok(records.numberLog(users.requireCurrentUser(), departmentId, year, search, sortBy, sortDirection, page, limit));
    }
}
