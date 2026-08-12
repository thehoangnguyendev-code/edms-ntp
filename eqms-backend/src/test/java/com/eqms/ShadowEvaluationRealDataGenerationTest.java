package com.eqms;

import com.eqms.dto.security.RevisionWorkflowAuthorizationContext;
import com.eqms.entity.ControlledCopyDistributionBatch;
import com.eqms.entity.ControlledCopyRecord;
import com.eqms.entity.DocumentRecord;
import com.eqms.entity.DocumentRevisionRecord;
import com.eqms.entity.UserAccount;
import com.eqms.enums.ControlledCopyWorkflowAction;
import com.eqms.enums.RevisionWorkflowAction;
import com.eqms.repository.ControlledCopyDistributionBatchRepository;
import com.eqms.repository.ControlledCopyRepository;
import com.eqms.repository.DocumentRecordRepository;
import com.eqms.repository.DocumentRevisionRepository;
import com.eqms.repository.UserAccountRepository;
import com.eqms.service.ControlledCopyAuthorizationService;
import com.eqms.service.DocumentMasterWorkflowAuthorizationService;
import com.eqms.service.RevisionWorkflowAuthorizationService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.List;

/**
 * One-off Phase 1-2.4 data-generation script: runs both check() methods (read-only, no mutation)
 * against real DB rows across a spread of documents/revisions/actions/users so
 * authorization_shadow_evaluation_events gets populated with real comparisons between the legacy
 * evaluators and the new AuthorizationEngineService. Not a regression test (no assertions) --
 * delete after the mismatch report has been reviewed.
 */
@SpringBootTest
class ShadowEvaluationRealDataGenerationTest {

    @Autowired private UserAccountRepository userAccountRepository;
    @Autowired private DocumentRecordRepository documentRecordRepository;
    @Autowired private DocumentRevisionRepository documentRevisionRepository;
    @Autowired private RevisionWorkflowAuthorizationService revisionWorkflowAuthorizationService;
    @Autowired private DocumentMasterWorkflowAuthorizationService documentMasterWorkflowAuthorizationService;
    @Autowired private ControlledCopyRepository controlledCopyRepository;
    @Autowired private ControlledCopyDistributionBatchRepository controlledCopyDistributionBatchRepository;
    @Autowired private ControlledCopyAuthorizationService controlledCopyAuthorizationService;

    @Autowired private PlatformTransactionManager transactionManager;

    @Test
    void generateShadowEvaluationTraffic() {
        TransactionTemplate tx = new TransactionTemplate(transactionManager);
        tx.executeWithoutResult(status -> {
            // Sample of users, not all 28 -- keeps runtime bounded while still covering a mix
            // of roles/relations (author/reviewer/approver/unrelated) against every real
            // document/revision in the live DB.
            List<UserAccount> users = userAccountRepository.findAll();
            if (users.size() > 12) {
                users = users.subList(0, 12);
            }
            List<DocumentRecord> documents = documentRecordRepository.findAll();
            List<DocumentRevisionRecord> revisions = documentRevisionRepository.findAll();

            System.out.println("Users=" + users.size() + " Documents=" + documents.size() + " Revisions=" + revisions.size());

            int revisionChecks = 0;
            for (DocumentRevisionRecord revision : revisions) {
                RevisionWorkflowAuthorizationContext context = RevisionWorkflowAuthorizationContext.of(revision);
                for (UserAccount user : users) {
                    for (RevisionWorkflowAction action : RevisionWorkflowAction.values()) {
                        try {
                            revisionWorkflowAuthorizationService.check(user, revision, action, context);
                            revisionChecks++;
                        } catch (Exception e) {
                            // legacy evaluator threw for this combination -- skip, not our concern here
                        }
                    }
                }
            }

            int documentChecks = 0;
            for (DocumentRecord document : documents) {
                for (UserAccount user : users) {
                    for (String action : new String[]{"CANCEL", "OBSOLETE"}) {
                        try {
                            documentMasterWorkflowAuthorizationService.check(user, document, action);
                            documentChecks++;
                        } catch (Exception e) {
                            // legacy evaluator threw for this combination -- skip
                        }
                    }
                }
            }

            List<ControlledCopyRecord> copies = controlledCopyRepository.findAll();
            List<ControlledCopyDistributionBatch> batches = controlledCopyDistributionBatchRepository.findAll();
            System.out.println("Copies=" + copies.size() + " Batches=" + batches.size());

            int copyChecks = 0;
            for (ControlledCopyRecord copy : copies) {
                for (UserAccount user : users) {
                    for (ControlledCopyWorkflowAction action : ControlledCopyWorkflowAction.values()) {
                        if (action == ControlledCopyWorkflowAction.DISTRIBUTE_BATCH
                                || action == ControlledCopyWorkflowAction.RECALL_BATCH
                                || action == ControlledCopyWorkflowAction.REQUEST_COPY) {
                            // REQUEST_COPY has no real target copy in the normal flow -- see
                            // ControlledCopyResourceAdapter#resolvePolicy's REQUEST_COPY comment.
                            continue;
                        }
                        try {
                            controlledCopyAuthorizationService.diagnoseCopyAction(user, copy.getId(), action);
                            copyChecks++;
                        } catch (Exception e) {
                            // legacy evaluator threw for this combination -- skip
                        }
                    }
                }
            }

            int batchChecks = 0;
            for (ControlledCopyDistributionBatch batch : batches) {
                for (UserAccount user : users) {
                    for (ControlledCopyWorkflowAction action : new ControlledCopyWorkflowAction[]{
                            ControlledCopyWorkflowAction.DISTRIBUTE_BATCH, ControlledCopyWorkflowAction.RECALL_BATCH,
                            ControlledCopyWorkflowAction.CANCEL_REQUEST
                    }) {
                        try {
                            controlledCopyAuthorizationService.diagnoseBatchAction(user, batch.getId(), action);
                            batchChecks++;
                        } catch (Exception e) {
                            // legacy evaluator threw for this combination -- skip
                        }
                    }
                }
            }

            System.out.println("revisionChecks=" + revisionChecks + " documentChecks=" + documentChecks
                    + " copyChecks=" + copyChecks + " batchChecks=" + batchChecks);
        });
    }
}
