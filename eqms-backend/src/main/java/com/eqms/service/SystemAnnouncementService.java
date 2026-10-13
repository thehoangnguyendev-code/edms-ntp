package com.eqms.service;

import com.eqms.auth.CurrentUserService;
import com.eqms.dto.announcement.ActiveAnnouncementResponse;
import com.eqms.dto.announcement.AnnouncementRequest;
import com.eqms.dto.announcement.AnnouncementResponse;
import com.eqms.dto.audittrail.AuditTrailChangeResponse;
import com.eqms.dto.user.PageResponse;
import com.eqms.dto.user.PaginationResponse;
import com.eqms.entity.SystemAnnouncement;
import com.eqms.entity.UserAccount;
import com.eqms.repository.SystemAnnouncementRepository;
import com.eqms.repository.SystemAnnouncementSpecifications;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

/**
 * Banner announcements: an administrator schedules them, every signed-in user sees the active ones until they close them.
 * The content is plain text (the screens render it as text, never as markup), and every change is written to the audit trail.
 */
@Service
public class SystemAnnouncementService {

    public static final int TITLE_MAX = 150;
    public static final int MESSAGE_MAX = 2000;
    static final Set<String> SEVERITIES = Set.of("INFO", "WARNING", "CRITICAL");
    private static final Set<String> STATES = Set.of("ALL", "ACTIVE", "SCHEDULED", "EXPIRED", "DISABLED");
    private static final Set<String> SEVERITY_FILTERS = Set.of("ALL", "INFO", "WARNING", "CRITICAL");
    private static final String ENTITY_TYPE = "SYSTEM_ANNOUNCEMENT";

    private final SystemAnnouncementRepository repository;
    private final CurrentUserService currentUserService;
    private final AuditTrailService auditTrailService;

    public SystemAnnouncementService(SystemAnnouncementRepository repository, CurrentUserService currentUserService,
                                     AuditTrailService auditTrailService) {
        this.repository = repository;
        this.currentUserService = currentUserService;
        this.auditTrailService = auditTrailService;
    }

    // ---- reads ----------------------------------------------------------------------------------------------------

    /** What the list screen asks for. Every field is optional; the server does the searching, filtering, sorting and paging. */
    public record ListQuery(String search, String state, String severity, Instant startsFrom, Instant startsTo,
                            Instant endsFrom, Instant endsTo, int page, int limit, String sortBy, String sortDirection) {
    }

    private static final Instant WIDEST_FROM = Instant.parse("1970-01-01T00:00:00Z");
    private static final Instant WIDEST_TO = Instant.parse("2999-12-31T23:59:59Z");

    @Transactional(readOnly = true)
    public PageResponse<AnnouncementResponse> list(ListQuery query) {
        Instant now = Instant.now();
        SystemAnnouncementSpecifications.Criteria criteria = criteriaOf(query, now);
        int page = Math.max(query.page(), 1);
        int limit = Math.min(Math.max(query.limit(), 1), 100);
        // The order is part of the specification, so the page itself is unsorted.
        Page<SystemAnnouncement> result = repository.findAll(SystemAnnouncementSpecifications.search(criteria), PageRequest.of(page - 1, limit));
        return new PageResponse<>(
                result.getContent().stream().map(a -> toResponse(a, now)).toList(),
                new PaginationResponse(page, limit, result.getTotalElements(), result.getTotalPages()));
    }

    @Transactional(readOnly = true)
    public AnnouncementResponse get(UUID id) {
        return toResponse(require(id), Instant.now());
    }

    /** The announcements to show right now, most severe first, then newest. Needs no permission beyond being signed in. */
    @Transactional(readOnly = true)
    public List<ActiveAnnouncementResponse> active() {
        return repository.findActive(Instant.now()).stream()
                .sorted(Comparator.comparingInt((SystemAnnouncement a) -> severityRank(a.getSeverity()))
                        .thenComparing(SystemAnnouncement::getStartsAt, Comparator.reverseOrder()))
                .map(a -> new ActiveAnnouncementResponse(a.getId(), a.getTitle(), a.getMessage(), a.getSeverity(), a.getStartsAt(), a.getEndsAt()))
                .toList();
    }

    // ---- writes ---------------------------------------------------------------------------------------------------

    @Transactional
    public AnnouncementResponse create(AnnouncementRequest request) {
        UserAccount actor = currentUserService.requireCurrentUser();
        Instant now = Instant.now();
        Validated v = validate(request, true, now);
        SystemAnnouncement announcement = new SystemAnnouncement();
        apply(announcement, v);
        announcement.setCreatedBy(actor.getFullName());
        announcement.setUpdatedBy(actor.getFullName());
        SystemAnnouncement saved = repository.save(announcement);
        auditTrailService.logAs(actor, ENTITY_TYPE, saved.getTitle(), saved.getId(), "SYSTEM_ANNOUNCEMENT_CREATED",
                null, stateOf(saved, now), "Created announcement (" + saved.getSeverity() + ") shown "
                        + saved.getStartsAt() + " to " + saved.getEndsAt());
        return toResponse(saved, now);
    }

