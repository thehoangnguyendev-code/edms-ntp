package com.eqms.dto.document;

public record SignatureResponse(
        String actionBy,
        String actionByName,
        String actionOn,
        String actionOnValue
) {
}
