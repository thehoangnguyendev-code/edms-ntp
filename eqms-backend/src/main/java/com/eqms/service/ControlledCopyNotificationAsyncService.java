package com.eqms.service;

import com.eqms.entity.ControlledCopyRecord;
import com.eqms.entity.UserAccount;
import com.eqms.repository.ControlledCopyRepository;
import com.eqms.repository.UserAccountRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Async;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * Runs the stakeholder notification (in-app + e-mail) for a single-copy Controlled Copy action
 * after its transaction commits -- see {@link ControlledCopyActionNotificationEvent} for why.
 * Deliberately its own small class (not folded into ControlledCopyService) so its dedicated
 * executor is easy to reason about and doesn't compete with the heavier per-copy PDF composition
 * work on {@code controlledCopyBatchExecutor}.
 */
@org.springframework.stereotype.Service
public class ControlledCopyNotificationAsyncService {

    private static final Logger log = LoggerFactory.getLogger(ControlledCopyNotificationAsyncService.class);

    private final ControlledCopyService controlledCopyService;
    private final ControlledCopyRepository controlledCopyRepository;
    private final UserAccountRepository userAccountRepository;

    public ControlledCopyNotificationAsyncService(
            ControlledCopyService controlledCopyService,
            ControlledCopyRepository controlledCopyRepository,
            UserAccountRepository userAccountRepository
    ) {
        this.controlledCopyService = controlledCopyService;
        this.controlledCopyRepository = controlledCopyRepository;
        this.userAccountRepository = userAccountRepository;
    }

    @Async("controlledCopyNotificationExecutor")
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onControlledCopyAction(ControlledCopyActionNotificationEvent event) {
        if (event == null || event.copyId() == null) {
            return;
        }
        try {
            ControlledCopyRecord copy = controlledCopyRepository.findByIdWithDistributionBatch(event.copyId()).orElse(null);
            if (copy == null) {
                log.warn("Skipping controlled copy notification for {}: copy no longer exists.", event.copyId());
                return;
            }
            UserAccount actor = event.actorUserId() == null ? null : userAccountRepository.findById(event.actorUserId()).orElse(null);
            controlledCopyService.notifyControlledCopyStakeholders(copy, actor, event.action(), event.comment());
            if (event.previewPassword() != null) {
                // Only DISTRIBUTE carries a previewPassword -- the recipient-facing e-mail with the
                // preview link + credential. See sendControlledCopyDistributionNotification's own
                // javadoc for why this is a separate call from the generic stakeholder notification
                // above (different template/recipient-resolution rules).
                controlledCopyService.sendControlledCopyDistributionNotification(copy, actor, event.comment(), false, event.previewPassword());
            }
        } catch (Exception ex) {
            log.warn("Failed to dispatch controlled copy notification for copy {} action {}: {}", event.copyId(), event.action(), ex.getMessage(), ex);
        }
    }
}
