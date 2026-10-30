package com.eqms.controller.training;

import com.eqms.auth.CurrentUserService;
import com.eqms.service.training.TrainingProposedParticipantService;
import com.eqms.service.training.TrainingProposedParticipantService.ReplaceRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/** The people proposed for the training of a document while it is prepared. The rules of who may edit are in the service. */
@RestController
@RequestMapping("/training")
public class TrainingProposedParticipantController {
    private final TrainingProposedParticipantService proposals;
    private final CurrentUserService users;

    public TrainingProposedParticipantController(TrainingProposedParticipantService proposals, CurrentUserService users) {
        this.proposals = proposals;
        this.users = users;
    }

    @GetMapping("/documents/{documentId}/proposed-participants")
    public ResponseEntity<?> get(@PathVariable UUID documentId) { return ResponseEntity.ok(proposals.forDocument(users.requireCurrentUser(), documentId)); }

    @PutMapping("/documents/{documentId}/proposed-participants")
    public ResponseEntity<?> replace(@PathVariable UUID documentId, @RequestBody ReplaceRequest request) { return ResponseEntity.ok(proposals.replace(users.requireCurrentUser(), documentId, request)); }

    @GetMapping("/documents/{documentId}/proposed-participants/paged")
    public ResponseEntity<?> getPage(@PathVariable UUID documentId, @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int limit) {
        return ResponseEntity.ok(proposals.forDocumentPage(users.requireCurrentUser(), documentId, page, limit));
    }

    @GetMapping("/proposal-people")
    public ResponseEntity<?> people(@RequestParam(required = false) String search, @RequestParam(defaultValue = "20") int limit) {
        return ResponseEntity.ok(Map.of("data", proposals.people(users.requireCurrentUser(), search, limit)));
    }

    @GetMapping("/proposal-people/paged")
    public ResponseEntity<?> queryPeople(@RequestParam(required = false) String search,
            @RequestParam(required = false) String businessUnit, @RequestParam(required = false) String department,
            @RequestParam(defaultValue = "1") int page, @RequestParam(defaultValue = "20") int limit) {
        return ResponseEntity.ok(proposals.queryPeople(users.requireCurrentUser(), search, businessUnit, department, page, limit));
    }

    @GetMapping("/proposal-people/groups")
    public ResponseEntity<?> groups(@RequestParam String by) { return ResponseEntity.ok(Map.of("data", proposals.groups(users.requireCurrentUser(), by))); }

    @GetMapping("/proposal-people/in-groups")
    public ResponseEntity<?> inGroups(@RequestParam String by, @RequestParam List<String> names) {
        return ResponseEntity.ok(Map.of("data", proposals.inGroups(users.requireCurrentUser(), by, names)));
    }
}
