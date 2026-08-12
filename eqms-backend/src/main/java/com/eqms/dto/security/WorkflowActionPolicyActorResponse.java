package com.eqms.dto.security;

import com.eqms.enums.WorkflowActorType;

import java.util.UUID;

public record WorkflowActionPolicyActorResponse(
        UUID id,
        WorkflowActorType actorType,
        String actorTypeLabel,
        String actorCode,
        String actorDisplayName
) {}
