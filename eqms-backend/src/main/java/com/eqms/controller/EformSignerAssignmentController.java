package com.eqms.controller;

import com.eqms.dto.executedrecord.EformSignerAssignmentResponse;
import com.eqms.dto.executedrecord.UpdateEformSignerAssignmentsRequest;
import com.eqms.service.EformSignerAssignmentService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

/** Sequential signer-chain configuration for ONE electronic Controlled Copy distribution -- see
 *  the approved plan "Form / eForm -- Phase 2b: Per-Distribution Sequential Signer Assignment". */
@RestController
@RequestMapping("/controlled-copies/{controlledCopyId}")
public class EformSignerAssignmentController {

    private final EformSignerAssignmentService service;

    public EformSignerAssignmentController(EformSignerAssignmentService service) {
        this.service = service;
    }

    @GetMapping("/eform-signer-roles/scan")
    public ResponseEntity<List<String>> scan(@PathVariable UUID controlledCopyId) {
        return ResponseEntity.ok(service.scanRoleNames(controlledCopyId));
    }

    @GetMapping("/eform-signer-assignments")
    public ResponseEntity<List<EformSignerAssignmentResponse>> list(@PathVariable UUID controlledCopyId) {
        return ResponseEntity.ok(service.list(controlledCopyId));
    }

    @PutMapping("/eform-signer-assignments")
    public ResponseEntity<List<EformSignerAssignmentResponse>> update(
            @PathVariable UUID controlledCopyId, @RequestBody UpdateEformSignerAssignmentsRequest request
    ) {
        return ResponseEntity.ok(service.update(controlledCopyId, request));
    }
}
