package com.eqms.controller;

import com.eqms.dto.knowledge.KnowledgePortalDtos.BrowseResult;
import com.eqms.dto.knowledge.KnowledgePortalDtos.FeedbackRequest;
import com.eqms.dto.knowledge.KnowledgePortalDtos.PortalDocument;
import com.eqms.dto.knowledge.KnowledgePortalDtos.PortalOverview;
import com.eqms.dto.knowledge.KnowledgePortalDtos.SubscriptionRequest;
import com.eqms.service.KnowledgePortalService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/documents/knowledge-portal")
public class KnowledgePortalController {

    private final KnowledgePortalService service;

    public KnowledgePortalController(KnowledgePortalService service) {
        this.service = service;
    }

    @GetMapping
    public ResponseEntity<PortalOverview> overview(@RequestParam(required = false) UUID hierarchyId) {
        return ResponseEntity.ok(service.overview(hierarchyId));
    }

    @GetMapping("/default-determinator")
    public ResponseEntity<com.eqms.dto.knowledge.KnowledgePortalDtos.DeterminatorInfo> defaultDeterminator() {
        return ResponseEntity.ok(service.defaultDeterminator());
    }

    @GetMapping("/browse")
    public ResponseEntity<BrowseResult> browse(
            @RequestParam(required = false) UUID hierarchyId,
            @RequestParam String kb,
            @RequestParam(required = false) List<String> path) {
        return ResponseEntity.ok(service.browse(hierarchyId, kb, path));
    }

    @GetMapping("/search")
    public ResponseEntity<List<PortalDocument>> search(@RequestParam String q) {
        return ResponseEntity.ok(service.search(q));
    }

    @PostMapping("/documents/{documentId}/view")
    public ResponseEntity<Void> view(@PathVariable UUID documentId) {
        service.recordView(documentId);
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/documents/{documentId}/feedback")
    public ResponseEntity<Void> feedback(@PathVariable UUID documentId, @RequestBody FeedbackRequest request) {
        if (request == null || request.helpful() == null) {
            throw new IllegalArgumentException("Feedback must say whether the document was helpful");
        }
        service.giveFeedback(documentId, request.helpful());
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/documents/{documentId}/featured")
    public ResponseEntity<Void> feature(@PathVariable UUID documentId) {
        service.setFeatured(documentId, true);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/documents/{documentId}/featured")
    public ResponseEntity<Void> unfeature(@PathVariable UUID documentId) {
        service.setFeatured(documentId, false);
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/subscriptions")
    public ResponseEntity<Void> subscribe(@RequestBody SubscriptionRequest request) {
        service.subscribe(request == null ? null : request.fieldCode(), request == null ? null : request.valueKey(), true);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/subscriptions")
    public ResponseEntity<Void> unsubscribe(@RequestParam String fieldCode, @RequestParam String valueKey) {
        service.subscribe(fieldCode, valueKey, false);
        return ResponseEntity.noContent().build();
    }
}
