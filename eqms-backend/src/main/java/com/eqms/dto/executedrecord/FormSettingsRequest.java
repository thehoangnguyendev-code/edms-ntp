package com.eqms.dto.executedrecord;

public record FormSettingsRequest(
        boolean allowEform,
        boolean allowPaper,
        boolean requireApproval,
        String approverUserId,
        String reason,
        String signatureToken
) {
}
