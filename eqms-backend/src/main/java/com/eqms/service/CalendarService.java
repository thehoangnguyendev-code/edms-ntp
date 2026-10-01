package com.eqms.service;

import com.eqms.auth.CurrentUserService;
import com.eqms.dto.calendar.*;
import com.eqms.entity.*;
import com.eqms.repository.*;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import java.time.*;
import java.time.format.DateTimeFormatter;
import java.time.temporal.TemporalAdjusters;
import java.util.*;

@Service
public class CalendarService {
    private final CurrentUserService currentUserService;
    private final AuthorizationService authorizationService;
    private final PermissionEvaluationService permissions;
    private final DocumentAuthorizationService documentAuthorization;
    private final SystemConfigurationService configuration;
    private final CalendarEventRepository events;
    private final CalendarSourceRepository sources;
    private final CalendarTaskProjectionService tasks;

    public CalendarService(CurrentUserService currentUserService, AuthorizationService authorizationService,
                           PermissionEvaluationService permissions, DocumentAuthorizationService documentAuthorization,
                           SystemConfigurationService configuration, CalendarEventRepository events, CalendarSourceRepository sources,
                           CalendarTaskProjectionService tasks) {
        this.currentUserService = currentUserService;
        this.authorizationService = authorizationService;
        this.permissions = permissions;
        this.documentAuthorization = documentAuthorization;
        this.configuration = configuration;
        this.events = events;
        this.sources = sources;
        this.tasks = tasks;
    }

    private UserAccount actor() {
        UserAccount user = currentUserService.requireCurrentUser();
        authorizationService.require(user, null); // Active authenticated account; no administrator owner bypass.
        return user;
    }

    private ZoneId zone() {
        String value = configuration.getPublicLocalization().timeZone();
        try { return value == null || value.isBlank() ? ZoneId.systemDefault() : ZoneId.of(value); }
        catch (DateTimeException ignored) { return ZoneId.systemDefault(); }
    }

    @Transactional(readOnly = true)
    public CalendarMonthResponse month(String requestedMonth, String requestedSource) {
        UserAccount user = actor();
        ZoneId zone = zone();
        LocalDate today = LocalDate.now(zone);
        YearMonth month;
        try { month = requestedMonth == null || requestedMonth.isBlank() ? YearMonth.from(today) : YearMonth.parse(requestedMonth); }
        catch (DateTimeException ex) { throw new IllegalArgumentException("Month must use YYYY-MM format."); }
        if (month.getYear() < 1 || month.getYear() > 9998) throw new IllegalArgumentException("Month is outside the supported range.");
        String source = requestedSource == null ? "ALL" : requestedSource.toUpperCase(Locale.ROOT);
        if (!Set.of("ALL", "EQMS", "NOTIFICATION", "PERSONAL").contains(source)) throw new IllegalArgumentException("Invalid calendar source.");
        LocalDate first = month.atDay(1).with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
        LocalDate end = month.atEndOfMonth().with(TemporalAdjusters.nextOrSame(DayOfWeek.SUNDAY)).plusDays(1);
        List<CalendarEventResponse> result = new ArrayList<>();
        if (source.equals("ALL") || source.equals("PERSONAL")) {
            events.findInRange(user.getId(), first.atStartOfDay(), end.atStartOfDay()).forEach(e -> result.add(personal(e)));
        }
        if ((source.equals("ALL") || source.equals("NOTIFICATION") || source.equals("EQMS"))
                && permissions.hasPermission(user, "notifications.module.view") && configuration.isFeatureEnabled("feat-notifications")) {
            boolean documentAccess = permissions.hasPermission(user, "documents.module.view") && configuration.isFeatureEnabled("feat-edms");
            tasks.project(user, sources.notifications(user.getId(), first.atStartOfDay(zone).toInstant(), end.atStartOfDay(zone).toInstant()), zone)
                    .stream().filter(e -> (!"TASK".equals(e.category()) || documentAccess)
                            && (source.equals("ALL") || source.equals(e.source()))).forEach(result::add);
        }
        if ((source.equals("ALL") || source.equals("EQMS")) && permissions.hasPermission(user, "documents.module.view")
                && configuration.isFeatureEnabled("feat-edms")) {
            for (DocumentRecord d : sources.documents(first, end)) {
                if (!documentAuthorization.canViewDocument(user, d)) continue;
                String title = d.getDocumentNumber() + " · " + d.getDocumentName();
                String url = "/documents/" + d.getId();
                milestone(result, "document:" + d.getId(), "REVIEW", "Document review", title, d.getReviewDate(), url, first, end);
                milestone(result, "document:" + d.getId(), "EFFECTIVE", "Document effective", title, d.getEffectiveDate(), url, first, end);
                milestone(result, "document:" + d.getId(), "EXPIRY", "Document validity ends", title, d.getValidUntil(), url, first, end);
            }
            for (DocumentRevisionRecord r : sources.revisions(first, end)) {
                if (!documentAuthorization.canViewRevision(user, r)) continue;
                String title = r.getDocumentNumber() + " · " + r.getRevisionName();
                String url = "/documents/revisions/" + r.getId();
                String id = "revision:" + r.getId();
                milestone(result, id, "EFFECTIVE", "Revision effective", title, r.getEffectiveDate(), url, first, end);
                milestone(result, id, "EXPIRY", "Revision validity ends", title, r.getValidUntil(), url, first, end);
                milestone(result, id, "TRAINING_PLANNED", "Training planned", title, r.getTrainingPlannedDate(), url, first, end);
                milestone(result, id, "TRAINING_END", "Training period ends", title, r.getTrainingPeriodEndDate(), url, first, end);
                milestone(result, id, "TRAINING_COMPLETED", "Training completed", title, r.getTrainingCompletionDate(), url, first, end);
            }
        }
        result.sort(Comparator.comparing(CalendarEventResponse::start).thenComparing(CalendarEventResponse::id));
        List<CalendarMonthResponse.Day> days = new ArrayList<>();
        for (LocalDate date = first; date.isBefore(end); date = date.plusDays(1)) {
            LocalDate current = date;
            List<CalendarEventResponse> daily = result.stream()
                    .filter(e -> e.start().isBefore(current.plusDays(1).atStartOfDay()) && e.end().isAfter(current.atStartOfDay())).toList();
            days.add(new CalendarMonthResponse.Day(date, date.getDayOfMonth(), YearMonth.from(date).equals(month), date.equals(today), daily));
        }
        return new CalendarMonthResponse(month.toString(), month.format(DateTimeFormatter.ofPattern("MMMM yyyy", Locale.ENGLISH)),
                month.minusMonths(1).toString(), month.plusMonths(1).toString(), today, YearMonth.from(today).toString(), zone.getId(),
                List.of("Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"), days);
    }

