package com.eqms.controller;

import com.eqms.dto.user.AccessExplorerDtos.HoldersResponse;
import com.eqms.dto.user.AccessExplorerDtos.PermissionPage;
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
    public ResponseEntity<PermissionPage> permissions(@RequestParam(required = false) String search, @RequestParam(required = false) String module,
                                                      @RequestParam(required = false) String held, @RequestParam(required = false) String sortBy,
                                                      @RequestParam(required = false) String sortDir, @RequestParam(defaultValue = "0") int page,
                                                      @RequestParam(defaultValue = "10") int size) {
        return ResponseEntity.ok(service.listPermissions(search, module, held, sortBy, sortDir, page, size));
    }

    @GetMapping("/modules")
    public ResponseEntity<List<String>> modules() {
        return ResponseEntity.ok(service.modules());
    }

    @GetMapping("/holders")
    public ResponseEntity<HoldersResponse> holders(@RequestParam String code, @RequestParam(defaultValue = "true") boolean activeOnly, @RequestParam(required = false) String search,
                                                   @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "10") int size) {
        return ResponseEntity.ok(service.whoHolds(code, activeOnly, search, page, size));
    }
}
