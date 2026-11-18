package com.eqms.controller;

import com.eqms.auth.CurrentUserService;
import com.eqms.entity.InAppDesign;
import com.eqms.service.InAppDesignService;
import com.eqms.service.PermissionEvaluationService;
import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;

/** The shared in-app notification design of the system: read it and change it (the toast: colour, shadow, place and display time). */
@RestController
@RequestMapping("/settings/in-app-design")
public class InAppDesignController {

    /** Every field is required and must be of the right kind: a value of the wrong kind is refused, never turned into a default. */
    public record DesignBody(JsonNode toastPosition, JsonNode toastDurationSeconds, JsonNode toastColor, JsonNode toastShadow, Integer expectedVersion) {
        InAppDesignService.Change toChange() {
            if (toastPosition == null || !toastPosition.isTextual()) throw new IllegalArgumentException("The toast position is required");
            if (toastDurationSeconds == null || !toastDurationSeconds.isInt()) throw new IllegalArgumentException("The toast display time must be a whole number of seconds");
            if (toastColor == null || !toastColor.isTextual()) throw new IllegalArgumentException("The toast colour must be written as #RRGGBB");
            if (toastShadow == null || !toastShadow.isInt()) throw new IllegalArgumentException("The toast shadow must be a whole number from 0 to 100");
            return new InAppDesignService.Change(toastPosition.asText(), toastDurationSeconds.asInt(), toastColor.asText(), toastShadow.asInt());
        }
    }

    public record DesignResponse(String toastPosition, int toastDurationSeconds, String toastColor, int toastShadow, int version, String updatedBy, Instant updatedAt) {
    }

    private final InAppDesignService service;
    private final CurrentUserService currentUserService;
    private final PermissionEvaluationService permissions;

    public InAppDesignController(InAppDesignService service, CurrentUserService currentUserService, PermissionEvaluationService permissions) {
        this.service = service;
        this.currentUserService = currentUserService;
        this.permissions = permissions;
    }

    @GetMapping
    public ResponseEntity<DesignResponse> get() {
        requireView();
        return ResponseEntity.ok(toResponse(service.current()));
    }

    @PutMapping
    public ResponseEntity<DesignResponse> update(@RequestBody DesignBody body) {
        requireManage();
        return ResponseEntity.ok(toResponse(service.update(body.toChange(), body.expectedVersion())));
    }

    private DesignResponse toResponse(InAppDesign d) {
        return new DesignResponse(d.getToastPosition(), d.getToastDurationSeconds(), d.getToastColor(), d.getToastShadow(), d.getVersion(), d.getUpdatedBy(), d.getUpdatedAt());
    }

    private void requireView() {
        var user = currentUserService.requireCurrentUser();
        if (!permissions.hasAnyPermission(user, "settings.notification_policy.view", "settings.notification_policy.manage")) {
            throw new AccessDeniedException("Current user is not allowed to view the in-app notification design");
        }
    }

    private void requireManage() {
        var user = currentUserService.requireCurrentUser();
        if (!permissions.hasAnyPermission(user, "settings.notification_policy.manage")) {
            throw new AccessDeniedException("Current user is not allowed to change the in-app notification design");
        }
    }
}
