package com.eqms.controller;

import com.eqms.dto.knowledge.KnowledgeSharingDtos.DelegateRequest;
import com.eqms.dto.knowledge.KnowledgeSharingDtos.DelegateRow;
import com.eqms.dto.knowledge.KnowledgeSharingDtos.GrantRequest;
import com.eqms.dto.knowledge.KnowledgeSharingDtos.GranteeUser;
import com.eqms.dto.knowledge.KnowledgeSharingDtos.LinkCreated;
import com.eqms.dto.knowledge.KnowledgeSharingDtos.LinkRedeemRequest;
import com.eqms.dto.knowledge.KnowledgeSharingDtos.LinkRequest;
import com.eqms.dto.knowledge.KnowledgeSharingDtos.LinkRow;
import com.eqms.dto.knowledge.KnowledgeSharingDtos.LinkTarget;
import com.eqms.dto.knowledge.KnowledgeSharingDtos.Managed;
import com.eqms.dto.knowledge.KnowledgeSharingDtos.Node;
import com.eqms.dto.knowledge.KnowledgeSharingDtos.NodeAccess;
import com.eqms.dto.knowledge.KnowledgeSharingDtos.Options;
import com.eqms.dto.knowledge.KnowledgeSharingDtos.Paged;
import com.eqms.dto.knowledge.KnowledgeSharingDtos.PersonRow;
import com.eqms.service.KnowledgeShareDelegateService;
import com.eqms.service.KnowledgeShareLinkService;
import com.eqms.service.KnowledgeSharingService;
import com.eqms.service.SystemConfigurationService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

/** Sharing of the Knowledge Base by the Heads and the people they name, from the Knowledge explorer: shares, delegates and links. */
@RestController
@RequestMapping("/documents/knowledge-portal/sharing")
public class KnowledgeSharingController {
    private final KnowledgeSharingService service;
    private final KnowledgeShareDelegateService delegateService;
    private final KnowledgeShareLinkService linkService;
    private final SystemConfigurationService systemConfigurationService;

    public KnowledgeSharingController(KnowledgeSharingService service, KnowledgeShareDelegateService delegateService, KnowledgeShareLinkService linkService,
                                    SystemConfigurationService systemConfigurationService) {
        this.service = service;
        this.delegateService = delegateService;
        this.linkService = linkService;
        this.systemConfigurationService = systemConfigurationService;
    }

    /**
     * Sharing exists only while the Knowledge Base visibility is "Sharing": in the other modes everybody who may see a document already sees it,
     * so there is nothing to share, no Share menu and no way to share by calling the API.
     */
    private boolean sharingIsOn() {
        return SystemConfigurationService.KNOWLEDGE_VISIBILITY_SHARING.equals(systemConfigurationService.getKnowledgeVisibilityMode());
    }

    private void requireSharingOn() {
        if (!sharingIsOn()) {
            throw new AccessDeniedException("Sharing is not switched on: set the Knowledge Base visibility to Sharing to decide who sees what");
        }
    }

    /** The Departments and Business Units the current user may share (empty for most users). */
    @GetMapping("/managed")
    public ResponseEntity<Managed> managed() {
        return ResponseEntity.ok(sharingIsOn() ? service.managed() : new Managed(List.of(), List.of()));
    }

    /** What a folder of the explorer is, and whether the current user may share it. */
    @GetMapping("/folder")
    public ResponseEntity<Node> folder(@RequestParam(required = false) UUID hierarchyId, @RequestParam String kb,
                                       @RequestParam(required = false) List<String> path) {
        requireSharingOn();
        return ResponseEntity.ok(service.resolveFolder(hierarchyId, kb, path));
    }

    @GetMapping("/access")
    public ResponseEntity<NodeAccess> access(@RequestParam String kind, @RequestParam(required = false) UUID businessUnitId,
                                             @RequestParam(required = false) UUID departmentId, @RequestParam(required = false) UUID documentTypeId,
                                             @RequestParam(required = false) UUID documentId) {
        requireSharingOn();
        return ResponseEntity.ok(service.access(kind, businessUnitId, departmentId, documentTypeId, documentId));
    }

    /** One page of "Who has access": a row for each person or group, searched by name. */
    @GetMapping("/access/people")
    public ResponseEntity<Paged<PersonRow>> people(@RequestParam String kind, @RequestParam(required = false) UUID businessUnitId,
                                                   @RequestParam(required = false) UUID departmentId, @RequestParam(required = false) UUID documentTypeId,
                                                   @RequestParam(required = false) UUID documentId, @RequestParam(required = false) String search,
                                                   @RequestParam(defaultValue = "false") boolean mine, @RequestParam(defaultValue = "0") int offset,
                                                   @RequestParam(defaultValue = "20") int limit) {
        requireSharingOn();
        return ResponseEntity.ok(service.people(kind, businessUnitId, departmentId, documentTypeId, documentId, search, mine, offset, limit));
    }

