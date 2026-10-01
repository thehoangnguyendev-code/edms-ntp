package com.eqms.service;

import com.eqms.auth.CurrentUserService;
import com.eqms.dto.calendar.*;
import com.eqms.dto.configuration.PublicLocalizationResponse;
import com.eqms.entity.*;
import com.eqms.repository.*;
import org.junit.jupiter.api.*;
import org.springframework.web.server.ResponseStatusException;
import java.time.*;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class CalendarServiceTest {
    private CurrentUserService currentUser;
    private AuthorizationService authorization;
    private PermissionEvaluationService permissions;
    private DocumentAuthorizationService documentAuthorization;
    private SystemConfigurationService configuration;
    private CalendarEventRepository events;
    private CalendarSourceRepository sources;
    private CalendarService service;
    private UserAccount user;

    @BeforeEach void setup() {
        currentUser = mock(CurrentUserService.class); authorization = mock(AuthorizationService.class);
        permissions = mock(PermissionEvaluationService.class); documentAuthorization = mock(DocumentAuthorizationService.class);
        configuration = mock(SystemConfigurationService.class); events = mock(CalendarEventRepository.class);
        sources = mock(CalendarSourceRepository.class); user = mock(UserAccount.class);
        when(user.getId()).thenReturn(UUID.randomUUID()); when(currentUser.requireCurrentUser()).thenReturn(user);
        when(configuration.getPublicLocalization()).thenReturn(new PublicLocalizationResponse("en", "DD/MM/YYYY", "UTC+7", "en"));
        service = new CalendarService(currentUser, authorization, permissions, documentAuthorization, configuration, events, sources,
                new CalendarTaskProjectionService(mock(DocumentRevisionRepository.class), mock(RevisionWorkflowHistoryRepository.class),
                        mock(WorkflowParticipantRepository.class), documentAuthorization, mock(RevisionWorkflowAuthorizationService.class)));
    }
    private CalendarEventRequest input(LocalDateTime start, LocalDateTime end, boolean allDay, Long version) {
        return new CalendarEventRequest(" My appointment ", "Private", start, end, allDay, version);
    }
    @Test void leapMonthIsGeneratedOnServerAndIncludesCompleteWeeks() {
        var month = service.month("2028-02", "PERSONAL");
        assertEquals("2028-02", month.month()); assertEquals("2028-01", month.previousMonth()); assertEquals("2028-03", month.nextMonth());
        assertEquals(DayOfWeek.MONDAY, month.days().getFirst().date().getDayOfWeek());
        assertEquals(DayOfWeek.SUNDAY, month.days().getLast().date().getDayOfWeek());
        assertEquals(29, month.days().stream().filter(CalendarMonthResponse.Day::inMonth).count());
        verify(events).findInRange(eq(user.getId()), eq(month.days().getFirst().date().atStartOfDay()),
                eq(month.days().getLast().date().plusDays(1).atStartOfDay()));
        verifyNoInteractions(sources);
    }
    @Test void absentMonthUsesCurrentDateInConfiguredZone() {
        var month = service.month(null, "PERSONAL");
        assertEquals(YearMonth.now(ZoneId.of("UTC+7")).toString(), month.month());
        assertEquals(LocalDate.now(ZoneId.of("UTC+7")), month.today());
    }
    @Test void invalidMonthOrSourceIsRejected() {
        assertThrows(IllegalArgumentException.class, () -> service.month("2026-13", "ALL"));
        assertThrows(IllegalArgumentException.class, () -> service.month("not-a-date", "ALL"));
        assertThrows(IllegalArgumentException.class, () -> service.month("2026-10", "OTHER"));
    }
    @Test void notificationQueryIsRecipientScopedAndConvertsTimeZone() {
        when(permissions.hasPermission(user, "notifications.module.view")).thenReturn(true);
        when(configuration.isFeatureEnabled("feat-notifications")).thenReturn(true);
        UserNotification notification = mock(UserNotification.class);
        when(notification.getRecipientUser()).thenReturn(user);
        when(notification.getId()).thenReturn(UUID.randomUUID()); when(notification.getTitle()).thenReturn("Personal notice");
        when(notification.getCreatedAt()).thenReturn(Instant.parse("2026-09-30T18:00:00Z"));
        when(sources.notifications(eq(user.getId()), any(), any())).thenReturn(List.of(notification));
        var month = service.month("2026-10", "NOTIFICATION");
        var result = month.days().stream().filter(d -> d.date().equals(LocalDate.of(2026, 10, 1))).findFirst().orElseThrow();
        assertEquals(1, result.events().size()); assertEquals(1, result.events().getFirst().start().getHour());
        assertFalse(result.events().getFirst().editable());
        verify(sources).notifications(eq(user.getId()), any(), any()); verifyNoInteractions(events);
    }
    @Test void sourcePermissionIsNotBypassedByCalendarAccess() {
        service.month("2026-10", "ALL");
        verifyNoInteractions(sources);
    }
    @Test void inaccessibleDocumentsAndRevisionsNeverReachResponse() {
        when(permissions.hasPermission(user, "documents.module.view")).thenReturn(true);
        when(configuration.isFeatureEnabled("feat-edms")).thenReturn(true);
        DocumentRecord denied = mock(DocumentRecord.class), allowed = mock(DocumentRecord.class);
        when(allowed.getId()).thenReturn(UUID.randomUUID()); when(allowed.getDocumentNumber()).thenReturn("DOC.1");
        when(allowed.getDocumentName()).thenReturn("Permitted document"); when(allowed.getReviewDate()).thenReturn(LocalDate.of(2026,10,2));
        when(sources.documents(any(), any())).thenReturn(List.of(denied, allowed));
        when(documentAuthorization.canViewDocument(user, allowed)).thenReturn(true);
        DocumentRevisionRecord revision = mock(DocumentRevisionRecord.class);
        when(sources.revisions(any(), any())).thenReturn(List.of(revision));
        var result = service.month("2026-10", "EQMS").days().stream().flatMap(d -> d.events().stream()).toList();
        assertEquals(1, result.size()); assertEquals("DOC.1 · Permitted document", result.getFirst().description());
        verify(denied, never()).getDocumentName(); verify(revision, never()).getRevisionName();
    }
    @Test void personalCreationUsesSessionOwnerAndNormalizesInclusiveAllDayEnd() {
        when(events.saveAndFlush(any())).thenAnswer(call -> {
            CalendarEvent saved = call.getArgument(0);
            org.springframework.test.util.ReflectionTestUtils.setField(saved, "id", UUID.randomUUID());
            return saved;
        });
        LocalDateTime start = LocalDate.of(2026, 10, 2).atTime(15, 0);
        var result = service.create(input(start, start, true, null));
        assertEquals(LocalDate.of(2026,10,2).atStartOfDay(), result.start());
        assertEquals(LocalDate.of(2026,10,3).atStartOfDay(), result.end());
        verify(events).saveAndFlush(argThat(e -> e.getOwner() == user && e.getTitle().equals("My appointment")));
    }
    @Test void invalidTimedRangeCannotBeSaved() {
        var start = LocalDateTime.of(2026,10,2,10,0);
        assertThrows(IllegalArgumentException.class, () -> service.create(input(start, start, false, null)));
        assertThrows(IllegalArgumentException.class, () -> service.create(input(start, start.minusHours(1), false, null)));
        verify(events, never()).saveAndFlush(any());
    }
    @Test void anotherOwnersEventCannotBeUpdatedOrDeleted() {
        UUID otherEvent = UUID.randomUUID();
        when(events.findByIdAndOwner_IdAndDeletedAtIsNull(otherEvent, user.getId())).thenReturn(Optional.empty());
        var start = LocalDateTime.of(2026,10,2,10,0);
        assertEquals(404, assertThrows(ResponseStatusException.class, () -> service.update(otherEvent, input(start, start.plusHours(1), false, 0L))).getStatusCode().value());
        assertEquals(404, assertThrows(ResponseStatusException.class, () -> service.delete(otherEvent, 0)).getStatusCode().value());
        verify(events, never()).saveAndFlush(any());
    }
    @Test void staleVersionCannotOverwriteOrDeleteEvent() {
        CalendarEvent event = mock(CalendarEvent.class); UUID id = UUID.randomUUID();
        when(event.getVersion()).thenReturn(2L);
        when(events.findByIdAndOwner_IdAndDeletedAtIsNull(id, user.getId())).thenReturn(Optional.of(event));
        var start = LocalDateTime.of(2026,10,2,10,0);
        assertEquals(409, assertThrows(ResponseStatusException.class, () -> service.update(id, input(start, start.plusHours(1), false, 1L))).getStatusCode().value());
        assertEquals(409, assertThrows(ResponseStatusException.class, () -> service.delete(id, 1)).getStatusCode().value());
        verify(events, never()).saveAndFlush(any());
    }
    @Test void midnightExclusiveEndIsNotShownOnFollowingDay() {
        CalendarEvent event = mock(CalendarEvent.class);
        when(event.getId()).thenReturn(UUID.randomUUID()); when(event.getTitle()).thenReturn("One day");
        when(event.getStartsAt()).thenReturn(LocalDate.of(2026,10,2).atStartOfDay());
        when(event.getEndsAt()).thenReturn(LocalDate.of(2026,10,3).atStartOfDay());
        when(events.findInRange(eq(user.getId()), any(), any())).thenReturn(List.of(event));
        var result = service.month("2026-10", "PERSONAL");
        assertEquals(1, result.days().stream().filter(d -> d.date().equals(LocalDate.of(2026,10,2))).findFirst().orElseThrow().events().size());
        assertEquals(0, result.days().stream().filter(d -> d.date().equals(LocalDate.of(2026,10,3))).findFirst().orElseThrow().events().size());
    }
    @Test void deletionIsSoftAndOwnerScoped() {
        CalendarEvent event = new CalendarEvent(); UUID id = UUID.randomUUID();
        when(events.findByIdAndOwner_IdAndDeletedAtIsNull(id, user.getId())).thenReturn(Optional.of(event));
        service.delete(id, 0); assertNotNull(event.getDeletedAt()); verify(events).saveAndFlush(event);
    }
}
