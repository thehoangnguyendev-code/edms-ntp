package com.eqms.controller;

import com.eqms.auth.CurrentUserService;
import com.eqms.dto.announcement.AnnouncementEnabledRequest;
import com.eqms.dto.announcement.AnnouncementRequest;
import com.eqms.entity.UserAccount;
import com.eqms.service.PermissionEvaluationService;
import com.eqms.service.SystemAnnouncementService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** Who may see and change announcements, and that what users are shown is never cached. */
class AnnouncementControllersTest {

    private SystemAnnouncementService service;
    private CurrentUserService currentUser;
    private PermissionEvaluationService permissions;
    private SettingsAnnouncementController admin;
    private final UserAccount user = new UserAccount();
    private static final AnnouncementRequest REQUEST = new AnnouncementRequest("t", "m", "INFO", Instant.now(), Instant.now().plusSeconds(60), true, null);

    @BeforeEach
    void setUp() {
        service = mock(SystemAnnouncementService.class);
        currentUser = mock(CurrentUserService.class);
        permissions = mock(PermissionEvaluationService.class);
        when(currentUser.requireCurrentUser()).thenReturn(user);
        admin = new SettingsAnnouncementController(service, currentUser, permissions);
    }

    private static void list(SettingsAnnouncementController controller) {
        controller.list(null, "ALL", "ALL", null, null, null, null, 1, 10, "startsAt", "desc");
    }

    @Test
    void theListQueryCarriesEveryFilterAndTheSortToTheService() {
        grant(true, false);
        Instant from = Instant.parse("2026-10-01T00:00:00Z");
        Instant to = Instant.parse("2026-10-31T23:59:59Z");
        admin.list("mainten", "ACTIVE", "WARNING", from, to, from, to, 3, 25, "severity", "asc");
        verify(service).list(new SystemAnnouncementService.ListQuery("mainten", "ACTIVE", "WARNING", from, to, from, to, 3, 25, "severity", "asc"));
    }

    private void grant(boolean view, boolean manage) {
        when(permissions.hasAnyPermission(any(), anyString(), anyString())).thenReturn(view || manage);
        when(permissions.hasPermission(any(), anyString())).thenAnswer(call -> manage && "settings.announcement.manage".equals(call.getArgument(1)));
    }

    @Test
    void aUserWithNeitherPermissionCannotSeeOrChangeAnything() {
        grant(false, false);
        assertThrows(AccessDeniedException.class, () -> list(admin));
        assertThrows(AccessDeniedException.class, () -> admin.get(UUID.randomUUID()));
        assertThrows(AccessDeniedException.class, () -> admin.create(REQUEST));
        assertThrows(AccessDeniedException.class, () -> admin.update(UUID.randomUUID(), REQUEST));
        assertThrows(AccessDeniedException.class, () -> admin.setEnabled(UUID.randomUUID(), new AnnouncementEnabledRequest(false, 0L)));
        assertThrows(AccessDeniedException.class, () -> admin.delete(UUID.randomUUID()));
        verify(service, never()).create(any());
    }

    @Test
    void viewOnlyCanReadButNotWrite() {
        grant(true, false);
        list(admin);
        verify(service).list(any(SystemAnnouncementService.ListQuery.class));
        assertThrows(AccessDeniedException.class, () -> admin.create(REQUEST));
        assertThrows(AccessDeniedException.class, () -> admin.update(UUID.randomUUID(), REQUEST));
        assertThrows(AccessDeniedException.class, () -> admin.setEnabled(UUID.randomUUID(), new AnnouncementEnabledRequest(true, 0L)));
        assertThrows(AccessDeniedException.class, () -> admin.delete(UUID.randomUUID()));
        verify(service, never()).create(any());
        verify(service, never()).delete(any());
    }

    @Test
    void manageCanWriteAndCreateAnswersCreated() {
        grant(true, true);
        assertEquals(201, admin.create(REQUEST).getStatusCode().value());
        UUID id = UUID.randomUUID();
        admin.update(id, REQUEST);
        admin.setEnabled(id, new AnnouncementEnabledRequest(false, 3L));
        assertEquals(204, admin.delete(id).getStatusCode().value());
        verify(service).update(id, REQUEST);
        verify(service).setEnabled(id, false, 3L);
        verify(service).delete(id);
    }

    @Test
    void anyoneSignedInGetsTheActiveAnnouncementsUncached() {
        when(service.active()).thenReturn(List.of());
        ResponseEntity<?> response = new AnnouncementController(service, currentUser).active();
        assertEquals(200, response.getStatusCode().value());
        String cache = response.getHeaders().getFirst(HttpHeaders.CACHE_CONTROL);
        assertTrue(cache != null && cache.contains("no-store"), String.valueOf(cache));
        verify(currentUser).requireCurrentUser();
    }
}
