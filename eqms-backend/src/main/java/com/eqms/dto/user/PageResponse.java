package com.eqms.dto.user;

import java.util.List;

public record PageResponse<T>(
        List<T> data,
        PaginationResponse pagination
) {
}