    private void milestone(List<CalendarEventResponse> result, String id, String kind, String label, String title,
                           LocalDate date, String url, LocalDate first, LocalDate end) {
        if (date == null || date.isBefore(first) || !date.isBefore(end)) return;
        result.add(new CalendarEventResponse(id + ":" + kind, "EQMS", kind, label, title, date.atStartOfDay(),
                date.plusDays(1).atStartOfDay(), true, false, null, url));
    }

    private CalendarEventResponse personal(CalendarEvent e) {
        return new CalendarEventResponse(e.getId().toString(), "PERSONAL", "PERSONAL", e.getTitle(), e.getDescription(),
                e.getStartsAt(), e.getEndsAt(), e.isAllDay(), true, e.getVersion(), null);
    }

    private CalendarEvent owned(UUID id, UserAccount user) {
        return events.findByIdAndOwner_IdAndDeletedAtIsNull(id, user.getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Calendar event not found."));
    }

    private void requireVersion(CalendarEvent event, Long version) {
        if (version == null || event.getVersion() != version) throw new ResponseStatusException(HttpStatus.CONFLICT,
                "This event has changed. Refresh the calendar before editing again.");
    }

    private void apply(CalendarEvent event, CalendarEventRequest request) {
        if (request.title() == null || request.title().isBlank() || request.title().trim().length() > 200)
            throw new IllegalArgumentException("Title is required and must not exceed 200 characters.");
        if (request.start() == null || request.end() == null) throw new IllegalArgumentException("Start and end are required.");
        LocalDateTime start = request.allDay() ? request.start().toLocalDate().atStartOfDay() : request.start();
        LocalDateTime end = request.allDay() ? request.end().toLocalDate().plusDays(1).atStartOfDay() : request.end();
        if (!end.isAfter(start)) throw new IllegalArgumentException("End must be after start.");
        if (start.getYear() < 1 || end.getYear() > 9998) throw new IllegalArgumentException("Event date is outside the supported range.");
        event.setTitle(request.title().trim()); event.setDescription(request.description());
        event.setStartsAt(start); event.setEndsAt(end); event.setAllDay(request.allDay());
    }

    @Transactional
    public CalendarEventResponse create(CalendarEventRequest request) {
        CalendarEvent event = new CalendarEvent(); event.setOwner(actor()); apply(event, request);
        return personal(events.saveAndFlush(event));
    }
    @Transactional
    public CalendarEventResponse update(UUID id, CalendarEventRequest request) {
        CalendarEvent event = owned(id, actor()); requireVersion(event, request.version()); apply(event, request);
        return personal(events.saveAndFlush(event));
    }
    @Transactional
    public void delete(UUID id, long version) {
        CalendarEvent event = owned(id, actor()); requireVersion(event, version);
        event.setDeletedAt(Instant.now()); events.saveAndFlush(event);
    }
}
