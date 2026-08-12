package com.eqms.dto.document;

public record ControlledCopyDistributeRequest(
        String distributedTo,
        String distributedAt,
        String location,
        String comment,
        String signatureToken
) {
}
