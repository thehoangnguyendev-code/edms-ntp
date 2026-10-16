package com.eqms.controller.training;

import com.eqms.auth.CurrentUserService;
import com.eqms.service.training.TrainingLinkService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

/** The training of a document or revision as Document Control shows it (read only). */
@RestController
@RequestMapping("/training/links")
public class TrainingLinkController {
    private final TrainingLinkService links;
    private final CurrentUserService users;

    public TrainingLinkController(TrainingLinkService links, CurrentUserService users) {
        this.links = links;
        this.users = users;
    }

    @GetMapping("/documents/{documentId}")
    public ResponseEntity<?> forDocument(@PathVariable UUID documentId) { return ResponseEntity.ok(links.forDocument(users.requireCurrentUser(), documentId)); }

    @GetMapping("/revisions/{revisionId}")
    public ResponseEntity<?> forRevision(@PathVariable UUID revisionId) { return ResponseEntity.ok(links.forRevision(users.requireCurrentUser(), revisionId)); }
}
