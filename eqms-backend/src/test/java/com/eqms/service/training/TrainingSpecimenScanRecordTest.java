package com.eqms.service.training;

import com.eqms.entity.UserAccount;
import com.eqms.entity.UserStatus;
import com.eqms.repository.UserAccountRepository;
import com.eqms.service.AuditTrailService;
import com.eqms.service.ClamAvScanService;
import com.eqms.service.FileStorageService;
import com.eqms.service.ImageWatermarkService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockMultipartFile;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.ArgumentMatchers.matches;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
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
    @Mock ImageWatermarkService watermark;

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
        // A stamp that changes nothing: the picture shown is the picture uploaded.
        when(watermark.apply(any(ImageWatermarkService.Target.class), any(byte[].class), any(ImageWatermarkService.Stamp.class))).thenAnswer(call ->
                new ImageWatermarkService.Result(call.getArgument(1), "image/png", false, null, "sha", "sha"));
        service = new TrainingSpecimenService(jdbc, access, audit, users, files, virusScan, watermark);
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

    @Test
    void aStampedPictureIsKeptBesideItsOriginalAndTheRowSaysSo() throws Exception {
        when(jdbc.queryForObject(contains("status='APPROVED'"), eq(Integer.class), any(UUID.class))).thenReturn(0);
        when(watermark.apply(any(ImageWatermarkService.Target.class), any(byte[].class), any(ImageWatermarkService.Stamp.class)))
                .thenReturn(new ImageWatermarkService.Result(new byte[]{1, 2, 3}, "image/png", true, null, "original", "stamped"));

        service.upload(actor, null, scan(), scan(), null);

        // The two stamped pictures and the two originals.
        verify(files, times(4)).storeReportArtifact(anyString(), any(), eq("image/png"));
        verify(files).storeReportArtifact(matches(".*[0-9a-f]{12}-original\\.png"), any(), eq("image/png"));
        verify(files).storeReportArtifact(contains("-2-original.png"), any(), eq("image/png"));
        ArgumentCaptor<Object[]> args = ArgumentCaptor.forClass(Object[].class);
        verify(jdbc).update(contains("values (?,?,?,'APPROVED',current_date"), args.capture());
        Object[] row = args.getValue();
        assertThat(row).hasSize(31);
        assertThat(row[8]).isEqualTo(sha256Of(new byte[]{1, 2, 3}));
        assertThat(row[17]).isEqualTo(true);
        assertThat(row[18]).isNotNull();
        assertThat(row[30]).isInstanceOf(java.sql.Timestamp.class);
    }

    @Test
    void aPictureThatWasNotStampedKeepsNoSecondCopy() throws Exception {
        when(jdbc.queryForObject(contains("status='APPROVED'"), eq(Integer.class), any(UUID.class))).thenReturn(0);

        service.upload(actor, null, scan(), scan(), null);

        verify(files, times(2)).storeReportArtifact(anyString(), any(), anyString());
        ArgumentCaptor<Object[]> args = ArgumentCaptor.forClass(Object[].class);
        verify(jdbc).update(contains("values (?,?,?,'APPROVED',current_date"), args.capture());
        assertThat(args.getValue()[17]).isEqualTo(false);
        assertThat(args.getValue()[18]).isNull();
    }

    @Test
    void thePictureOnlyPngAndJpegAreAcceptedForANewSpecimen() throws Exception {
        MockMultipartFile webp = new MockMultipartFile("file", "a.webp", "image/webp", "RIFF....WEBPVP8 ................................".getBytes());
        assertThatThrownBy(() -> service.upload(actor, null, webp, scan(), null)).hasMessage("TRAINING_FILE_REJECTED");
        MockMultipartFile bmp = new MockMultipartFile("file", "a.bmp", "image/bmp", "BM..............................................".getBytes());
        assertThatThrownBy(() -> service.upload(actor, null, bmp, scan(), null)).hasMessage("TRAINING_FILE_REJECTED");
        verify(jdbc, never()).update(contains("insert into training_specimen_signatures"), any(Object[].class));
    }

    private Map<String, Object> storedRow(boolean withOriginal) {
        Map<String, Object> row = new HashMap<>();
        row.put("person_user_id", personId);
        row.put("version_no", 3);
        row.put("provider", "LOCAL");
        row.put("stored_path", "shown-path");
        row.put("content_type", "image/png");
        if (withOriginal) {
            row.put("original_provider", "LOCAL");
            row.put("original_stored_path", "original-path");
            row.put("original_content_type", "image/jpeg");
        }
        return row;
    }

    @Test
    void theOriginalIsOpenedFromItsOwnPathAndWrittenToTheAuditTrailUnderItsOwnAction() throws Exception {
        UUID id = UUID.randomUUID();
        when(jdbc.queryForList(contains("select * from training_specimen_signatures where id=?"), any(UUID.class))).thenReturn(List.of(storedRow(true)));
        when(files.readReportArtifact("LOCAL", "original-path")).thenReturn(new byte[]{9});
        when(files.readReportArtifact("LOCAL", "shown-path")).thenReturn(new byte[]{7});

        Map<String, Object> original = service.image(actor, id, 1, true);
        assertThat(original.get("bytes")).isEqualTo(new byte[]{9});
        assertThat(original.get("contentType")).isEqualTo("image/jpeg");
        verify(audit).logAs(eq(actor), eq("TRAINING_SPECIMEN_SIGNATURE"), anyString(), eq(id), eq("TRAINING_SPECIMEN_ORIGINAL_VIEWED"), isNull(), isNull(), contains("Original"));

        Map<String, Object> shown = service.image(actor, id, 1);
        assertThat(shown.get("bytes")).isEqualTo(new byte[]{7});
        verify(audit).logAs(eq(actor), eq("TRAINING_SPECIMEN_SIGNATURE"), anyString(), eq(id), eq("TRAINING_SPECIMEN_VIEWED"), isNull(), isNull(), anyString());
    }

    @Test
    void anOriginalIsTheSamePictureWhenNothingWasStamped() throws Exception {
        UUID id = UUID.randomUUID();
        when(jdbc.queryForList(contains("select * from training_specimen_signatures where id=?"), any(UUID.class))).thenReturn(List.of(storedRow(false)));
        when(files.readReportArtifact("LOCAL", "shown-path")).thenReturn(new byte[]{7});

        assertThat(service.image(actor, id, 1, true).get("bytes")).isEqualTo(new byte[]{7});
    }

    private static String sha256Of(byte[] bytes) throws Exception {
        return java.util.HexFormat.of().formatHex(java.security.MessageDigest.getInstance("SHA-256").digest(bytes));
    }
}
