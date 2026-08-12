package com.eqms.dto.controlledcopypolicy;

public record ControlledCopyPolicyRecallSection(
        Boolean allowManualRecall,
        Boolean allowReportLost,
        Boolean allowReportDamaged,
        Boolean allowReplacementForLostDamaged
) {}
