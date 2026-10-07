package com.eqms.dto.uncontrolledcopypolicy;

import com.eqms.dto.controlledcopypolicy.ControlledCopyStatusMarking;

public record UncontrolledCopyPolicyResponse(
        boolean approvalRequired,
        int validityHours,
        String validityBasis,
        boolean allowRedownload,
        ControlledCopyStatusMarking marking
) {}
