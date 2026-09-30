package com.eqms.dto.uncontrolledcopy;

import java.util.List;

/** Distribute several Generated uncontrolled copies under ONE e-signature. */
public record UncontrolledCopyBatchDistributeRequest(
        List<String> ids,
        String reason,
        String signatureToken
) {
}