    /**
     * An announcement written by the system (the maintenance window), not by a signed-in person. The audit trail cannot name a
     * person here; the Backup Agent's ledger records the same step with the Super Administrator's name (SDS 11.5, 11.6).
     */
    @Transactional
    public AnnouncementResponse createForSystem(String title, String message, String severity, Instant startsAt, Instant endsAt, String by) {
        Instant now = Instant.now();
        Validated v = validate(new AnnouncementRequest(title, message, severity, startsAt, endsAt, true, null), true, now);
        SystemAnnouncement announcement = new SystemAnnouncement();
        apply(announcement, v);
        announcement.setCreatedBy(by);
        announcement.setUpdatedBy(by);
        return toResponse(repository.save(announcement), now);
    }

    /** Switches off the announcements of one maintenance request; returns how many were switched off. */
    @Transactional
    public int disableForRequest(String marker, String by) {
        int changed = 0;
        for (SystemAnnouncement a : repository.findAll()) {
            if (a.isEnabled() && a.getTitle() != null && a.getTitle().contains(marker)) {
                a.setEnabled(false);
                a.setUpdatedBy(by);
                changed++;
            }
        }
        return changed;
    }

    @Transactional
    public AnnouncementResponse update(UUID id, AnnouncementRequest request) {
        UserAccount actor = currentUserService.requireCurrentUser();
        Instant now = Instant.now();
        SystemAnnouncement announcement = requireCurrentVersion(id, request.version());
        Validated v = validate(request, false, now);
        String before = stateOf(announcement, now);
        List<AuditTrailChangeResponse> changes = new ArrayList<>();
        addChange(changes, "Title", announcement.getTitle(), v.title());
        addChange(changes, "Message", announcement.getMessage(), v.message());
        addChange(changes, "Severity", announcement.getSeverity(), v.severity());
        addChange(changes, "Starts at", String.valueOf(announcement.getStartsAt()), String.valueOf(v.startsAt()));
        addChange(changes, "Ends at", String.valueOf(announcement.getEndsAt()), String.valueOf(v.endsAt()));
        addChange(changes, "Enabled", String.valueOf(announcement.isEnabled()), String.valueOf(v.enabled()));
        apply(announcement, v);
        announcement.setUpdatedBy(actor.getFullName());
        SystemAnnouncement saved = repository.saveAndFlush(announcement);
        auditTrailService.logAs(actor, ENTITY_TYPE, saved.getTitle(), saved.getId(), "SYSTEM_ANNOUNCEMENT_UPDATED",
                before, stateOf(saved, now), "Updated announcement", changes);
        return toResponse(saved, now);
    }

    @Transactional
    public AnnouncementResponse setEnabled(UUID id, boolean enabled, Long version) {
        UserAccount actor = currentUserService.requireCurrentUser();
        Instant now = Instant.now();
        SystemAnnouncement announcement = requireCurrentVersion(id, version);
        String before = stateOf(announcement, now);
        announcement.setEnabled(enabled);
        announcement.setUpdatedBy(actor.getFullName());
        SystemAnnouncement saved = repository.saveAndFlush(announcement);
        auditTrailService.logAs(actor, ENTITY_TYPE, saved.getTitle(), saved.getId(),
                enabled ? "SYSTEM_ANNOUNCEMENT_ENABLED" : "SYSTEM_ANNOUNCEMENT_DISABLED",
                before, stateOf(saved, now), enabled ? "Switched the announcement on" : "Switched the announcement off");
        return toResponse(saved, now);
    }

    @Transactional
    public void delete(UUID id) {
        UserAccount actor = currentUserService.requireCurrentUser();
        Instant now = Instant.now();
        SystemAnnouncement announcement = require(id);
        String before = stateOf(announcement, now);
        // The audit entry is written first and carries the title, so the deletion stays traceable after the row is gone.
        auditTrailService.logAs(actor, ENTITY_TYPE, announcement.getTitle(), announcement.getId(), "SYSTEM_ANNOUNCEMENT_DELETED",
                before, null, "Deleted announcement");
        repository.delete(announcement);
    }

    // ---- validation and helpers (package-private so they can be tested without a database) -------------------------

    record Validated(String title, String message, String severity, Instant startsAt, Instant endsAt, boolean enabled) {
    }

    static Validated validate(AnnouncementRequest request, boolean creating, Instant now) {
        if (request == null) {
            throw new IllegalArgumentException("An announcement is required");
        }
        String title = cleanText(request.title(), false);
        String message = cleanText(request.message(), true);
        if (title.isEmpty()) {
            throw new IllegalArgumentException("A title is required");
        }
        if (title.length() > TITLE_MAX) {
            throw new IllegalArgumentException("The title must not exceed " + TITLE_MAX + " characters");
        }
        if (message.isEmpty()) {
            throw new IllegalArgumentException("A message is required");
        }
        if (message.length() > MESSAGE_MAX) {
            throw new IllegalArgumentException("The message must not exceed " + MESSAGE_MAX + " characters");
        }
        String severity = request.severity() == null ? "" : request.severity().trim().toUpperCase(Locale.ROOT);
        if (!SEVERITIES.contains(severity)) {
            throw new IllegalArgumentException("The severity must be INFO, WARNING or CRITICAL");
        }
        if (request.startsAt() == null || request.endsAt() == null) {
            throw new IllegalArgumentException("A start and an end time are required");
        }
        if (!request.endsAt().isAfter(request.startsAt())) {
            throw new IllegalArgumentException("The end time must be after the start time");
        }
        if (creating && !request.endsAt().isAfter(now)) {
            throw new IllegalArgumentException("The end time must be in the future");
        }
        return new Validated(title, message, severity, request.startsAt(), request.endsAt(), request.enabled() == null || request.enabled());
    }

