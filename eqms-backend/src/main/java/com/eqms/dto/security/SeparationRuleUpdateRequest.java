package com.eqms.dto.security;

public record SeparationRuleUpdateRequest(Boolean enabled, String reason, String signatureToken) {}
