package com.eqms.controller;

import com.eqms.dto.executedrecord.CommitDesignRequest;
import com.eqms.dto.executedrecord.CompleteFillStepRequest;
import com.eqms.dto.executedrecord.EformEditSessionResponse;
import com.eqms.dto.executedrecord.FillStepResponse;
import com.eqms.dto.executedrecord.FormSettingsResponse;
import com.eqms.dto.executedrecord.StartEformSessionRequest;
import com.eqms.entity.EformEditSession;
import com.eqms.service.EformEditSessionService;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.io.IOException;
import java.util.UUID;

/**
 * Session-authenticated endpoints (normal permission/session stack) for a live OnlyOffice Form
 * session. The document-server-facing counterpart (source fetch + save callback, authenticated by
 * a signed token instead) lives on {@link OnlyOfficeFormSessionController}.
 */
@RestController
public class EformEditSessionController {

    private final EformEditSessionService eformEditSessionService;

    public EformEditSessionController(EformEditSessionService eformEditSessionService) {
        this.eformEditSessionService = eformEditSessionService;
    }

    /** DESIGN only -- an Author placing fields on the Form itself, independent of any one
     *  distribution. FILL/sign sessions are started via {@link #startFill} instead, scoped to one
     *  electronic Controlled Copy. */
    @PostMapping("/forms/{formDocumentId}/eform-sessions")
    public ResponseEntity<EformEditSessionResponse> start(
            @PathVariable UUID formDocumentId, @RequestBody StartEformSessionRequest request
    ) {
        EformEditSession session = eformEditSessionService.startDesignSession(formDocumentId, request.acknowledgeStaleContent());
        return ResponseEntity.ok(toResponse(session));
    }

    /** FILL/sign -- {@code roleName} blank starts the initial data-entry phase (gated to the
     *  Controlled Copy's own recipient); a non-blank role starts that signer's step. */
    @PostMapping("/controlled-copies/{controlledCopyId}/eform-sessions")
    public ResponseEntity<EformEditSessionResponse> startFill(
            @PathVariable UUID controlledCopyId, @RequestBody StartEformSessionRequest request
    ) {
        EformEditSession session = eformEditSessionService.startFillSession(controlledCopyId, request.roleName());
        return ResponseEntity.ok(toResponse(session));
    }

    @GetMapping("/eform-sessions/{id}/edit-config")
    public ResponseEntity<ObjectNode> getEditConfig(@PathVariable UUID id) {
        return ResponseEntity.ok(eformEditSessionService.getEditConfig(id));
    }

    @PostMapping("/eform-sessions/{id}/force-save")
    public ResponseEntity<Void> forceSave(@PathVariable UUID id) {
        eformEditSessionService.forceSave(id);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/eform-sessions/{id}/commit-design")
    public ResponseEntity<FormSettingsResponse> commitDesign(@PathVariable UUID id, @RequestBody CommitDesignRequest request) {
        return ResponseEntity.ok(eformEditSessionService.commitDesign(id, request.reason(), request.signatureToken()));
    }

    @PostMapping("/eform-sessions/{id}/complete-fill-step")
    public ResponseEntity<FillStepResponse> completeFillStep(@PathVariable UUID id, @RequestBody CompleteFillStepRequest request) throws IOException {
        return ResponseEntity.ok(eformEditSessionService.completeFillStep(id, request.reason(), request.signatureToken()));
    }

    @PostMapping("/eform-sessions/{id}/abandon")
    public ResponseEntity<Void> abandon(@PathVariable UUID id) {
        eformEditSessionService.abandonSession(id);
        return ResponseEntity.ok().build();
    }

    private EformEditSessionResponse toResponse(EformEditSession session) {
        return new EformEditSessionResponse(session.getId().toString(), session.getKind(), session.getStatus());
    }
}
