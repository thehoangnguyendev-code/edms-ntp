package com.eqms.service;

import com.eqms.dto.user.PageResponse;
import com.eqms.dto.user.PaginationResponse;
import jakarta.persistence.criteria.CriteriaBuilder;
import jakarta.persistence.criteria.Path;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.util.StringUtils;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.function.Function;

/**
 * Small, stateless query/formatting helpers shared by the dictionary-style Application Settings
 * services (paging, search/status/date-range specification predicates, audit-comment building).
 * Extracted out of {@link DictionaryManagementService} so a dedicated boundary service (e.g.
 * {@link EducationManagementService}) does not need to depend on -- or duplicate -- that class's
 * internals just to page/filter/format its own dictionary-shaped data.
 */
final class DictionaryQuerySupport {

    private DictionaryQuerySupport() {
    }

    static String normalizeName(String value) {
        return value == null ? null : value.trim();
    }

    static String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    static String safeText(String value) {
        return StringUtils.hasText(value) ? value.trim() : "-";
    }

    static String formatDateTime(Instant instant) {
        return com.eqms.util.DateTimeFormatUtils.formatDateTime(instant);
    }

    static String buildCreateComment(String entityLabel, String... parts) {
        return entityLabel + " created" + formatParts(parts);
    }

    static String buildUpdateComment(String entityLabel, String before, String after) {
        return entityLabel + " updated" + formatBeforeAfter(before, after);
    }

    static String buildDeleteComment(String entityLabel, String details) {
        return entityLabel + " deleted" + (StringUtils.hasText(details) ? ": " + details : "");
    }

    private static String formatBeforeAfter(String before, String after) {
        StringBuilder builder = new StringBuilder();
        if (StringUtils.hasText(before)) {
            builder.append(" | before: ").append(before);
        }
        if (StringUtils.hasText(after)) {
            builder.append(" | after: ").append(after);
        }
        return builder.toString();
    }

    private static String formatParts(String... parts) {
        if (parts == null || parts.length == 0) {
            return "";
        }
        StringBuilder builder = new StringBuilder(": ");
        boolean first = true;
        for (String part : parts) {
            if (!StringUtils.hasText(part)) {
                continue;
            }
            if (!first) {
                builder.append(", ");
            }
            builder.append(part.trim());
            first = false;
        }
        return first ? "" : builder.toString();
    }

    static <T, R> PageResponse<R> toPageResponse(Page<T> page, Function<T, R> mapper) {
        return new PageResponse<>(
                page.getContent().stream().map(mapper).toList(),
                new PaginationResponse(
                        page.getNumber() + 1,
                        page.getSize(),
                        page.getTotalElements(),
                        page.getTotalPages()
                )
        );
    }

    static Pageable buildPageable(int page, int limit, String sortBy, String sortDirection,
                                   String defaultSortKey, String modifiedDateSortKey,
                                   Map<String, String> allowedSortFields) {
        int safePage = Math.max(page, 1);
        int safeLimit = Math.min(Math.max(limit, 1), 100);
        String normalizedSortBy = sortBy == null ? "" : sortBy.trim();
        String resolvedSortBy = "modifiedDate".equalsIgnoreCase(normalizedSortBy)
                ? modifiedDateSortKey
                : allowedSortFields.getOrDefault(normalizedSortBy, defaultSortKey);
        Sort.Direction direction = "desc".equalsIgnoreCase(sortDirection) ? Sort.Direction.DESC : Sort.Direction.ASC;
        return PageRequest.of(safePage - 1, safeLimit, Sort.by(direction, resolvedSortBy));
    }

    @SafeVarargs
    static void addSearchPredicate(List<Predicate> predicates, CriteriaBuilder cb, String search, Path<String>... fields) {
        String normalizedSearch = normalizeSearch(search);
        if (normalizedSearch == null || fields == null || fields.length == 0) {
            return;
        }
        List<Predicate> orPredicates = new ArrayList<>();
        for (Path<String> field : fields) {
            orPredicates.add(cb.like(cb.lower(field), "%" + normalizedSearch + "%"));
        }
        predicates.add(cb.or(orPredicates.toArray(new Predicate[0])));
    }

    static void addStatusPredicate(List<Predicate> predicates, CriteriaBuilder cb, Path<Boolean> activeField, String status) {
        if (status == null || status.isBlank() || "All".equalsIgnoreCase(status)) {
            return;
        }
        boolean active = "Active".equalsIgnoreCase(status);
        predicates.add(cb.equal(activeField, active));
    }

    static void addUpdatedAtRangePredicate(List<Predicate> predicates, CriteriaBuilder cb, Path<Instant> field, String modifiedFrom, String modifiedTo) {
        Instant start = parseDateStart(modifiedFrom);
        Instant end = parseDateEnd(modifiedTo);
        if (start != null) {
            predicates.add(cb.greaterThanOrEqualTo(field, start));
        }
        if (end != null) {
            predicates.add(cb.lessThanOrEqualTo(field, end));
        }
    }

    private static Instant parseDateStart(String value) {
        LocalDate date = parseDate(value);
        return date == null ? null : date.atStartOfDay(ZoneId.systemDefault()).toInstant();
    }

    private static Instant parseDateEnd(String value) {
        LocalDate date = parseDate(value);
        return date == null ? null : date.plusDays(1).atStartOfDay(ZoneId.systemDefault()).toInstant().minusNanos(1);
    }

    static LocalDate parseDate(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            String normalized = value.trim();
            return normalized.matches("\\d{4}-\\d{2}-\\d{2}")
                    ? LocalDate.parse(normalized, DateTimeFormatter.ISO_LOCAL_DATE)
                    : LocalDate.parse(normalized, DateTimeFormatter.ofPattern("dd/MM/yyyy", Locale.ENGLISH));
        } catch (Exception ex) {
            return null;
        }
    }

    private static String normalizeSearch(String value) {
        return value == null ? null : value.trim().toLowerCase();
    }
}
