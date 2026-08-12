package com.eqms.dto.document;

public record RevisionSignatureResponse(
        String actionBy,
        String actionByName,
        String actionOn,
        String actionOnValue
) {
}
