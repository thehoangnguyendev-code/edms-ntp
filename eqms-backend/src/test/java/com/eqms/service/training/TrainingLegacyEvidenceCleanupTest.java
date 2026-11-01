package com.eqms.service.training;

import com.eqms.service.AuditTrailService;
import com.eqms.service.ClamAvScanService;
import com.eqms.service.ElectronicSignatureService;
import com.eqms.service.FileStorageService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.io.IOException;

import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

/** A scan that was stored by an import that then rolled back is asked to be removed (the locked store records the refusal for the reconciliation); a committed one is left alone. */
class TrainingLegacyEvidenceCleanupTest {
    private final FileStorageService files = mock(FileStorageService.class);
    private TrainingLegacyEvidenceService service;

    @BeforeEach
    void setUp() {
        service = new TrainingLegacyEvidenceService(mock(JdbcTemplate.class), mock(TrainingAccess.class), mock(ElectronicSignatureService.class),
                mock(AuditTrailService.class), files, mock(ClamAvScanService.class), mock(TrainingNumberService.class), mock(TrainingRecipients.class), mock(TrainingNotifier.class));
        TransactionSynchronizationManager.initSynchronization();
        TransactionSynchronizationManager.setActualTransactionActive(true);
    }

    @AfterEach
    void tearDown() {
        TransactionSynchronizationManager.setActualTransactionActive(false);
        TransactionSynchronizationManager.clearSynchronization();
    }

    private void finish(int status) {
        for (TransactionSynchronization synchronization : TransactionSynchronizationManager.getSynchronizations()) synchronization.afterCompletion(status);
    }

    @Test
    void aRolledBackImportAsksTheStoreToRemoveTheScan() throws Exception {
        service.cleanUpIfNotCommitted("minio://bucket/training/legacy-evidence/x.pdf");
        finish(TransactionSynchronization.STATUS_ROLLED_BACK);
        verify(files).deleteReportArtifact("minio://bucket/training/legacy-evidence/x.pdf");
    }

    @Test
    void aStoreThatRefusesBecauseOfTheRetentionDoesNotBreakTheRollback() throws Exception {
        doThrow(new IOException("MinIO object deletion is disabled because GMP/WORM retention is enabled")).when(files).deleteReportArtifact(anyString());
        service.cleanUpIfNotCommitted("minio://bucket/x.pdf");
        finish(TransactionSynchronization.STATUS_ROLLED_BACK);
        verify(files).deleteReportArtifact("minio://bucket/x.pdf");
    }

    @Test
    void theYearOfAPaperNumberIsTheOneWrittenInIt() {
        org.junit.jupiter.api.Assertions.assertEquals(2026, TrainingLegacyEvidenceService.yearOf("TRN/QA/26-1156"));
        org.junit.jupiter.api.Assertions.assertEquals(2019, TrainingLegacyEvidenceService.yearOf(" trn/qc/19-012 "));
        org.junit.jupiter.api.Assertions.assertNull(TrainingLegacyEvidenceService.yearOf("pap/qa-19.012"));
        org.junit.jupiter.api.Assertions.assertNull(TrainingLegacyEvidenceService.yearOf(null));
    }

    @Test
    void aCommittedImportKeepsItsScan() throws Exception {
        service.cleanUpIfNotCommitted("minio://bucket/x.pdf");
        finish(TransactionSynchronization.STATUS_COMMITTED);
        verify(files, never()).deleteReportArtifact(anyString());
    }
}
