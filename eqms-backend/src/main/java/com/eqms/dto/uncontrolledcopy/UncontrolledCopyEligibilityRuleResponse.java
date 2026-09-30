package com.eqms.dto.uncontrolledcopy;

import java.time.Instant;
import java.util.UUID;

/** One row of the Uncontrolled Copy eligibility matrix (V503, simplified to Document Type only by
 *  V507). A null document type id means "Any" -- the frontend renders that as "Any" rather than a
 *  blank cell. */
public record UncontrolledCopyEligibilityRuleResponse(
        UUID id,
        UUID documentTypeId,
        String documentTypeName,
        boolean allowed,
        boolean active,
        boolean system,
        Instant updatedAt
) {
}
