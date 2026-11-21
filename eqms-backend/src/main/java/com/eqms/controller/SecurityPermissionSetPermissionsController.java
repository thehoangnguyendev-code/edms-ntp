package com.eqms.controller;

import com.eqms.dto.user.PermissionSetPermissionPageResponse;
import com.eqms.service.PermissionSetPermissionQueryService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/security/permission-sets")
public class SecurityPermissionSetPermissionsController {

    private final PermissionSetPermissionQueryService service;

    public SecurityPermissionSetPermissionsController(PermissionSetPermissionQueryService service) {
        this.service = service;
    }

    /** A page of the permissions of one Permission Set, searched and filtered by module on the server. */
    @GetMapping("/{id}/permissions")
    public ResponseEntity<PermissionSetPermissionPageResponse> permissions(
            @PathVariable UUID id,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int limit,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String module) {
        return ResponseEntity.ok(service.page(id, page, limit, search, module));
    }
}
