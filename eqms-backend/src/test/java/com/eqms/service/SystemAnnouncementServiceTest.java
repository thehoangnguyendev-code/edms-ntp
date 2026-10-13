package com.eqms.service;

import com.eqms.auth.CurrentUserService;
import com.eqms.dto.announcement.AnnouncementRequest;
import com.eqms.entity.SystemAnnouncement;
import com.eqms.entity.UserAccount;
import com.eqms.repository.SystemAnnouncementRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.InOrder;
import org.springframework.http.HttpStatus;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.server.ResponseStatusException;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class SystemAnnouncementServiceTest {

    private static final Instant NOW = Instant.parse("2026-10-08T05:00:00Z");

    private SystemAnnouncementRepository repository;
    private AuditTrailService audit;
    private SystemAnnouncementService service;
    private UserAccount actor;

    @BeforeEach
    void setUp() {
        repository = mock(SystemAnnouncementRepository.class);
        audit = mock(AuditTrailService.class);
        CurrentUserService currentUser = mock(CurrentUserService.class);
        actor = new UserAccount();
        actor.setFullName("Quality Admin");
        when(currentUser.requireCurrentUser()).thenReturn(actor);
        when(repository.save(any())).thenAnswer(call -> call.getArgument(0));
        when(repository.saveAndFlush(any())).thenAnswer(call -> call.getArgument(0));
        service = new SystemAnnouncementService(repository, currentUser, audit);
    }

    private static AnnouncementRequest request(String title, String message, String severity, Instant start, Instant end, Long version) {
        return new AnnouncementRequest(title, message, severity, start, end, true, version);
    }

    private static AnnouncementRequest valid() {
        return request("Maintenance", "The system will be unavailable from 22:00.", "WARNING", NOW.plus(Duration.ofHours(1)), NOW.plus(Duration.ofHours(13)), null);
    }

    private static SystemAnnouncement stored(Instant start, Instant end, boolean enabled, long version) {
        SystemAnnouncement a = new SystemAnnouncement();
        ReflectionTestUtils.setField(a, "id", UUID.randomUUID());
        a.setTitle("Maintenance");
        a.setMessage("Text");
        a.setSeverity("INFO");
        a.setStartsAt(start);
        a.setEndsAt(end);
        a.setEnabled(enabled);
        ReflectionTestUtils.setField(a, "version", version);
        return a;
    }

    // ---- validation -----------------------------------------------------------------------------------------------

    @Test
    void aCompleteAnnouncementIsAccepted() {
        var v = SystemAnnouncementService.validate(valid(), true, NOW);
        assertEquals("Maintenance", v.title());
        assertEquals("WARNING", v.severity());
        assertTrue(v.enabled());
    }

    @Test
    void titleAndMessageAreRequiredAndBounded() {
        var base = valid();
        assertThrows(IllegalArgumentException.class, () -> SystemAnnouncementService.validate(request("  ", "m", "INFO", base.startsAt(), base.endsAt(), null), true, NOW));
        assertThrows(IllegalArgumentException.class, () -> SystemAnnouncementService.validate(request("t", " \n ", "INFO", base.startsAt(), base.endsAt(), null), true, NOW));
        assertThrows(IllegalArgumentException.class, () -> SystemAnnouncementService.validate(
                request("x".repeat(SystemAnnouncementService.TITLE_MAX + 1), "m", "INFO", base.startsAt(), base.endsAt(), null), true, NOW));
        assertThrows(IllegalArgumentException.class, () -> SystemAnnouncementService.validate(
                request("t", "x".repeat(SystemAnnouncementService.MESSAGE_MAX + 1), "INFO", base.startsAt(), base.endsAt(), null), true, NOW));
    }

    @Test
    void severityMustBeOneOfTheThree() {
        var base = valid();
        assertThrows(IllegalArgumentException.class, () -> SystemAnnouncementService.validate(request("t", "m", "URGENT", base.startsAt(), base.endsAt(), null), true, NOW));
        assertThrows(IllegalArgumentException.class, () -> SystemAnnouncementService.validate(request("t", "m", null, base.startsAt(), base.endsAt(), null), true, NOW));
        assertEquals("CRITICAL", SystemAnnouncementService.validate(request("t", "m", " critical ", base.startsAt(), base.endsAt(), null), true, NOW).severity());
    }

    @Test
    void theWindowMustBeOrderedAndANewAnnouncementMustEndInTheFuture() {
        Instant start = NOW.plus(Duration.ofHours(1));
        assertThrows(IllegalArgumentException.class, () -> SystemAnnouncementService.validate(request("t", "m", "INFO", start, start, null), true, NOW), "end equal to start");
        assertThrows(IllegalArgumentException.class, () -> SystemAnnouncementService.validate(request("t", "m", "INFO", start, start.minusSeconds(1), null), true, NOW), "end before start");
        assertThrows(IllegalArgumentException.class, () -> SystemAnnouncementService.validate(request("t", "m", "INFO", null, start, null), true, NOW));
        Instant pastStart = NOW.minus(Duration.ofHours(3));
        Instant pastEnd = NOW.minus(Duration.ofHours(1));
        assertThrows(IllegalArgumentException.class, () -> SystemAnnouncementService.validate(request("t", "m", "INFO", pastStart, pastEnd, null), true, NOW), "a new one that has already ended");
        // an existing announcement may be edited after it has ended (to correct its record)
        assertEquals(pastEnd, SystemAnnouncementService.validate(request("t", "m", "INFO", pastStart, pastEnd, 0L), false, NOW).endsAt());
    }

    @Test
    void contentIsPlainText() {
        assertEquals("a b", SystemAnnouncementService.cleanText("  a\n\tb  ", false), "a title has no line breaks");
        assertEquals("line1\nline2", SystemAnnouncementService.cleanText("line1\r\nline2", true));
        assertEquals("ab", SystemAnnouncementService.cleanText("a\u0000b\u0007", true), "control characters are removed");
        // markup is not interpreted anywhere, so it is kept exactly as typed and rendered as text
        assertEquals("<script>alert(1)</script>", SystemAnnouncementService.cleanText("<script>alert(1)</script>", true));
    }

    // ---- window ---------------------------------------------------------------------------------------------------

    @Test
    void anAnnouncementIsActiveFromItsStartUntilJustBeforeItsEnd() {
        Instant start = NOW;
        Instant end = NOW.plus(Duration.ofHours(2));
        SystemAnnouncement a = stored(start, end, true, 0);
        assertFalse(a.isActiveAt(start.minusMillis(1)));
        assertTrue(a.isActiveAt(start), "start is inclusive");
        assertTrue(a.isActiveAt(end.minusMillis(1)));
        assertFalse(a.isActiveAt(end), "end is exclusive");
        assertFalse(stored(start, end, false, 0).isActiveAt(start.plusSeconds(1)), "switched off");
    }

    @Test
    void stateReflectsWindowAndSwitch() {
        Instant now = NOW;
        assertEquals("ACTIVE", SystemAnnouncementService.stateOf(stored(now.minusSeconds(60), now.plusSeconds(60), true, 0), now));
        assertEquals("SCHEDULED", SystemAnnouncementService.stateOf(stored(now.plusSeconds(60), now.plusSeconds(120), true, 0), now));
        assertEquals("EXPIRED", SystemAnnouncementService.stateOf(stored(now.minusSeconds(120), now.minusSeconds(60), true, 0), now));
        assertEquals("DISABLED", SystemAnnouncementService.stateOf(stored(now.minusSeconds(60), now.plusSeconds(60), false, 0), now));
        assertEquals("EXPIRED", SystemAnnouncementService.stateOf(stored(now.minusSeconds(120), now.minusSeconds(60), false, 0), now), "an ended announcement is expired even if switched off");
    }

    @Test
    void theMostSevereIsShownFirstThenTheNewest() {
        SystemAnnouncement info = stored(NOW.minusSeconds(10), NOW.plusSeconds(100), true, 0);
        SystemAnnouncement warningOld = stored(NOW.minusSeconds(500), NOW.plusSeconds(100), true, 0);
        SystemAnnouncement warningNew = stored(NOW.minusSeconds(50), NOW.plusSeconds(100), true, 0);
        SystemAnnouncement critical = stored(NOW.minusSeconds(900), NOW.plusSeconds(100), true, 0);
        info.setSeverity("INFO");
        warningOld.setSeverity("WARNING");
        warningNew.setSeverity("WARNING");
        critical.setSeverity("CRITICAL");
        when(repository.findActive(any())).thenReturn(List.of(info, warningOld, warningNew, critical));
        var order = service.active().stream().map(a -> a.severity() + "@" + a.startsAt()).toList();
        assertEquals(List.of("CRITICAL@" + critical.getStartsAt(), "WARNING@" + warningNew.getStartsAt(),
                "WARNING@" + warningOld.getStartsAt(), "INFO@" + info.getStartsAt()), order);
    }

    // ---- writes ---------------------------------------------------------------------------------------------------

    @Test
    void createWritesAnAuditEntryWithTheActor() {
        // create() checks the window against the real clock, so this window is built from it, not from the fixed NOW above
        Instant now = Instant.now();
        var created = service.create(request("Maintenance", "The system will be unavailable from 22:00.", "WARNING",
                now.plus(Duration.ofHours(1)), now.plus(Duration.ofHours(13)), null));
        assertEquals("Quality Admin", created.createdBy());
        verify(audit).logAs(eq(actor), eq("SYSTEM_ANNOUNCEMENT"), eq("Maintenance"), any(), eq("SYSTEM_ANNOUNCEMENT_CREATED"), eq(null), any(), any());
    }

    @Test
    void editingAnAnnouncementSomeoneElseChangedIsRefused() {
        SystemAnnouncement existing = stored(NOW.minusSeconds(60), NOW.plusSeconds(600), true, 3);
        when(repository.findById(existing.getId())).thenReturn(Optional.of(existing));
        ResponseStatusException stale = assertThrows(ResponseStatusException.class, () -> service.update(existing.getId(),
                request("New", "m", "INFO", NOW, NOW.plusSeconds(60), 2L)));
        assertEquals(HttpStatus.CONFLICT, stale.getStatusCode());
        assertThrows(ResponseStatusException.class, () -> service.update(existing.getId(), request("New", "m", "INFO", NOW, NOW.plusSeconds(60), null)), "no version at all");
        assertThrows(ResponseStatusException.class, () -> service.setEnabled(existing.getId(), false, 1L));
        verify(repository, never()).saveAndFlush(any());
    }

    @Test
    void anUpdateRecordsWhatChanged() {
        SystemAnnouncement existing = stored(NOW.minusSeconds(60), NOW.plusSeconds(600), true, 3);
        when(repository.findById(existing.getId())).thenReturn(Optional.of(existing));
        service.update(existing.getId(), new AnnouncementRequest("Maintenance", "Text", "CRITICAL", existing.getStartsAt(), existing.getEndsAt(), true, 3L));
        verify(audit).logAs(eq(actor), eq("SYSTEM_ANNOUNCEMENT"), any(), any(), eq("SYSTEM_ANNOUNCEMENT_UPDATED"), any(), any(), any(),
                org.mockito.ArgumentMatchers.<List<com.eqms.dto.audittrail.AuditTrailChangeResponse>>argThat(changes ->
                        changes.size() == 1 && "Severity".equals(changes.get(0).field())));
    }

    @Test
    void deletingIsAuditedBeforeTheRowIsRemoved() {
        SystemAnnouncement existing = stored(NOW.minusSeconds(60), NOW.plusSeconds(600), true, 0);
        when(repository.findById(existing.getId())).thenReturn(Optional.of(existing));
        service.delete(existing.getId());
        InOrder order = inOrder(audit, repository);
        order.verify(audit).logAs(eq(actor), eq("SYSTEM_ANNOUNCEMENT"), eq("Maintenance"), eq(existing.getId()), eq("SYSTEM_ANNOUNCEMENT_DELETED"), any(), eq(null), any());
        order.verify(repository).delete(existing);
    }

    // ---- the list: server-side search, filters and sort ---------------------------------------------------------
    // The query itself (filters, search, every sort) is exercised on PostgreSQL by SystemAnnouncementRepositoryDbTest.

    private static SystemAnnouncementService.ListQuery query(String search, String state, String severity, String sortBy, String direction) {
        return new SystemAnnouncementService.ListQuery(search, state, severity, null, null, null, null, 1, 10, sortBy, direction);
    }

    @Test
    @SuppressWarnings("unchecked")
    void anUnknownStateOrSeverityFilterIsRejectedBeforeAnyQuery() {
        assertThrows(IllegalArgumentException.class, () -> service.list(query("", "BOGUS", "ALL", "startsAt", "desc")));
        assertThrows(IllegalArgumentException.class, () -> service.list(query("", "ALL", "URGENT", "startsAt", "desc")));
        verify(repository, never()).findAll(any(org.springframework.data.jpa.domain.Specification.class), any(org.springframework.data.domain.Pageable.class));
    }

    @Test
    void filtersAreNormalisedAndTheWidestRangeIsUsedWhenNoneIsGiven() {
        var criteria = SystemAnnouncementService.criteriaOf(
                new SystemAnnouncementService.ListQuery(" Maint ", " active ", "warning", null, null, null, null, 1, 10, "title", "asc"), NOW);
        assertEquals("%maint%", criteria.pattern());
        assertEquals("ACTIVE", criteria.state());
        assertEquals("WARNING", criteria.severity());
        assertEquals(Instant.parse("1970-01-01T00:00:00Z"), criteria.startsFrom());
        assertEquals(Instant.parse("2999-12-31T23:59:59Z"), criteria.startsTo());
        assertEquals(Instant.parse("1970-01-01T00:00:00Z"), criteria.endsFrom());
        assertEquals(Instant.parse("2999-12-31T23:59:59Z"), criteria.endsTo());
        assertEquals(NOW, criteria.now());
        assertEquals("title", criteria.sortKey());
        assertTrue(criteria.ascending());
    }

    @Test
    void aGivenRangeIsKept() {
        Instant from = Instant.parse("2026-10-01T00:00:00Z");
        Instant to = Instant.parse("2026-10-31T23:59:59Z");
        var criteria = SystemAnnouncementService.criteriaOf(new SystemAnnouncementService.ListQuery(null, "ALL", "ALL", from, to, from, to, 1, 10, "startsAt", "desc"), NOW);
        assertEquals("%%", criteria.pattern());
        assertEquals(from, criteria.startsFrom());
        assertEquals(to, criteria.startsTo());
        assertEquals(from, criteria.endsFrom());
        assertEquals(to, criteria.endsTo());
        assertFalse(criteria.ascending());
    }

    @Test
    void searchTextIsLiteral_soAPercentOrUnderscoreDoesNotMatchEverything() {
        assertEquals("%100\\%%", SystemAnnouncementService.likePattern("100%"));
        assertEquals("%a\\_b%", SystemAnnouncementService.likePattern("A_B"));
        assertEquals("%c:\\\\x%", SystemAnnouncementService.likePattern("C:\\X"));
        assertEquals("%%", SystemAnnouncementService.likePattern(null));
    }

    @Test
    void everySortableColumnIsKeptAndAnythingElseFallsBackToTheStartTime() {
        for (String key : com.eqms.repository.SystemAnnouncementSpecifications.SORT_KEYS) {
            assertEquals(key, SystemAnnouncementService.criteriaOf(query("", "ALL", "ALL", key, "asc"), NOW).sortKey());
        }
        assertEquals(8, com.eqms.repository.SystemAnnouncementSpecifications.SORT_KEYS.size());
        for (String hostile : List.of("bogus", "title) desc, (select 1", "a.title; drop table system_announcements", "")) {
            assertEquals("startsAt", SystemAnnouncementService.criteriaOf(query("", "ALL", "ALL", hostile, "desc"), NOW).sortKey(), hostile);
        }
        assertEquals("startsAt", SystemAnnouncementService.criteriaOf(query("", "ALL", "ALL", null, "desc"), NOW).sortKey());
    }

    @Test
    @SuppressWarnings("unchecked")
    void pageAndLimitAreBoundedAndThePageItselfIsUnsorted() {
        when(repository.findAll(any(org.springframework.data.jpa.domain.Specification.class), any(org.springframework.data.domain.Pageable.class)))
                .thenReturn(org.springframework.data.domain.Page.empty());
        service.list(new SystemAnnouncementService.ListQuery("", "ALL", "ALL", null, null, null, null, -4, 5000, "startsAt", "desc"));
        var pageable = org.mockito.ArgumentCaptor.forClass(org.springframework.data.domain.Pageable.class);
        verify(repository).findAll(any(org.springframework.data.jpa.domain.Specification.class), pageable.capture());
        assertEquals(0, pageable.getValue().getPageNumber());
        assertEquals(100, pageable.getValue().getPageSize());
        assertTrue(pageable.getValue().getSort().isUnsorted(), "the order lives in the specification");
    }
}
