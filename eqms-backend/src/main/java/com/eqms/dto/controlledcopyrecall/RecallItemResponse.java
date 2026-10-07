package com.eqms.dto.controlledcopyrecall;

/**
 * One uploaded scan. {@code matchStatus} is READY (will be recalled), UNMATCHED (no copy identified; match by number) or
 * BLOCKED (identified but cannot be recalled; {@code matchMessage} says why). Machine values are stable; the screen
 * translates them for display. When one upload held pages of several copies, {@code sourceFileName}/{@code sourcePages} say where
 * the item came from, {@code pageNumbers} which pages of the copy it holds (comma separated, in file order) out of
 * {@code expectedPages}, and {@code loosePage} marks a single page that could not be recognised and needs a copy and page number.
 */
public record RecallItemResponse(
        String id,
        int itemNo,
        String fileName,
        String contentType,
        long fileSize,
        String sha256,
        String virusStatus,
        String virusSignature,
        String qrStatus,
        String qrValue,
        String matchSource,
        String matchStatus,
        String matchMessage,
        boolean excluded,
        String outcome,
        String outcomeMessage,
        String executedRecordId,
        boolean previewAvailable,
        RecallItemCopyResponse copy,
        String sourceFileName,
        String sourcePages,
        String pageNumbers,
        Integer expectedPages,
        boolean loosePage
) {
}
