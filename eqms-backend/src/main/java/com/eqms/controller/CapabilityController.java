package com.eqms.controller;

import com.eqms.auth.CurrentUserService;
import com.eqms.dto.user.CapabilityResponse;
import com.eqms.service.CapabilityService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/me")
public class CapabilityController {

    private final CapabilityService capabilityService;
    private final CurrentUserService currentUserService;

    public CapabilityController(CapabilityService capabilityService, CurrentUserService currentUserService) {
        this.capabilityService = capabilityService;
        this.currentUserService = currentUserService;
    }

    @GetMapping("/capabilities")
    public ResponseEntity<CapabilityResponse> getCapabilities() {
        var user = currentUserService.requireCurrentUser();
        return ResponseEntity.ok(capabilityService.getCapabilities(user));
    }
}
