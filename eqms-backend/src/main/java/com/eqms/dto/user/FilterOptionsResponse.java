package com.eqms.dto.user;

import java.util.List;

public record FilterOptionsResponse(
        List<LookupItemResponse> roles,
        List<LookupItemResponse> genders,
        List<LookupItemResponse> employmentTypes,
        List<LookupItemResponse> statuses,
        List<LookupItemResponse> departments,
        List<LookupItemResponse> businessUnits,
        List<LookupItemResponse> positions
) {
}
