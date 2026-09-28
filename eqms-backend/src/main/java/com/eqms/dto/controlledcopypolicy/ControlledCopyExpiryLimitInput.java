package com.eqms.dto.controlledcopypolicy;

/**
 * One row of the desired end-state of the Expiry Duration Policy, as part of the single
 * {@link ControlledCopyPolicyRequest#expiryLimits()} list saved together with the rest of Controlled
 * Copies Policy (one "Save Changes", one e-signature, one consolidated Audit Trail entry) -- not the
 * per-row instant-save-with-its-own-signature flow the standalone {@code /expiry-limits} endpoints
 * still expose for any other caller.
 *
 * <p>{@code id} is null for a new rule; a rule whose id is omitted from the saved list is deleted
 * (except the mandatory, non-deletable "Global Default" row, which the client always includes).</p>
 */
public record ControlledCopyExpiryLimitInput(
        String id,
        String documentTypeId,
        String departmentId,
        Integer durationValue,
        String durationUnit,
        Boolean active
) {}
