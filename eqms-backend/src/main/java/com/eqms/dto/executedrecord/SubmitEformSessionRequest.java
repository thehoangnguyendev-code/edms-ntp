package com.eqms.dto.executedrecord;

public record SubmitEformSessionRequest(String eformSessionId, String reason, String signatureToken) {
}
