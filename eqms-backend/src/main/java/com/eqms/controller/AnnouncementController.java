package com.eqms.controller;

import com.eqms.auth.CurrentUserService;
import com.eqms.dto.announcement.ActiveAnnouncementResponse;
import com.eqms.service.SystemAnnouncementService;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/** The announcements a signed-in user is shown. No permission beyond being signed in; never cached. */
@RestController
@RequestMapping("/announcements")
public class AnnouncementController {

    private final SystemAnnouncementService service;
    private final CurrentUserService currentUserService;

    public AnnouncementController(SystemAnnouncementService service, CurrentUserService currentUserService) {
        this.service = service;
        this.currentUserService = currentUserService;
    }

    @GetMapping("/active")
    public ResponseEntity<List<ActiveAnnouncementResponse>> active() {
        currentUserService.requireCurrentUser();
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(service.active());
    }
}
