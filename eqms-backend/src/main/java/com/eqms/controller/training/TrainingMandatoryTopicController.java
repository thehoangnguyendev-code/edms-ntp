package com.eqms.controller.training;

import com.eqms.auth.CurrentUserService;
import com.eqms.service.training.TrainingMandatoryTopicService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

/** The contents the annual training requirement must include (SOP.0003 5.3.2). */
@RestController
@RequestMapping("/training/mandatory-topics")
public class TrainingMandatoryTopicController {
    private final TrainingMandatoryTopicService topics;
    private final CurrentUserService users;

    public TrainingMandatoryTopicController(TrainingMandatoryTopicService topics, CurrentUserService users) {
        this.topics = topics;
        this.users = users;
    }

    @GetMapping
    public ResponseEntity<?> list() { return ResponseEntity.ok(Map.of("data", topics.list(users.requireCurrentUser()))); }

    @PostMapping
    public ResponseEntity<?> create(@RequestBody TrainingMandatoryTopicService.Write request) { return ResponseEntity.ok(topics.save(users.requireCurrentUser(), null, request)); }

    @PutMapping("/{id}")
    public ResponseEntity<?> update(@PathVariable UUID id, @RequestBody TrainingMandatoryTopicService.Write request) { return ResponseEntity.ok(topics.save(users.requireCurrentUser(), id, request)); }
}
