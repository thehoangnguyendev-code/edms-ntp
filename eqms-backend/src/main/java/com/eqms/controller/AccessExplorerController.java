package com.eqms.controller;

import com.eqms.dto.user.AccessExplorerDtos.HoldersResponse;
import com.eqms.dto.user.AccessExplorerDtos.PermissionOption;
import com.eqms.service.AccessExplorerService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/** Access Explorer: read only, so there is no write endpoint to protect; the permission to view is checked by the service. */
@RestController
@RequestMapping("/security/access-explorer")
public class AccessExplorerController {
    private final AccessExplorerService service;

    public AccessExplorerController(AccessExplorerService service) {
        this.service = service;
    }

    @GetMapping("/permissions")
    public ResponseEntity<List<PermissionOption>> permissions(@RequestParam(required = false) String search) {
        return ResponseEntity.ok(service.searchPermissions(search));
    }

    @GetMapping("/holders")
    public ResponseEntity<HoldersResponse> holders(@RequestParam String code, @RequestParam(defaultValue = "true") boolean activeOnly) {
        return ResponseEntity.ok(service.whoHolds(code, activeOnly));
    }
}
