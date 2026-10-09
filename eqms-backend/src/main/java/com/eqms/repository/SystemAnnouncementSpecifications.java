package com.eqms.repository;

import com.eqms.entity.SystemAnnouncement;
import jakarta.persistence.criteria.CriteriaBuilder;
import jakarta.persistence.criteria.Expression;
import jakarta.persistence.criteria.Predicate;
import jakarta.persistence.criteria.Root;
import org.springframework.data.jpa.domain.Specification;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;

/**
 * The announcement list query: search, filters and sort, built with the Criteria API. Nothing here is assembled from the
 * request as text: the caller picks a sort key from {@link #SORT_KEYS} (anything else means the start time), and the search text
 * is passed as a bound, escaped pattern. The order is part of the specification, so the repository must be asked for an
 * unsorted page.
 */
public final class SystemAnnouncementSpecifications {

    /** The sortable columns. */
    public static final Set<String> SORT_KEYS = Set.of("title", "severity", "state", "startsAt", "endsAt", "updatedAt", "updatedBy", "createdBy");
    private static final char ESCAPE = '\\';

    private SystemAnnouncementSpecifications() {
    }

    /**
     * @param pattern    a lower-cased LIKE pattern whose wildcards are escaped with a backslash (never null)
     * @param state      ALL, ACTIVE, SCHEDULED, EXPIRED or DISABLED
     * @param severity   ALL, INFO, WARNING or CRITICAL
     * @param ascending  false for descending
     */
    public record Criteria(String pattern, String state, String severity, Instant startsFrom, Instant startsTo, Instant endsFrom,
                           Instant endsTo, Instant now, String sortKey, boolean ascending) {
    }

    public static String normalizeSortKey(String sortKey) {
        return sortKey != null && SORT_KEYS.contains(sortKey) ? sortKey : "startsAt";
    }

    public static Specification<SystemAnnouncement> search(Criteria c) {
        return (root, query, cb) -> {
            List<Predicate> where = new ArrayList<>();
            where.add(cb.or(
                    cb.like(cb.lower(root.get("title")), c.pattern(), ESCAPE),
                    cb.like(cb.lower(root.get("message")), c.pattern(), ESCAPE),
                    cb.like(cb.lower(cb.coalesce(root.<String>get("createdBy"), "")), c.pattern(), ESCAPE),
                    cb.like(cb.lower(cb.coalesce(root.<String>get("updatedBy"), "")), c.pattern(), ESCAPE)));
            Predicate stateFilter = stateFilter(c, root, cb);
            if (stateFilter != null) {
                where.add(stateFilter);
            }
            if (!"ALL".equals(c.severity())) {
                where.add(cb.equal(root.get("severity"), c.severity()));
            }
            where.add(cb.between(root.<Instant>get("startsAt"), c.startsFrom(), c.startsTo()));
            where.add(cb.between(root.<Instant>get("endsAt"), c.endsFrom(), c.endsTo()));

            // The count query needs no order; for the page query the order is set here (see the class comment).
            if (query != null && query.getResultType() != Long.class && query.getResultType() != long.class) {
                Expression<?> key = sortExpression(c, root, cb);
                query.orderBy(c.ascending() ? cb.asc(key) : cb.desc(key), cb.desc(root.get("id")));
            }
            return cb.and(where.toArray(Predicate[]::new));
        };
    }

    private static Predicate stateFilter(Criteria c, Root<SystemAnnouncement> root, CriteriaBuilder cb) {
        Instant now = c.now();
        return switch (c.state()) {
            case "ACTIVE" -> cb.and(cb.isTrue(root.get("enabled")), cb.lessThanOrEqualTo(root.<Instant>get("startsAt"), now),
                    cb.greaterThan(root.<Instant>get("endsAt"), now));
            case "SCHEDULED" -> cb.and(cb.isTrue(root.get("enabled")), cb.greaterThan(root.<Instant>get("startsAt"), now));
            case "EXPIRED" -> cb.lessThanOrEqualTo(root.<Instant>get("endsAt"), now);
            case "DISABLED" -> cb.and(cb.isFalse(root.get("enabled")), cb.greaterThan(root.<Instant>get("endsAt"), now));
            default -> null;
        };
    }

    private static Expression<?> sortExpression(Criteria c, Root<SystemAnnouncement> root, CriteriaBuilder cb) {
        Instant now = c.now();
        return switch (normalizeSortKey(c.sortKey())) {
            case "title" -> cb.lower(root.get("title"));
            // most severe first when ascending
            case "severity" -> cb.<Integer>selectCase()
                    .when(cb.equal(root.get("severity"), "CRITICAL"), 0)
                    .when(cb.equal(root.get("severity"), "WARNING"), 1)
                    .otherwise(2);
            // the order a user reads them in: active, scheduled, switched off, expired
            case "state" -> cb.<Integer>selectCase()
                    .when(cb.lessThanOrEqualTo(root.<Instant>get("endsAt"), now), 3)
                    .when(cb.isFalse(root.get("enabled")), 2)
                    .when(cb.greaterThan(root.<Instant>get("startsAt"), now), 1)
                    .otherwise(0);
            case "endsAt" -> root.get("endsAt");
            case "updatedAt" -> cb.coalesce(root.<Instant>get("updatedAt"), root.<Instant>get("createdAt"));
            case "updatedBy" -> cb.lower(cb.coalesce(cb.coalesce(root.<String>get("updatedBy"), root.<String>get("createdBy")), ""));
            case "createdBy" -> cb.lower(cb.coalesce(root.<String>get("createdBy"), ""));
            default -> root.get("startsAt");
        };
    }
}
