package com.eqms.dto.controlledcopypolicy;

public record ControlledCopyPolicyRecallSection(
        Boolean allowManualRecall,
        Boolean allowReportLostDamaged,
        Boolean allowReplacementForLostDamaged
) {}
