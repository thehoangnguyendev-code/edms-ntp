package com.eqms.controller;

import com.eqms.auth.CurrentUserService;
import com.eqms.dto.security.SeparationRuleResponse;
import com.eqms.dto.security.SeparationRuleUpdateRequest;
import com.eqms.service.SeparationRuleService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

/** The "a different person" rules an administrator can switch on or off (V821). Who may do what is checked in the service. */
@RestController
@RequestMapping("/authorization/separation-rules")
public class SeparationRuleController {
    private final SeparationRuleService service;
    private final CurrentUserService currentUserService;

    public SeparationRuleController(SeparationRuleService service, CurrentUserService currentUserService) {
        this.service = service;
        this.currentUserService = currentUserService;
    }

    @GetMapping
    public List<SeparationRuleResponse> list(
            @org.springframework.web.bind.annotation.RequestParam(required = false) String search,
            @org.springframework.web.bind.annotation.RequestParam(required = false) String moduleKey,
            @org.springframework.web.bind.annotation.RequestParam(required = false) String state) {
        return service.list(currentUserService.requireCurrentUser(), search, moduleKey, state);
    }

    public record BatchRequest(List<SeparationRuleService.Change> changes, String reason, String signatureToken) {}

    /** Saves several rules under one signature (the screen of a module saves all its ticks at once). */
    @org.springframework.web.bind.annotation.PutMapping
    public List<SeparationRuleResponse> setMany(@RequestBody BatchRequest request) {
        return service.setMany(request.changes(), request.reason(), request.signatureToken(), currentUserService.requireCurrentUser());
    }

    @PutMapping("/{id}")
    public SeparationRuleResponse set(@PathVariable UUID id, @RequestBody SeparationRuleUpdateRequest request) {
        if (request.enabled() == null) throw com.eqms.exception.WorkflowPolicyException.validationError("enabled is required");
        return service.set(id, request.enabled(), request.reason(), request.signatureToken(), currentUserService.requireCurrentUser());
    }

    /** A refusal about the request (no reason, unknown rule) answers with its own status and code, in the shape of every other error. */
    @org.springframework.web.bind.annotation.ExceptionHandler(com.eqms.exception.WorkflowPolicyException.class)
    public org.springframework.http.ResponseEntity<com.eqms.exception.ApiErrorResponse> refused(com.eqms.exception.WorkflowPolicyException exception) {
        return org.springframework.http.ResponseEntity.status(exception.getHttpStatus())
                .body(new com.eqms.exception.ApiErrorResponse(new com.eqms.exception.ApiErrorResponse.ErrorBody(exception.getErrorCode(), exception.getMessage(), List.of())));
    }
}
