package com.eqms.controller;

import com.eqms.dto.notification.NotificationActionRequest;
import com.eqms.dto.notification.NotificationResponse;
import com.eqms.dto.notification.NotificationSummaryResponse;
import com.eqms.dto.notification.NotificationDeliveryFailureResponse;
import com.eqms.dto.user.PageResponse;
import com.eqms.dto.user.PaginationResponse;
import com.eqms.entity.UserAccount;
import com.eqms.entity.NotificationDeliveryFailure;
import com.eqms.repository.NotificationDeliveryFailureRepository;
import com.eqms.service.AuthorizationService;
import com.eqms.service.EmailNotificationService;
import com.eqms.service.NotificationRealtimeService;
import com.eqms.service.NotificationService;
import com.eqms.auth.CurrentUserService;
import jakarta.validation.Valid;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;

import java.util.UUID;
import java.util.Map;

@RestController
@RequestMapping("/notifications")
public class NotificationController {

    private final NotificationService notificationService;
    private final NotificationRealtimeService notificationRealtimeService;
    private final CurrentUserService currentUserService;
    private final NotificationDeliveryFailureRepository deliveryFailureRepository;
    private final AuthorizationService authorizationService;
    private final EmailNotificationService emailNotificationService;

    public NotificationController(
            NotificationService notificationService,
            NotificationRealtimeService notificationRealtimeService,
            CurrentUserService currentUserService,
            NotificationDeliveryFailureRepository deliveryFailureRepository,
            AuthorizationService authorizationService,
            EmailNotificationService emailNotificationService
    ) {
        this.notificationService = notificationService;
        this.notificationRealtimeService = notificationRealtimeService;
        this.currentUserService = currentUserService;
        this.deliveryFailureRepository = deliveryFailureRepository;
        this.authorizationService = authorizationService;
        this.emailNotificationService = emailNotificationService;
    }

    @GetMapping
    public ResponseEntity<PageResponse<NotificationResponse>> list(
            @RequestParam(required = false, defaultValue = "all") String scope,
            @RequestParam(required = false) String search,
            @RequestParam(required = false, defaultValue = "all") String type,
            @RequestParam(required = false, defaultValue = "all") String module,
            @RequestParam(required = false, defaultValue = "all") String priority,
            @RequestParam(required = false, defaultValue = "all") String status,
            @RequestParam(required = false) String sender,
            @RequestParam(required = false) String relatedNumber,
            @RequestParam(required = false) String relatedTitle,
            @RequestParam(required = false) String dateFrom,
            @RequestParam(required = false) String dateTo,
            @RequestParam(defaultValue = "createdAt") String sortBy,
            @RequestParam(defaultValue = "desc") String sortDirection,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int limit
    ) {
        return ResponseEntity.ok(notificationService.list(scope, search, type, module, priority, status, sender, relatedNumber, relatedTitle, dateFrom, dateTo, sortBy, sortDirection, page, limit));
    }

    @GetMapping("/summary")
    public ResponseEntity<NotificationSummaryResponse> summary() {
        return ResponseEntity.ok(notificationService.getSummary());
    }

    @GetMapping("/preferences")
    public ResponseEntity<Map<String, Object>> getPreferences() {
        return ResponseEntity.ok(notificationService.getPreferences());
    }

    /** Administrative, paginated view of failed email deliveries. Payloads and secrets are never exposed. */
    @GetMapping("/delivery-failures")
    public ResponseEntity<PageResponse<NotificationDeliveryFailureResponse>> deliveryFailures(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int limit
    ) {
        UserAccount currentUser = currentUserService.requireCurrentUser();
        authorizationService.require(currentUser, "settings.notification_policy.manage");
        int safePage = Math.max(1, page);
        int safeLimit = Math.min(100, Math.max(1, limit));
        Page<NotificationDeliveryFailure> result = deliveryFailureRepository.findAllByOrderByLastAttemptAtDesc(
                PageRequest.of(safePage - 1, safeLimit, Sort.by(Sort.Direction.DESC, "lastAttemptAt")));
        return ResponseEntity.ok(new PageResponse<>(
                result.getContent().stream().map(NotificationDeliveryFailureResponse::from).toList(),
                new PaginationResponse(safePage, safeLimit, result.getTotalElements(), result.getTotalPages())
        ));
    }

    @PostMapping("/delivery-failures/{id}/retry")
    public ResponseEntity<NotificationDeliveryFailureResponse> retryDeliveryFailure(@PathVariable UUID id) {
        UserAccount currentUser = currentUserService.requireCurrentUser();
        authorizationService.require(currentUser, "settings.notification_policy.manage");
        return ResponseEntity.ok(NotificationDeliveryFailureResponse.from(emailNotificationService.retryDeliveryFailure(id)));
    }

    @PutMapping("/preferences")
    public ResponseEntity<Map<String, Object>> updatePreferences(@RequestBody Map<String, Object> preferences) {
        return ResponseEntity.ok(notificationService.updatePreferences(preferences));
    }

    @GetMapping(value = "/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public org.springframework.web.servlet.mvc.method.annotation.SseEmitter stream() {
        UserAccount currentUser = currentUserService.requireCurrentUser();
        return notificationRealtimeService.register(currentUser.getId());
    }

    @GetMapping("/unread-count")
    public ResponseEntity<java.util.Map<String, Long>> unreadCount() {
        return ResponseEntity.ok(java.util.Map.of("count", notificationService.getUnreadCount()));
    }

    @GetMapping("/{id}")
    public ResponseEntity<NotificationResponse> getById(@PathVariable UUID id) {
        return ResponseEntity.ok(notificationService.getById(id));
    }

    @PutMapping("/{id}/read")
    public ResponseEntity<NotificationResponse> markAsRead(@PathVariable UUID id) {
        return ResponseEntity.ok(notificationService.markAsRead(id));
    }

    @PutMapping("/read-all")
    public ResponseEntity<Void> markAllAsRead() {
        notificationService.markAllAsRead();
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/read")
    public ResponseEntity<Void> markManyAsRead(@Valid @RequestBody NotificationActionRequest request) {
        notificationService.markManyAsRead(request == null ? null : request.ids());
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable UUID id) {
        notificationService.deleteNotification(id);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping
    public ResponseEntity<Void> deleteMany(@Valid @RequestBody NotificationActionRequest request) {
        notificationService.deleteNotifications(request == null ? null : request.ids());
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/clear-all")
    public ResponseEntity<Void> clearAllRead() {
        notificationService.clearAllRead();
        return ResponseEntity.noContent().build();
    }
}
