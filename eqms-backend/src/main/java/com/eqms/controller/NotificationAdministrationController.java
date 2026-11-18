package com.eqms.controller;

import com.eqms.auth.CurrentUserService;
import com.eqms.dto.user.PageResponse;
import com.eqms.service.NotificationAdministrationService;
import com.eqms.service.PermissionEvaluationService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** The list of Notifications Administration: in-app notifications and email messages in one paged, filtered list. */
@RestController
@RequestMapping("/notification-administration")
public class NotificationAdministrationController {

    private final NotificationAdministrationService service;
    private final CurrentUserService currentUserService;
    private final PermissionEvaluationService permissions;

    public NotificationAdministrationController(NotificationAdministrationService service, CurrentUserService currentUserService,
                                                PermissionEvaluationService permissions) {
        this.service = service;
        this.currentUserService = currentUserService;
        this.permissions = permissions;
    }

    /** The e-mail messages that are also notifications of the registry: which event each is, so that a message screen can send the person to the event that is really edited. */
    @GetMapping("/message-events")
    public ResponseEntity<java.util.List<com.eqms.service.LegacyMessageEvents.Event>> messageEvents() {
        var user = currentUserService.requireCurrentUser();
        boolean allowed = permissions.hasAnyPermission(user, "settings.notification_policy.view", "settings.notification_policy.manage");
        if (!allowed) {
            throw new AccessDeniedException("Current user is not allowed to view notifications");
        }
        return ResponseEntity.ok(com.eqms.service.LegacyMessageEvents.all());
    }

    /** The kinds of recipient a notification can be given, with the words to show: the same list the dispatcher resolves. */
    @GetMapping("/recipient-rules")
    public ResponseEntity<java.util.List<com.eqms.service.NotificationRecipientRules.Rule>> recipientRules() {
        var user = currentUserService.requireCurrentUser();
        boolean events = permissions.hasAnyPermission(user, "settings.notification_policy.view", "settings.notification_policy.manage");
        if (!events) {
            throw new AccessDeniedException("Current user is not allowed to view notifications");
        }
        return ResponseEntity.ok(com.eqms.service.NotificationRecipientRules.all());
    }

    /** Every placeholder that can be written in the notifications of the system, for the list at the foot of the editors. */
    @GetMapping("/placeholders")
    public ResponseEntity<java.util.List<com.eqms.dto.notification.NotificationVariableResponse>> placeholders() {
        var user = currentUserService.requireCurrentUser();
        boolean events = permissions.hasAnyPermission(user, "settings.notification_policy.view", "settings.notification_policy.manage");
        boolean emails = permissions.hasAnyPermission(user, "settings.email_template.view", "settings.email_template.manage");
        if (!events && !emails) {
            throw new AccessDeniedException("Current user is not allowed to view notifications");
        }
        return ResponseEntity.ok(service.placeholders(events, emails));
    }

    @GetMapping
    public ResponseEntity<PageResponse<NotificationAdministrationService.Row>> list(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String channel,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String module,
            @RequestParam(required = false) String type,
            @RequestParam(required = false) String usage,
            @RequestParam(required = false) String updatedFrom,
            @RequestParam(required = false) String updatedTo,
            @RequestParam(defaultValue = "name") String sortBy,
            @RequestParam(defaultValue = "asc") String sortDirection,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int limit
    ) {
        var user = currentUserService.requireCurrentUser();
        // a person sees the kind of notification they may view: events with the notification policy right, emails with the email template right
        boolean events = permissions.hasAnyPermission(user, "settings.notification_policy.view", "settings.notification_policy.manage");
        boolean emails = permissions.hasAnyPermission(user, "settings.email_template.view", "settings.email_template.manage");
        if (!events && !emails) {
            throw new AccessDeniedException("Current user is not allowed to view notifications");
        }
        return ResponseEntity.ok(service.list(new NotificationAdministrationService.Query(
                search, channel, status, module, type, usage, updatedFrom, updatedTo, sortBy, sortDirection, page, Math.min(Math.max(limit, 1), 100)), events, emails));
    }
}
