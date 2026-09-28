package com.eqms.service;

import com.eqms.entity.ControlledCopyRecord;
import com.eqms.entity.DocumentRevisionRecord;
import com.eqms.entity.UserAccount;
import com.eqms.repository.ControlledCopyRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Canonical business operation: "obsolete a Revision's Controlled Copies due to a source
 * lifecycle change." Introduced per docs/to-be-sds/01-document-lifecycle.md TBR-DOC-013/014 to
 * replace two independent AS-IS implementations (DocumentService.obsoleteDocument's inline loop
 * and RevisionService.obsoleteDistributedControlledCopies) that mutated the same state with the
 * same effect but were maintained separately. Both callers -- Document Obsolete and Revision
 * publish-supersede -- now invoke this single operation, differing only by the reason code they
 * pass. Runs with default (REQUIRED) propagation so it always joins the caller's existing
 * transaction -- the cascade remains atomic with the caller's own lifecycle mutation, never a
 * separate or asynchronous unit of work.
 */
@Service
public class ControlledCopyLifecycleObsolescenceService {

    public static final String REASON_DOCUMENT_OBSOLETED = "DOCUMENT_OBSOLETED";
    public static final String REASON_NEW_REVISION_PUBLISHED = "NEW_REVISION_PUBLISHED";
    public static final String REASON_REVISION_OBSOLETED = "REVISION_OBSOLETED";

    private final ControlledCopyRepository controlledCopyRepository;
    private final AuditTrailService auditTrailService;
    private final ControlledCopyBatchStatusService controlledCopyBatchStatusService;

    // @Lazy breaks the circular dependency: ControlledCopyService (which owns
    // notifyControlledCopyStakeholders) is itself constructed with several @Lazy-injected
    // dependents already (see its own field comments) -- same pattern reused here rather than
    // constructor-injecting, which would force eager resolution and fail bean creation.
    @org.springframework.beans.factory.annotation.Autowired
    @org.springframework.context.annotation.Lazy
    private ControlledCopyService controlledCopyService;

    public ControlledCopyLifecycleObsolescenceService(
            ControlledCopyRepository controlledCopyRepository,
            AuditTrailService auditTrailService,
            ControlledCopyBatchStatusService controlledCopyBatchStatusService
    ) {
        this.controlledCopyRepository = controlledCopyRepository;
        this.auditTrailService = auditTrailService;
        this.controlledCopyBatchStatusService = controlledCopyBatchStatusService;
    }

    /**
     * Obsoletes every Controlled Copy of {@code sourceRevision} currently Ready-for-Distribution
     * or Distributed. Closed/Cancelled copies are intentionally left untouched -- their terminal
     * state is part of the GMP trail. Joins the caller's existing transaction (no new transaction
     * boundary, no async hop).
     */
    @Transactional
    public void obsoleteControlledCopiesForRevision(
            DocumentRevisionRecord sourceRevision,
            UserAccount actor,
            Instant obsoletedAt,
            String obsoleteReason,
            String auditComment,
            UUID signatureSessionId
    ) {
        if (sourceRevision == null || sourceRevision.getId() == null) {
            return;
        }
        List<ControlledCopyRecord> copies = controlledCopyRepository.findAllByRevision_IdOrderByCopyNumberAsc(sourceRevision.getId());
        for (ControlledCopyRecord copy : copies) {
            boolean distributed = "DISTRIBUTED".equalsIgnoreCase(copy.getStatusCode())
                    || "DISTRIBUTED".equalsIgnoreCase(copy.getCurrentStage());
            boolean readyForDistribution = "READY_FOR_DISTRIBUTION".equalsIgnoreCase(copy.getStatusCode())
                    || "READY FOR DISTRIBUTION".equalsIgnoreCase(copy.getCurrentStage());
            if (!distributed && !readyForDistribution) {
                continue;
            }
            String copyFromStatus = copy.getStatusCode();
            copy.setStatus("Obsoleted");
            copy.setStatusCode("OBSOLETED");
            copy.setCurrentStage("Obsoleted");
            copy.setObsoleteReason(obsoleteReason);
            copy.setObsoletedBy(actor);
            copy.setObsoletedAt(obsoletedAt);
            controlledCopyRepository.save(copy);
            auditTrailService.logAs(
                    actor,
                    "Controlled Copy",
                    copy.getControlledCopyNumber(),
                    copy.getId(),
                    "OBSOLETE",
                    copyFromStatus,
                    "Obsoleted",
                    auditComment,
                    List.of(),
                    signatureSessionId
            );
            // Was previously silent -- the copy's holder(s) had no way to learn their controlled
            // copy is no longer valid short of checking the portal. Safe to call unconditionally:
            // notifyControlledCopyStakeholders already catches and logs its own failures rather
            // than throwing, so a notification problem never blocks this cascade.
            controlledCopyService.notifyControlledCopyStakeholders(copy, actor, "OBSOLETE", auditComment);
        }
        controlledCopyBatchStatusService.synchronize(
                controlledCopyRepository.findAllByRevision_IdOrderByCopyNumberAsc(sourceRevision.getId())
        );
    }
}