    @GetMapping("/options")
    public ResponseEntity<Options> options() {
        requireSharingOn();
        return ResponseEntity.ok(service.options());
    }

    @GetMapping("/users")
    public ResponseEntity<List<GranteeUser>> users(@RequestParam(required = false) String search, @RequestParam(defaultValue = "20") int limit,
                                                   @RequestParam(defaultValue = "0") int offset, @RequestParam(required = false) String scopeKind,
                                                   @RequestParam(required = false) UUID businessUnitId, @RequestParam(required = false) UUID departmentId) {
        requireSharingOn();
        return ResponseEntity.ok(service.searchUsers(search, limit, offset, scopeKind, businessUnitId, departmentId));
    }

    @PostMapping("/grants")
    public ResponseEntity<NodeAccess> grant(@Valid @RequestBody GrantRequest request) {
        requireSharingOn();
        return ResponseEntity.ok(service.grant(request));
    }

    /** Takes one person (or Position, Department, group) out of a share and leaves the rest of it. */
    @DeleteMapping("/grants/{ruleId}/grantees")
    public ResponseEntity<Void> revokeGrantee(@PathVariable UUID ruleId, @RequestParam String type, @RequestParam(required = false) UUID id) {
        requireSharingOn();
        service.revokeGrantee(ruleId, type, id);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/grants/{ruleId}")
    public ResponseEntity<Void> revoke(@PathVariable UUID ruleId) {
        requireSharingOn();
        service.revoke(ruleId);
        return ResponseEntity.noContent().build();
    }

    // ---- the people a Head names to share --------------------------------------------------------------------------

    @GetMapping("/delegates")
    public ResponseEntity<Paged<DelegateRow>> delegates(@RequestParam String scopeKind, @RequestParam(required = false) UUID businessUnitId,
                                                        @RequestParam(required = false) UUID departmentId, @RequestParam(required = false) String search,
                                                        @RequestParam(defaultValue = "0") int offset, @RequestParam(defaultValue = "20") int limit) {
        requireSharingOn();
        return ResponseEntity.ok(delegateService.page(scopeKind, businessUnitId, departmentId, search, offset, limit));
    }

    @PostMapping("/delegates")
    public ResponseEntity<DelegateRow> addDelegate(@Valid @RequestBody DelegateRequest request) {
        requireSharingOn();
        return ResponseEntity.ok(delegateService.add(request));
    }

    @DeleteMapping("/delegates/{delegateId}")
    public ResponseEntity<Void> removeDelegate(@PathVariable UUID delegateId) {
        requireSharingOn();
        delegateService.remove(delegateId);
        return ResponseEntity.noContent().build();
    }

    // ---- links ------------------------------------------------------------------------------------------------------

    @GetMapping("/links")
    public ResponseEntity<Paged<LinkRow>> links(@RequestParam String kind, @RequestParam(required = false) UUID businessUnitId,
                                                @RequestParam(required = false) UUID departmentId, @RequestParam(required = false) UUID documentTypeId,
                                                @RequestParam(required = false) UUID documentId, @RequestParam(required = false) String search,
                                                @RequestParam(defaultValue = "0") int offset, @RequestParam(defaultValue = "20") int limit) {
        requireSharingOn();
        return ResponseEntity.ok(linkService.page(kind, businessUnitId, departmentId, documentTypeId, documentId, search, offset, limit));
    }

    @PostMapping("/links")
    public ResponseEntity<LinkCreated> createLink(@Valid @RequestBody LinkRequest request) {
        requireSharingOn();
        return ResponseEntity.ok(linkService.create(request));
    }

    @DeleteMapping("/links/{linkId}")
    public ResponseEntity<Void> revokeLink(@PathVariable UUID linkId) {
        requireSharingOn();
        linkService.revoke(linkId);
        return ResponseEntity.noContent().build();
    }

    /** Any signed-in user with the Knowledge permission: opens a link and is given what it points to. */
    @PostMapping("/links/open")
    public ResponseEntity<LinkTarget> openLink(@Valid @RequestBody LinkRedeemRequest request) {
        return ResponseEntity.ok(linkService.redeem(request.token()));
    }
}
