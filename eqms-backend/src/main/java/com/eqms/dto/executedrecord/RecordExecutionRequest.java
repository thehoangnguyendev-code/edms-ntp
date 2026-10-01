package com.eqms.dto.executedrecord;

/**
 * Shared request shape for both capture methods: {@code recordPhysicalCopy} (paper scan, requires
 * {@code sourceControlledCopyId}) and {@code submitEform} (an already-filled eForm file the user
 * uploads directly -- live OnlyOffice Form Creator/fill-session embedding is a follow-up
 * increment; this upload path is the fully working interim UX for both capture methods).
 */
public record RecordExecutionRequest(
        String sourceControlledCopyId,
        String filledByUserId,
        String filledAt,
        String reason,
        String signatureToken
) {
}
