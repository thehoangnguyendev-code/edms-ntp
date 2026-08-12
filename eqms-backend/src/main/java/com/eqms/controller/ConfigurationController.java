package com.eqms.controller;

import com.eqms.dto.user.SecurityConfigurationRequest;
import com.eqms.dto.user.SecurityConfigurationResponse;
import com.eqms.service.SystemConfigurationService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/configurations")
public class ConfigurationController {

    private final SystemConfigurationService systemConfigurationService;

    public ConfigurationController(SystemConfigurationService systemConfigurationService) {
        this.systemConfigurationService = systemConfigurationService;
    }

    @GetMapping("/security")
    public ResponseEntity<SecurityConfigurationResponse> getSecurityConfiguration() {
        return ResponseEntity.ok(systemConfigurationService.getSecurityConfiguration());
    }

    @PutMapping("/security")
    public ResponseEntity<SecurityConfigurationResponse> updateSecurityConfiguration(@Valid @RequestBody SecurityConfigurationRequest request) {
        return ResponseEntity.ok(systemConfigurationService.updateSecurityConfiguration(request));
    }
}
