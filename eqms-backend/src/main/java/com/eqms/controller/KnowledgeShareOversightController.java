package com.eqms.controller;

import com.eqms.dto.knowledge.KnowledgeShareOversightDtos.DocumentRef;
import com.eqms.dto.knowledge.KnowledgeShareOversightDtos.Explanation;
import com.eqms.dto.knowledge.KnowledgeShareOversightDtos.LinkAdminRow;
import com.eqms.dto.knowledge.KnowledgeShareOversightDtos.ShareRow;
import com.eqms.dto.knowledge.KnowledgeSharingDtos.GranteeUser;
import com.eqms.dto.user.PageResponse;
import com.eqms.service.KnowledgeShareOversightService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

/** Security & Authorization > Access Review > Knowledge Shares: what the Department Heads shared, the "why", and taking a share away. */
@RestController
@RequestMapping("/security/knowledge-shares")
public class KnowledgeShareOversightController {
    private final KnowledgeShareOversightService service;

    public KnowledgeShareOversightController(KnowledgeShareOversightService service) {
        this.service = service;
    }

    @GetMapping
    public ResponseEntity<PageResponse<ShareRow>> list(
            @RequestParam(defaultValue = "1") int page, @RequestParam(defaultValue = "20") int limit,
            @RequestParam(required = false) String search, @RequestParam(required = false) UUID departmentId,
            @RequestParam(required = false) String effect, @RequestParam(defaultValue = "createdAt") String sortBy,
            @RequestParam(defaultValue = "desc") String sortDir) {
        return ResponseEntity.ok(service.list(page, limit, search, departmentId, effect, sortBy, sortDir));
    }

    @DeleteMapping("/{ruleId}")
    public ResponseEntity<Void> revoke(@PathVariable UUID ruleId) {
        service.revoke(ruleId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/links")
    public ResponseEntity<PageResponse<LinkAdminRow>> links(
            @RequestParam(defaultValue = "1") int page, @RequestParam(defaultValue = "10") int limit,
            @RequestParam(required = false) String search, @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "createdAt") String sortBy, @RequestParam(defaultValue = "desc") String sortDir) {
        return ResponseEntity.ok(service.listLinks(page, limit, search, status, sortBy, sortDir));
    }

    @DeleteMapping("/links/{linkId}")
    public ResponseEntity<Void> revokeLink(@PathVariable UUID linkId) {
        service.revokeLink(linkId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/users")
    public ResponseEntity<List<GranteeUser>> users(@RequestParam(required = false) String search, @RequestParam(defaultValue = "20") int limit) {
        return ResponseEntity.ok(service.searchUsers(search, limit));
    }

    @GetMapping("/documents")
    public ResponseEntity<List<DocumentRef>> documents(@RequestParam(required = false) String search, @RequestParam(defaultValue = "20") int limit) {
        return ResponseEntity.ok(service.searchDocuments(search, limit));
    }

    @GetMapping("/explain")
    public ResponseEntity<Explanation> explain(@RequestParam UUID userId, @RequestParam UUID documentId) {
        return ResponseEntity.ok(service.explain(userId, documentId));
    }
}
