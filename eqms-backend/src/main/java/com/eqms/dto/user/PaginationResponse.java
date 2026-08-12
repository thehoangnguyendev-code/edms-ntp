package com.eqms.dto.user;

public record PaginationResponse(
        int page,
        int limit,
        long total,
        int totalPages
) {
}
