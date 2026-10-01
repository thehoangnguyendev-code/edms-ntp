package com.eqms.dto.executedrecord;

public record FormSettingsResponse(
        String documentId,
        boolean allowEform,
        boolean allowPaper,
        boolean requireApproval,
        String approverUserId,
        String approverName,
        boolean canFillEform,
        boolean canRecordPaper,
        boolean hasFillableTemplate
) {
}
