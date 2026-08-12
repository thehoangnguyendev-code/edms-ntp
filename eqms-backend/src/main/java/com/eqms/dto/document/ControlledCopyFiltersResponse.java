package com.eqms.dto.document;

import com.eqms.dto.user.LookupItemResponse;

import java.util.List;

public record ControlledCopyFiltersResponse(
        List<LookupItemResponse> statuses
) {
}
