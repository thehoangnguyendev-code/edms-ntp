package com.eqms.util;

import com.eqms.dto.user.PageResponse;
import com.eqms.dto.user.PaginationResponse;

import java.util.List;

/** Slices an already-filtered/sorted server-side list into a PageResponse. */
public final class PagedList {

    private PagedList() {}

    public static <T> PageResponse<T> paginate(List<T> items, int page, int limit) {
        int safePage = Math.max(page, 1);
        int safeLimit = Math.max(limit, 1);
        int total = items.size();
        int totalPages = Math.max(1, (int) Math.ceil((double) total / safeLimit));
        int from = Math.min((safePage - 1) * safeLimit, total);
        int to = Math.min(from + safeLimit, total);
        return new PageResponse<>(
                items.subList(from, to),
                new PaginationResponse(safePage, safeLimit, total, totalPages));
    }
}
