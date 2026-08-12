package com.eqms.controller;

import com.eqms.dto.security.ResourceCapabilitiesResponse;
import com.eqms.service.ResourceCapabilityService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;


/** Additive shared API; the existing /revisions and /controlled-copies capability APIs remain unchanged. */
@RestController
@RequestMapping("/authorization/resources")
public class ResourceCapabilityController {
    private final ResourceCapabilityService service;

    public ResourceCapabilityController(ResourceCapabilityService service) {
        this.service = service;
    }

    @GetMapping("/{resourceType}/{resourceId}/capabilities")
    public ResponseEntity<ResourceCapabilitiesResponse> getCapabilities(
            @PathVariable String resourceType, @PathVariable String resourceId
    ) {
        return ResponseEntity.ok(service.getCapabilities(resourceType, resourceId));
    }

    @GetMapping("/{resourceType}/{resourceId}/eligible-users")
    public ResponseEntity<com.eqms.dto.user.PageResponse<com.eqms.dto.security.EligibleParticipantResponse>> eligible(
            @PathVariable String resourceType, @PathVariable String resourceId, @RequestParam String participantType,
            @RequestParam(required = false) String search,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int limit
    ) {
        return ResponseEntity.ok(service.getEligibleParticipants(resourceType, resourceId, participantType, search, page, limit));
    }
}
