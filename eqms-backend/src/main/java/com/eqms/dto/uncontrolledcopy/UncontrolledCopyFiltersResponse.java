package com.eqms.dto.uncontrolledcopy;

import com.eqms.dto.user.LookupItemResponse;

import java.util.List;

public record UncontrolledCopyFiltersResponse(
        List<LookupItemResponse> statuses
) {
}
