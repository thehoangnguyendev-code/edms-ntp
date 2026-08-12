package com.eqms.dto.document;

import com.eqms.dto.user.LookupItemResponse;

import java.util.List;

public record DocumentFiltersResponse(
        List<LookupItemResponse> statuses,
        List<LookupItemResponse> documentTypes,
        List<LookupItemResponse> businessUnits,
        List<LookupItemResponse> departments,
        List<LookupItemResponse> authors
) {
}
