package com.eqms.controller;

import com.eqms.auth.CurrentUserService;
import com.eqms.dto.notification.CreateNotificationEventRequest;
import com.eqms.dto.notification.NotificationPolicyDetailResponse;
import com.eqms.dto.notification.NotificationPolicySummaryResponse;
import com.eqms.dto.notification.NotificationPreviewRequest;
import com.eqms.dto.notification.NotificationPreviewResponse;
import com.eqms.dto.notification.NotificationTemplateVersionResponse;
import com.eqms.dto.notification.UpdateNotificationPolicyRequest;
import com.eqms.dto.notification.UpdateNotificationTemplateRequest;
import com.eqms.dto.user.PageResponse;
import com.eqms.entity.UserAccount;
import com.eqms.service.AuthorizationService;
import com.eqms.service.NotificationPolicyService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/notification-policies")
public class NotificationPolicyController {

    private static final String VIEW_PERMISSION = "settings.notification_policy.view";
    private static final String MANAGE_PERMISSION = "settings.notification_policy.manage";

    private final NotificationPolicyService notificationPolicyService;
    private final AuthorizationService authorizationService;
    private final CurrentUserService currentUserService;

    public NotificationPolicyController(
            NotificationPolicyService notificationPolicyService,
            AuthorizationService authorizationService,
            CurrentUserService currentUserService
    ) {
        this.notificationPolicyService = notificationPolicyService;
        this.authorizationService = authorizationService;
        this.currentUserService = currentUserService;
    }

    @GetMapping
    public ResponseEntity<PageResponse<NotificationPolicySummaryResponse>> list(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String module,
            @RequestParam(required = false) String complianceGroup,
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "module") String sortBy,
            @RequestParam(defaultValue = "asc") String sortDirection,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int limit
    ) {
        requireView();
        return ResponseEntity.ok(notificationPolicyService.list(search, module, complianceGroup, status, sortBy, sortDirection, page, limit));
    }

    @GetMapping("/{eventCode}")
    public ResponseEntity<NotificationPolicyDetailResponse> getDetail(@PathVariable String eventCode) {
        requireView();
        return ResponseEntity.ok(notificationPolicyService.getDetail(eventCode));
    }

    @PostMapping
    public ResponseEntity<NotificationPolicySummaryResponse> createEvent(@RequestBody CreateNotificationEventRequest request) {
        requireManage();
        return ResponseEntity.ok(notificationPolicyService.createEvent(request));
    }

    @DeleteMapping("/{eventCode}")
    public ResponseEntity<Void> deleteEvent(@PathVariable String eventCode) {
        requireManage();
        notificationPolicyService.deleteEvent(eventCode);
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/{eventCode}")
    public ResponseEntity<NotificationPolicyDetailResponse> updatePolicy(
            @PathVariable String eventCode,
            @RequestBody UpdateNotificationPolicyRequest request
    ) {
        requireManage();
        return ResponseEntity.ok(notificationPolicyService.updatePolicy(eventCode, request));
    }

    @PutMapping("/{eventCode}/templates/{channel}")
    public ResponseEntity<NotificationTemplateVersionResponse> updateTemplate(
            @PathVariable String eventCode,
            @PathVariable String channel,
            @RequestBody UpdateNotificationTemplateRequest request
    ) {
        requireManage();
        return ResponseEntity.ok(notificationPolicyService.updateTemplate(eventCode, channel, request));
    }

    @GetMapping("/{eventCode}/templates/{channel}/history")
    public ResponseEntity<List<NotificationTemplateVersionResponse>> getHistory(
            @PathVariable String eventCode,
            @PathVariable String channel
    ) {
        requireView();
        return ResponseEntity.ok(notificationPolicyService.getHistory(eventCode, channel));
    }

    @PostMapping("/{eventCode}/templates/{channel}/restore/{versionId}")
    public ResponseEntity<NotificationTemplateVersionResponse> restoreVersion(
            @PathVariable String eventCode,
            @PathVariable String channel,
            @PathVariable UUID versionId
    ) {
        requireManage();
        return ResponseEntity.ok(notificationPolicyService.restoreVersion(eventCode, channel, versionId));
    }

    @PostMapping("/{eventCode}/preview")
    public ResponseEntity<NotificationPreviewResponse> preview(
            @PathVariable String eventCode,
            @RequestBody NotificationPreviewRequest request
    ) {
        requireView();
        return ResponseEntity.ok(notificationPolicyService.preview(eventCode, request));
    }

    private void requireView() {
        UserAccount currentUser = currentUserService.requireCurrentUser();
        authorizationService.require(currentUser, VIEW_PERMISSION);
    }

    private void requireManage() {
        UserAccount currentUser = currentUserService.requireCurrentUser();
        authorizationService.require(currentUser, MANAGE_PERMISSION);
    }
}
