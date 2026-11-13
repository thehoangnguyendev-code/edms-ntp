package com.eqms.controller;

import com.eqms.auth.CurrentUserService;
import com.eqms.service.NotificationRecipientService;
import com.eqms.service.PermissionEvaluationService;
import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/** What the recipient screens of the Notifications Administration need: the values a rule can be given, and who a list of rules reaches today. */
@RestController
@RequestMapping("/notification-administration")
public class NotificationRecipientController {
    public record PreviewBody(JsonNode rules) {
    }

    private final NotificationRecipientService service;
    private final CurrentUserService currentUserService;
    private final PermissionEvaluationService permissions;

    public NotificationRecipientController(NotificationRecipientService service, CurrentUserService currentUserService, PermissionEvaluationService permissions) {
        this.service = service;
        this.currentUserService = currentUserService;
        this.permissions = permissions;
    }

    private void requireView() {
        var user = currentUserService.requireCurrentUser();
        if (!permissions.hasAnyPermission(user, "settings.notification_policy.view", "settings.notification_policy.manage", "settings.configuration.view")) {
            throw new AccessDeniedException("Current user is not allowed to view notifications");
        }
    }

    @GetMapping("/recipient-values")
    public ResponseEntity<List<NotificationRecipientService.Choice>> values(@RequestParam String type) {
        requireView();
        return ResponseEntity.ok(service.choices(type));
    }

    @PostMapping("/recipient-preview")
    public ResponseEntity<NotificationRecipientService.Preview> preview(@RequestBody PreviewBody body) {
        requireView();
        return ResponseEntity.ok(service.preview(body.rules()));
    }
}
