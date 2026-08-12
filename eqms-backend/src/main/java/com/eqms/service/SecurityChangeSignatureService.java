package com.eqms.service;

import com.eqms.auth.TokenService;
import com.eqms.auth.UnauthorizedException;
import com.eqms.entity.UserAccount;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.util.UUID;

/**
 * Shared e-signature enforcement for security administration changes
 * (RBAC master plan section 16). Critical security configuration mutations
 * must be re-authenticated with a short-lived signature token and recorded
 * as an electronic signature linked to the audit trail.
 *
 * Signature meanings used here (seeded in V164) are security administration
 * meanings and must not be confused with document workflow signatures.
 */
@Service
public class SecurityChangeSignatureService {

    public static final String MEANING_SECURITY_CONFIGURATION_CHANGE = "SECURITY_CONFIGURATION_CHANGE";
    public static final String MEANING_USER_ACCESS_CHANGE = "USER_ACCESS_CHANGE";
    public static final String MEANING_ACCESS_PROFILE_CHANGE = "ACCESS_PROFILE_CHANGE";
    public static final String MEANING_PERMISSION_SET_CHANGE = "PERMISSION_SET_CHANGE";
    public static final String MEANING_WORKFLOW_AUTHORIZATION_CHANGE = "WORKFLOW_AUTHORIZATION_CHANGE";
    public static final String MEANING_SOD_RULE_CHANGE = "SOD_RULE_CHANGE";
    public static final String MEANING_AUDIT_TRAIL_REVIEW = "AUDIT_TRAIL_REVIEW";

    private final TokenService tokenService;
    private final ElectronicSignatureService electronicSignatureService;
    private final boolean esignRequired;

    public SecurityChangeSignatureService(
            TokenService tokenService,
            ElectronicSignatureService electronicSignatureService,
            @Value("${app.security.security-change-esign-required:true}") boolean esignRequired) {
        this.tokenService = tokenService;
        this.electronicSignatureService = electronicSignatureService;
        this.esignRequired = esignRequired;
    }

    /**
     * Validate the signature token BEFORE any mutation so a denied action
     * has no side effect. Throws when the token is missing, invalid, expired,
     * or belongs to a different user.
     */
    public void requireValidToken(UserAccount actor, String signatureToken) {
        if (!esignRequired) {
            return;
        }
        if (actor == null || actor.getId() == null) {
            throw new UnauthorizedException("Authenticated user required for security change signature");
        }
        if (!StringUtils.hasText(signatureToken)) {
            throw new org.springframework.security.access.AccessDeniedException("Electronic signature is required for this security change");
        }
        var parsed = tokenService.parseSignatureToken(signatureToken)
                .orElseThrow(() -> new org.springframework.security.access.AccessDeniedException("Electronic signature is invalid or expired"));
        if (!parsed.principal().userId().equals(actor.getId())) {
            throw new org.springframework.security.access.AccessDeniedException("Electronic signature must belong to the current user");
        }
    }

    /**
     * Persist the electronic signature record AFTER the mutation succeeded
     * (same transaction — a failed mutation rolls the signature back too).
     */
    public void record(
            UserAccount actor,
            String signatureToken,
            String meaning,
            String entityType,
            UUID entityId,
            String entityName,
            String reason,
            String oldValue,
            String newValue) {
        if (!esignRequired) {
            return;
        }
        electronicSignatureService.createEntitySignature(
                entityType, entityId, entityName, actor, signatureToken,
                meaning, reason, null, oldValue, newValue);
    }
}
