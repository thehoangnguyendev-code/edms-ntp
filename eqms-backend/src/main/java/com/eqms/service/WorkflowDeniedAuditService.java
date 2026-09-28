package com.eqms.service;

import com.eqms.entity.UserAccount;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

/**
 * Persists denied workflow attempts in their own transaction. The denial makes the caller throw,
 * which rolls back the caller's transaction; an audit row written inside it would be lost.
 */
@Service
public class WorkflowDeniedAuditService {

    private final AuditTrailService auditTrailService;

    public WorkflowDeniedAuditService(AuditTrailService auditTrailService) {
        this.auditTrailService = auditTrailService;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void recordDenied(UserAccount actor, String entityType, String entityName, UUID entityId,
                             String actionType, String status, String comment) {
        auditTrailService.logAs(actor, entityType, entityName, entityId,
                actionType, status, status, comment);
    }
}
