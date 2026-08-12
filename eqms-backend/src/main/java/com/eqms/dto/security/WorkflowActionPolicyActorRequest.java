package com.eqms.dto.security;

import com.eqms.enums.WorkflowActorType;
import jakarta.validation.constraints.NotNull;

public record WorkflowActionPolicyActorRequest(
        @NotNull WorkflowActorType actorType,
        String actorCode
) {}