    /**
     * Plain text only: surrounding space is trimmed and control characters are removed (a new line is kept in a message
     * and turned into a space in a title). Markup is not interpreted anywhere, so {@code <} and {@code >} stay as typed.
     */
    static String cleanText(String value, boolean keepNewLines) {
        if (value == null) {
            return "";
        }
        StringBuilder out = new StringBuilder(value.length());
        for (char c : value.replace("\r\n", "\n").replace('\r', '\n').toCharArray()) {
            if (c == '\n') {
                out.append(keepNewLines ? '\n' : ' ');
            } else if (c == '\t') {
                out.append(' ');
            } else if (!Character.isISOControl(c)) {
                out.append(c);
            }
        }
        String text = out.toString().strip();
        // A title is one line: runs of spaces (for example from a pasted line break) become a single space.
        return keepNewLines ? text : text.replaceAll(" {2,}", " ");
    }

    /** The list request as query criteria: filters checked, the search text made literal, unused ranges widened, the sort key whitelisted. */
    static SystemAnnouncementSpecifications.Criteria criteriaOf(ListQuery query, Instant now) {
        return new SystemAnnouncementSpecifications.Criteria(
                likePattern(query.search()),
                normalizeFilter(query.state(), STATES, "state"),
                normalizeFilter(query.severity(), SEVERITY_FILTERS, "severity"),
                query.startsFrom() == null ? WIDEST_FROM : query.startsFrom(),
                query.startsTo() == null ? WIDEST_TO : query.startsTo(),
                query.endsFrom() == null ? WIDEST_FROM : query.endsFrom(),
                query.endsTo() == null ? WIDEST_TO : query.endsTo(),
                now,
                SystemAnnouncementSpecifications.normalizeSortKey(query.sortBy()),
                !"desc".equalsIgnoreCase(query.sortDirection()));
    }

    /** A lower-cased LIKE pattern for the search text, with the LIKE wildcards in it taken literally. */
    static String likePattern(String search) {
        String text = search == null ? "" : search.trim().toLowerCase(Locale.ROOT);
        return "%" + text.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%";
    }

    private static String normalizeFilter(String value, Set<String> allowed, String name) {
        String normalized = value == null || value.isBlank() ? "ALL" : value.trim().toUpperCase(Locale.ROOT);
        if (!allowed.contains(normalized)) {
            throw new IllegalArgumentException("Unknown announcement " + name + " filter");
        }
        return normalized;
    }

    static String stateOf(SystemAnnouncement a, Instant now) {
        if (!a.getEndsAt().isAfter(now)) {
            return "EXPIRED";
        }
        if (!a.isEnabled()) {
            return "DISABLED";
        }
        return a.getStartsAt().isAfter(now) ? "SCHEDULED" : "ACTIVE";
    }

    static int severityRank(String severity) {
        return switch (severity) {
            case "CRITICAL" -> 0;
            case "WARNING" -> 1;
            default -> 2;
        };
    }

    private SystemAnnouncement require(UUID id) {
        return repository.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Announcement not found"));
    }

    private SystemAnnouncement requireCurrentVersion(UUID id, Long version) {
        SystemAnnouncement announcement = require(id);
        if (version == null || version != announcement.getVersion()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "ANNOUNCEMENT_VERSION_CONFLICT");
        }
        return announcement;
    }

    private static void apply(SystemAnnouncement target, Validated v) {
        target.setTitle(v.title());
        target.setMessage(v.message());
        target.setSeverity(v.severity());
        target.setStartsAt(v.startsAt());
        target.setEndsAt(v.endsAt());
        target.setEnabled(v.enabled());
    }

    private static void addChange(List<AuditTrailChangeResponse> changes, String field, String oldValue, String newValue) {
        if (!Objects.equals(oldValue, newValue)) {
            changes.add(new AuditTrailChangeResponse(field, oldValue, newValue));
        }
    }

    private static AnnouncementResponse toResponse(SystemAnnouncement a, Instant now) {
        return new AnnouncementResponse(a.getId(), a.getTitle(), a.getMessage(), a.getSeverity(), a.getStartsAt(), a.getEndsAt(),
                a.isEnabled(), stateOf(a, now), a.getVersion(), a.getCreatedBy(), a.getUpdatedBy(), a.getCreatedAt(), a.getUpdatedAt());
    }
}
