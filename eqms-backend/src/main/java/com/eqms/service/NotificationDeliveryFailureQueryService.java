package com.eqms.service;

import com.eqms.entity.NotificationDeliveryFailure;
import com.eqms.repository.NotificationDeliveryFailureRepository;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * The failed notification deliveries of the Notification settings, searched, filtered, sorted and paged by the server. Reading only: a retry goes through
 * {@link EmailNotificationService#retryDeliveryFailure}. Payloads and secrets are not part of the result.
 */
@Service
public class NotificationDeliveryFailureQueryService {
    private static final Map<String, String> SORTS = Map.of(
            "recipient", "recipient", "notificationType", "notificationType", "eventDomain", "eventDomain", "channel", "channel",
            "attempts", "attempts", "status", "status", "createdAt", "createdAt", "lastAttemptAt", "lastAttemptAt");

    private final NotificationDeliveryFailureRepository repository;

    public NotificationDeliveryFailureQueryService(NotificationDeliveryFailureRepository repository) {
        this.repository = repository;
    }

    @Transactional(readOnly = true)
    public Page<NotificationDeliveryFailure> page(String search, String status, String channel, String eventDomain, String lastAttemptFrom, String lastAttemptTo,
                                                  String sortBy, String sortDirection, int page, int limit) {
        LocalDate from = date(lastAttemptFrom), to = date(lastAttemptTo);
        Specification<NotificationDeliveryFailure> spec = (root, query, cb) -> {
            List<Predicate> all = new ArrayList<>();
            if (search != null && !search.isBlank()) {
                String like = "%" + search.trim().toLowerCase(Locale.ROOT).replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%";
                all.add(cb.or(
                        cb.like(cb.lower(root.get("recipient")), like, '\\'),
                        cb.like(cb.lower(root.get("notificationType")), like, '\\'),
                        cb.like(cb.lower(cb.coalesce(root.<String>get("errorMessage"), "")), like, '\\')));
            }
            if (status != null && !status.isBlank()) all.add(cb.equal(root.get("status"), status.trim().toUpperCase(Locale.ROOT)));
            if (channel != null && !channel.isBlank()) all.add(cb.equal(root.get("channel"), channel.trim().toUpperCase(Locale.ROOT)));
            if (eventDomain != null && !eventDomain.isBlank()) all.add(cb.equal(root.get("eventDomain"), eventDomain.trim()));
            if (from != null) all.add(cb.greaterThanOrEqualTo(root.<Instant>get("lastAttemptAt"), from.atStartOfDay(com.eqms.util.DateTimeFormatUtils.ZONE).toInstant()));
            if (to != null) all.add(cb.lessThan(root.<Instant>get("lastAttemptAt"), to.plusDays(1).atStartOfDay(com.eqms.util.DateTimeFormatUtils.ZONE).toInstant()));
            return cb.and(all.toArray(Predicate[]::new));
        };
        String column = sortBy == null ? null : SORTS.get(sortBy);
        Sort.Direction direction = "asc".equalsIgnoreCase(sortDirection) ? Sort.Direction.ASC : Sort.Direction.DESC;
        Sort sort = column == null ? Sort.by(Sort.Direction.DESC, "lastAttemptAt") : Sort.by(direction, column).and(Sort.by(Sort.Direction.DESC, "lastAttemptAt"));
        return repository.findAll(spec, PageRequest.of(Math.max(page, 1) - 1, Math.min(Math.max(limit, 1), 100), sort));
    }

    @Transactional(readOnly = true)
    public List<String> eventDomains() {
        return repository.findDistinctEventDomains();
    }

    private static LocalDate date(String value) {
        if (value == null || value.isBlank()) return null;
        try {
            return LocalDate.parse(value.trim());
        } catch (DateTimeParseException e) {
            throw new IllegalArgumentException("DATE_INVALID");
        }
    }
}
