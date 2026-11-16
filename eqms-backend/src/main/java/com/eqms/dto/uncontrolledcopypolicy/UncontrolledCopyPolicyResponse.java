package com.eqms.dto.uncontrolledcopypolicy;

import com.eqms.dto.controlledcopypolicy.ControlledCopyStatusMarking;

public record UncontrolledCopyPolicyResponse(
        int validityHours,
        String validityBasis,
        boolean allowRedownload,
        ControlledCopyStatusMarking marking
) {}
