package com.eqms.dto.executedrecord;

/** Result of {@code EformEditSessionService#completeFillStep} -- {@code completed=false} means this
 *  was one step of a multi-role signing chain and the next role must now fill theirs;
 *  {@code completed=true} means this was the last (or only) step and {@code executedRecord} holds
 *  the resulting submission. */
public record FillStepResponse(boolean completed, ExecutedRecordResponse executedRecord) {
}
