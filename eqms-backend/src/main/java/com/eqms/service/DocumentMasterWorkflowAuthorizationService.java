package com.eqms.service;

import com.eqms.entity.DocumentRecord;
import com.eqms.entity.UserAccount;
import com.eqms.exception.AuthorizationDeniedException;
import com.eqms.service.authorization.AuthorizationEngineService;
import com.eqms.service.authorization.AuthorizationRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Service;

/**
 * Runtime authorization for Document Master lifecycle actions (CANCEL/OBSOLETE).
 *
 * <p>DOCUMENT completed its hybrid-engine cutover (SECURITY_AUTHORIZATION_HYBRID_REFACTOR_PLAN.md
 * §7 cutover rule 5) on real UI/API traffic with zero decision mismatches over an observation
 * window spanning multiple actors and the full document lifecycle. {@link AuthorizationEngineService}
 * (via {@code DocumentResourceAdapter}, which reads {@code lifecycle_state_policies} directly and
 * does not call this class) is now the sole decision authority -- the previous
 * lifecycle-policy-evaluator branch and the legacy/new shadow comparison it existed to support have
 * been removed, not just switched off.
 *
 * <p>Fail-closed by design: if the engine throws (infra failure, bug), this denies with a clear
 * reason rather than falling back to a second decision path -- a GMP system must not silently grant
 * or infer access when it cannot positively verify it.
 */
@Service
public class DocumentMasterWorkflowAuthorizationService {
    private static final Logger log = LoggerFactory.getLogger(DocumentMasterWorkflowAuthorizationService.class);
    private static final String OBJECT_TYPE = "DOCUMENT";

    private final AuthorizationEngineService authorizationEngineService;

    public DocumentMasterWorkflowAuthorizationService(@Lazy AuthorizationEngineService authorizationEngineService) {
        this.authorizationEngineService = authorizationEngineService;
    }

    public Decision check(UserAccount user, DocumentRecord document, String actionCode) {
        if (user == null || user.getId() == null || document == null || document.getId() == null || actionCode == null) {
            return Decision.deny("WORKFLOW_ACTION_NOT_ALLOWED",
                    "The requested Document Master action is not allowed for this document.", null);
        }
        try {
            var policyDecision = authorizationEngineService.authorize(
                    AuthorizationRequest.of(user, OBJECT_TYPE, document.getId(), actionCode));
            return policyDecision.allowed()
                    ? Decision.allow(policyDecision.requiredPermission())
                    : Decision.deny(policyDecision.reasonCode(),
                            "You are not permitted to perform this action for this document.",
                            policyDecision.requiredPermission());
        } catch (Exception e) {
            log.error("Authorization engine failed for document {} action {}: {}",
                    document.getId(), actionCode, e.getMessage(), e);
            return Decision.deny("AUTHORIZATION_ENGINE_ERROR",
                    "Unable to verify authorization for this action right now. Please try again.", null);
        }
    }

    public boolean isAllowed(UserAccount user, DocumentRecord document, String actionCode) {
        return check(user, document, actionCode).allowed();
    }

    public void require(UserAccount user, DocumentRecord document, String actionCode) {
        Decision decision = check(user, document, actionCode);
        if (!decision.allowed()) {
            throw new AuthorizationDeniedException(
                    decision.requiredPermissionCode(),
                    OBJECT_TYPE,
                    document == null ? null : document.getId(),
                    decision.reasonCode(),
                    decision.message()
            );
        }
    }

    public record Decision(boolean allowed, String reasonCode, String message, String requiredPermissionCode) {
        static Decision allow(String requiredPermissionCode) {
            return new Decision(true, null, null, requiredPermissionCode);
        }

        static Decision deny(String reasonCode, String message, String requiredPermissionCode) {
            return new Decision(false, reasonCode, message, requiredPermissionCode);
        }
    }
}
