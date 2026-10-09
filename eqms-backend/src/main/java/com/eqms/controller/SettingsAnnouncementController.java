package com.eqms.controller;

import com.eqms.auth.CurrentUserService;
import com.eqms.dto.announcement.AnnouncementEnabledRequest;
import com.eqms.dto.announcement.AnnouncementRequest;
import com.eqms.dto.announcement.AnnouncementResponse;
import com.eqms.dto.user.PageResponse;
import com.eqms.service.PermissionEvaluationService;
import com.eqms.service.SystemAnnouncementService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.UUID;

/** Administration of the banner announcements (System Administration > System Announcements). */
@RestController
@RequestMapping("/settings/announcements")
public class SettingsAnnouncementController {

    private static final String VIEW = "settings.announcement.view";
    private static final String MANAGE = "settings.announcement.manage";

    private final SystemAnnouncementService service;
    private final CurrentUserService currentUserService;
    private final PermissionEvaluationService permissions;

    public SettingsAnnouncementController(SystemAnnouncementService service, CurrentUserService currentUserService,
                                          PermissionEvaluationService permissions) {
        this.service = service;
        this.currentUserService = currentUserService;
        this.permissions = permissions;
    }

    @GetMapping
    public ResponseEntity<PageResponse<AnnouncementResponse>> list(
            @RequestParam(required = false) String search,
            @RequestParam(required = false, defaultValue = "ALL") String state,
            @RequestParam(required = false, defaultValue = "ALL") String severity,
            @RequestParam(required = false) Instant startsFrom,
            @RequestParam(required = false) Instant startsTo,
            @RequestParam(required = false) Instant endsFrom,
            @RequestParam(required = false) Instant endsTo,
            @RequestParam(required = false, defaultValue = "1") int page,
            @RequestParam(required = false, defaultValue = "10") int limit,
            @RequestParam(required = false, defaultValue = "startsAt") String sortBy,
            @RequestParam(required = false, defaultValue = "desc") String sortDirection
    ) {
        requireView();
        return ResponseEntity.ok(service.list(new SystemAnnouncementService.ListQuery(
                search, state, severity, startsFrom, startsTo, endsFrom, endsTo, page, limit, sortBy, sortDirection)));
    }

    @GetMapping("/{id}")
    public ResponseEntity<AnnouncementResponse> get(@PathVariable UUID id) {
        requireView();
        return ResponseEntity.ok(service.get(id));
    }

    @PostMapping
    public ResponseEntity<AnnouncementResponse> create(@RequestBody AnnouncementRequest request) {
        requireManage();
        return ResponseEntity.status(201).body(service.create(request));
    }

    @PutMapping("/{id}")
    public ResponseEntity<AnnouncementResponse> update(@PathVariable UUID id, @RequestBody AnnouncementRequest request) {
        requireManage();
        return ResponseEntity.ok(service.update(id, request));
    }

    @PostMapping("/{id}/enabled")
    public ResponseEntity<AnnouncementResponse> setEnabled(@PathVariable UUID id, @RequestBody AnnouncementEnabledRequest request) {
        requireManage();
        return ResponseEntity.ok(service.setEnabled(id, request.enabled(), request.version()));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable UUID id) {
        requireManage();
        service.delete(id);
        return ResponseEntity.noContent().build();
    }

    private void requireView() {
        var user = currentUserService.requireCurrentUser();
        if (!permissions.hasAnyPermission(user, VIEW, MANAGE)) {
            throw new AccessDeniedException("Current user is not allowed to view system announcements");
        }
    }

    private void requireManage() {
        var user = currentUserService.requireCurrentUser();
        if (!permissions.hasPermission(user, MANAGE)) {
            throw new AccessDeniedException("Current user is not allowed to manage system announcements");
        }
    }
}
