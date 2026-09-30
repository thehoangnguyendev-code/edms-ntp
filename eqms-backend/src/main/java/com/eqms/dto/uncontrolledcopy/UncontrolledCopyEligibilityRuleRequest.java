package com.eqms.dto.uncontrolledcopy;

import java.util.UUID;

/** Create/update payload for one eligibility rule row. {@code documentTypeId} null means "Any".
 *  All rows, including the seeded default, use the same editable fields. */
public record UncontrolledCopyEligibilityRuleRequest(
        UUID documentTypeId,
        boolean allowed,
        boolean active,
        String reason
) {
}
