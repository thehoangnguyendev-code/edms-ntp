package com.eqms.dto.security;

/** A single, stable evaluation layer shown only to Security Administrators. */
public record EffectiveAccessDiagnosisLayer(
        String layerCode,
        boolean passed,
        String reasonCode,
        String message
) {}
