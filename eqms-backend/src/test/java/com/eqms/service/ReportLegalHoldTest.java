package com.eqms.service;

import com.eqms.entity.ElectronicSignature;
import com.eqms.entity.UserAccount;
import com.eqms.entity.UserStatus;
import com.eqms.repository.DocumentRecordRepository;
import com.eqms.repository.UserAccountRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** REPORT-LEGAL-HOLD-2026-10-14: applying needs a reason; releasing needs another person and an electronic signature. */
class ReportLegalHoldTest {

    private final JdbcTemplate jdbc = mock(JdbcTemplate.class);
    private final PermissionEvaluationService permissions = mock(PermissionEvaluationService.class);
    private final AuditTrailService audit = mock(AuditTrailService.class);
    private final SecurityChangeSignatureService signatures = mock(SecurityChangeSignatureService.class);
    private final UUID applierId = UUID.randomUUID();
    private final UUID runId = UUID.randomUUID();
    private final UUID artifactId = UUID.randomUUID();
    private final UserAccount actor = new UserAccount();
    private ReportPlatformService service;


    /** Typed matcher: keeps JdbcTemplate's varargs overload selected, as the service call does. */
    private static Object anyObj() {
        return org.mockito.ArgumentMatchers.<Object>any();
    }

    @BeforeEach
    void setUp() {
        actor.setId(UUID.randomUUID());
        actor.setUsername("qa.two");
        actor.setStatus(UserStatus.Active);
        when(permissions.hasPermission(any(UserAccount.class), anyString())).thenReturn(true);
        service = new ReportPlatformService(jdbc, new ObjectMapper(), permissions, mock(DocumentRecordRepository.class),
                mock(UserAccountRepository.class), mock(DocumentAuthorizationService.class), mock(FileStorageService.class), audit);
        service.configureSignatures(signatures);
        when(jdbc.update(anyString(), anyObj(), anyObj(), anyObj())).thenReturn(1);
    }

    /** The file is held (or not) now, and the last hold was applied by the given person. */
    private void stateIs(boolean held, List<String> appliers) {
        when(jdbc.queryForMap(anyString(), anyObj(), anyObj())).thenReturn(Map.of("legal_hold", held, "generated_filename", "report.pdf"));
        when(jdbc.queryForList(anyString(), eq(String.class), anyObj(), anyObj())).thenReturn(appliers);
    }

    @Test
    void applyingAHoldNeedsAReason() {
        stateIs(false, List.of());
        assertThatThrownBy(() -> service.setArtifactLegalHold(actor, runId, artifactId, true, "  ", null))
                .isInstanceOf(IllegalArgumentException.class);
        verify(jdbc, never()).update(anyString(), anyObj(), anyObj(), anyObj());
    }

    @Test
    void applyingAHoldNeedsNoSignature() {
        stateIs(false, List.of());
        service.setArtifactLegalHold(actor, runId, artifactId, true, "Investigation 2026-07", null);
        verify(jdbc).update(anyString(), eq(true), eq(artifactId), eq(runId));
        verify(signatures, never()).requireValidToken(any(), any());
    }

    @Test
    void holdingAnAlreadyHeldFileIsRefused() {
        stateIs(true, List.of(applierId.toString()));
        assertThatThrownBy(() -> service.setArtifactLegalHold(actor, runId, artifactId, true, "again", null))
                .isInstanceOfSatisfying(ResponseStatusException.class, e -> assertThat(e.getReason()).isEqualTo("REPORT_LEGAL_HOLD_UNCHANGED"));
    }

    @Test
    void theSamePersonCannotReleaseTheirOwnHold() {
        stateIs(true, List.of(actor.getId().toString()));
        assertThatThrownBy(() -> service.setArtifactLegalHold(actor, runId, artifactId, false, "release", "tok"))
                .isInstanceOfSatisfying(ResponseStatusException.class, e -> {
                    assertThat(e.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
                    assertThat(e.getReason()).isEqualTo("REPORT_LEGAL_HOLD_SAME_PERSON");
                });
        verify(jdbc, never()).update(anyString(), anyObj(), anyObj(), anyObj());
    }

    @Test
    void aReleaseWhoseApplierIsUnknownIsRefused() {
        stateIs(true, List.of());
        assertThatThrownBy(() -> service.setArtifactLegalHold(actor, runId, artifactId, false, "release", "tok"))
                .isInstanceOfSatisfying(ResponseStatusException.class, e -> assertThat(e.getReason()).isEqualTo("REPORT_LEGAL_HOLD_APPLIER_UNKNOWN"));
        verify(jdbc, never()).update(anyString(), anyObj(), anyObj(), anyObj());
    }

    @Test
    void aReleaseWithoutAValidSignatureChangesNothing() {
        stateIs(true, List.of(applierId.toString()));
        doThrow(new AccessDeniedException("Electronic signature is required")).when(signatures).requireValidToken(actor, null);
        assertThatThrownBy(() -> service.setArtifactLegalHold(actor, runId, artifactId, false, "release", null))
                .isInstanceOf(AccessDeniedException.class);
        verify(jdbc, never()).update(anyString(), anyObj(), anyObj(), anyObj());
        verify(signatures, never()).record(any(), any(), any(), any(), any(), any(), any(), any(), any());
    }

    @Test
    void anotherPersonReleasesWithASignatureAndTheReleaseIsRecorded() {
        stateIs(true, List.of(applierId.toString()));
        ElectronicSignature signature = mock(ElectronicSignature.class);
        when(signature.getSignatureId()).thenReturn("ESIG-900");
        when(signatures.record(eq(actor), eq("tok"), eq(ReportPlatformService.MEANING_LEGAL_HOLD_RELEASE), eq("REPORT_ARTIFACT"), eq(artifactId),
                eq("report.pdf"), eq("Investigation closed"), eq("HELD"), eq("RELEASED"))).thenReturn(signature);

        service.setArtifactLegalHold(actor, runId, artifactId, false, "Investigation closed", "tok");

        verify(signatures).requireValidToken(actor, "tok");
        verify(jdbc).update(anyString(), eq(false), eq(artifactId), eq(runId));
        verify(audit).logAs(eq(actor), eq("REPORT_ARTIFACT"), eq(artifactId.toString()), eq(artifactId), eq("REPORT_LEGAL_HOLD_RELEASED"), any(), any(),
                eq("Investigation closed [signature ESIG-900]"));
    }
}
