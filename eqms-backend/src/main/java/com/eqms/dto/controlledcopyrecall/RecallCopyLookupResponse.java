package com.eqms.dto.controlledcopyrecall;

/** What a typed controlled copy number matches: the copy (null when there is none) and why it cannot be recalled by scan (null when it can). */
public record RecallCopyLookupResponse(RecallItemCopyResponse copy, String problem) {
}
