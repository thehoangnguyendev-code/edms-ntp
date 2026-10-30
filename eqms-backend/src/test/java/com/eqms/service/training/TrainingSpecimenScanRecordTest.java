package com.eqms.service.training;

import com.eqms.entity.UserAccount;
import com.eqms.entity.UserStatus;
import com.eqms.repository.UserAccountRepository;
import com.eqms.service.AuditTrailService;
import com.eqms.service.ClamAvScanService;
import com.eqms.service.FileStorageService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockMultipartFile;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** Specimen signature (FRM.0007): the scan of the signed paper is the current record at once, nobody confirms it (owner decision 2026-10-28). */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class TrainingSpecimenScanRecordTest {
    @Mock JdbcTemplate jdbc;
    @Mock TrainingAccess access;
    @Mock AuditTrailService audit;
    @Mock UserAccountRepository users;
    @Mock FileStorageService files;
    @Mock ClamAvScanService virusScan;

    private final UUID personId = UUID.randomUUID();
    private final UserAccount actor = mock(UserAccount.class);
    private TrainingSpecimenService service;

    private static byte[] png() throws Exception {
        try (ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            ImageIO.write(new BufferedImage(120, 60, BufferedImage.TYPE_INT_RGB), "png", out);
            return out.toByteArray();
        }
    }

    @BeforeEach
    void setUp() throws Exception {
        when(actor.getId()).thenReturn(personId);
        when(actor.getFullName()).thenReturn("An");
        when(actor.getStatus()).thenReturn(UserStatus.Active);
        when(users.findById(personId)).thenReturn(java.util.Optional.of(actor));
        when(virusScan.scan(any())).thenReturn(new ClamAvScanService.ScanResult(true, null));
        when(files.storeReportArtifact(anyString(), any(), anyString())).thenReturn(new FileStorageService.StorageWriteResult(null, "path", "LOCAL", "bucket", "key", null, "sha"));
        when(jdbc.queryForObject(contains("coalesce(max(version_no),0)+1"), eq(Number.class), any(UUID.class))).thenReturn(2);
        when(jdbc.queryForList(contains("where s.id=?"), any(UUID.class))).thenReturn(List.of(Map.<String, Object>of("id", UUID.randomUUID())));
        service = new TrainingSpecimenService(jdbc, access, audit, users, files, virusScan);
    }

    private MockMultipartFile scan() throws Exception {
        return new MockMultipartFile("file", "a.png", "image/png", png());
    }

    @Test
    void theScanBecomesTheCurrentRecordAndTheEarlierOneIsSuperseded() throws Exception {
        when(jdbc.queryForObject(contains("status='APPROVED'"), eq(Integer.class), any(UUID.class))).thenReturn(1);

        service.upload(actor, null, scan(), scan(), "Signature changed");

        var order = inOrder(jdbc, audit);
        order.verify(jdbc).update(contains("set status='OBSOLETED'"), any(UUID.class));
        order.verify(jdbc).update(contains("values (?,?,?,'APPROVED',current_date"), any(Object[].class));
        order.verify(audit).logAs(eq(actor), eq("TRAINING_SPECIMEN_SIGNATURE"), anyString(), any(UUID.class), eq("TRAINING_SPECIMEN_UPLOADED"), eq("APPROVED"), eq("APPROVED"), eq("Signature changed"));
    }

    @Test
    void aFirstScanNeedsNoReasonAndAReplacementDoes() throws Exception {
        when(jdbc.queryForObject(contains("status='APPROVED'"), eq(Integer.class), any(UUID.class))).thenReturn(0);
        service.upload(actor, null, scan(), scan(), null);
        verify(jdbc).update(contains("values (?,?,?,'APPROVED',current_date"), any(Object[].class));

        when(jdbc.queryForObject(contains("status='APPROVED'"), eq(Integer.class), any(UUID.class))).thenReturn(1);
        assertThatThrownBy(() -> service.upload(actor, null, scan(), scan(), " ")).hasMessage("TRAINING_REASON_REQUIRED");
    }

    @Test
    void bothScansAreRequiredAndNoConfirmationIsAsked() throws Exception {
        assertThatThrownBy(() -> service.upload(actor, null, scan(), null, null)).hasMessage("TRAINING_SPECIMEN_SECOND_REQUIRED");
        verify(jdbc, never()).update(contains("insert into training_specimen_signatures"), any(Object[].class));
        verify(jdbc, never()).update(contains("training_approval_assignments"), any(Object[].class));
    }
}
