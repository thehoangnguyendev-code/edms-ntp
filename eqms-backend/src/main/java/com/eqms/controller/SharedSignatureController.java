package com.eqms.controller;

import com.eqms.auth.CurrentUserService;
import com.eqms.dto.esignature.ElectronicSignatureRecordResponse;
import com.eqms.service.ElectronicSignatureService;
import com.eqms.service.PermissionEvaluationService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

/**
 * Generic signature lookup for any record type. The screens read signatures through the endpoints of
 * their own module (document, revision, controlled copy), which check access to the record; this one
 * does not know the record, so it is audit evidence and needs the Audit Trail view permission
 * (DEC-AUTHZ-2026-11-21-14). Before, any signed-in person could read the signer, e-mail, reason and
 * comment of any record whose id they knew.
 */
@RestController
@RequestMapping
public class SharedSignatureController {

    static final String AUDIT_VIEW_PERMISSION = "audit.view";

    private final ElectronicSignatureService electronicSignatureService;
    private final CurrentUserService currentUserService;
    private final PermissionEvaluationService permissionEvaluationService;

    public SharedSignatureController(ElectronicSignatureService electronicSignatureService,
                                     CurrentUserService currentUserService,
                                     PermissionEvaluationService permissionEvaluationService) {
        this.electronicSignatureService = electronicSignatureService;
        this.currentUserService = currentUserService;
        this.permissionEvaluationService = permissionEvaluationService;
    }

    @GetMapping("/shared/{module}/{entityId}/signatures")
    public ResponseEntity<List<ElectronicSignatureRecordResponse>> getSharedSignatures(
            @PathVariable String module,
            @PathVariable UUID entityId
    ) {
        if (!permissionEvaluationService.hasPermission(currentUserService.requireCurrentUser(), AUDIT_VIEW_PERMISSION)) {
            throw new AccessDeniedException("Reading the signatures of a record needs the Audit Trail view permission");
        }
        return ResponseEntity.ok(electronicSignatureService.getEntitySignatures(module, entityId));
    }
}
