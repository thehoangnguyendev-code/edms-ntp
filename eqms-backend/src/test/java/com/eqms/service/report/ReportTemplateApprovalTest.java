package com.eqms.service.report;

import com.eqms.entity.ElectronicSignature;
import com.eqms.entity.UserAccount;
import com.eqms.entity.UserStatus;
import com.eqms.service.AuditTrailService;
import com.eqms.service.EffectivePermissionService;
import com.eqms.service.SecurityChangeSignatureService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.server.ResponseStatusException;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
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

/** REPORT-TEMPLATE-APPROVAL-2026-10-14: submit, approve with a signature, reject; the author and the submitter cannot decide. */
class ReportTemplateApprovalTest {

    private static final String CODE = "EQMS_TOPIC_REGISTER";
    private final JdbcTemplate jdbc = mock(JdbcTemplate.class);
    private final SecurityChangeSignatureService signatures = mock(SecurityChangeSignatureService.class);
    private final UserAccount approver = new UserAccount();
    private final UUID author = UUID.randomUUID();
    private ReportTemplateService service;

    /** Typed matcher: keeps JdbcTemplate's varargs overload selected. */
    private static Object anyObj() {
        return org.mockito.ArgumentMatchers.<Object>any();
    }

    /** A locked row: status, submitted version, and the person who submitted it. */
    private static HashMap<String, Object> row(String status, Integer submittedVersion, UUID submittedBy) {
        var row = new HashMap<String, Object>();
        row.put("definition_version", 2);
        row.put("active", true);
        row.put("deleted_at", null);
        row.put("approval_status", status);
        row.put("submitted_version", submittedVersion);
        row.put("submitted_by_user_id", submittedBy == null ? null : submittedBy.toString());
        return row;
    }

    @BeforeEach
    void setUp() {
        approver.setId(UUID.randomUUID());
        approver.setStatus(UserStatus.Active);
        var permissions = mock(EffectivePermissionService.class);
        when(permissions.getEffectivePermissionCodes(any(UserAccount.class)))
                .thenReturn(Set.of("reports.definition.approve", "reports.definition.manage"));
        service = new ReportTemplateService(jdbc, new ObjectMapper(), permissions, mock(AuditTrailService.class), List.of(new DocumentReportMetadataProvider()));
        service.configureSignatures(signatures);
    }

    private void pendingSubmittedBy(UUID submitter, UUID versionAuthor) {
        when(jdbc.queryForList(anyString(), anyObj())).thenReturn(List.of(row("PENDING_APPROVAL", 2, submitter)));
        when(jdbc.queryForList(anyString(), eq(String.class), anyObj(), anyObj())).thenReturn(List.of(versionAuthor.toString()));
    }

    @Test
    void aDraftCanBeSubmittedOnlyOnce() {
        when(jdbc.queryForList(anyString(), anyObj())).thenReturn(List.of(row("PENDING_APPROVAL", 2, author)));

        assertThatThrownBy(() -> service.submitForApproval(approver, CODE, 2, "again"))
                .isInstanceOfSatisfying(ResponseStatusException.class, e -> assertThat(e.getReason()).isEqualTo("REPORT_TEMPLATE_NOT_DRAFT"));
        verify(jdbc, never()).update(anyString(), anyObj(), anyObj(), anyObj(), anyObj());
    }

    @Test
    void theAuthorOfTheVersionCannotApproveIt() {
        pendingSubmittedBy(UUID.randomUUID(), approver.getId());

        assertThatThrownBy(() -> service.approve(approver, CODE, 2, "Reviewed", "tok"))
                .isInstanceOfSatisfying(ResponseStatusException.class, e -> assertThat(e.getReason()).isEqualTo("REPORT_APPROVER_IS_AUTHOR"));
        verify(jdbc, never()).update(anyString(), anyObj(), anyObj(), anyObj());
    }

    @Test
    void thePersonWhoSubmittedItCannotApproveIt() {
        pendingSubmittedBy(approver.getId(), author);

        assertThatThrownBy(() -> service.approve(approver, CODE, 2, "Reviewed", "tok"))
                .isInstanceOfSatisfying(ResponseStatusException.class, e -> assertThat(e.getReason()).isEqualTo("REPORT_APPROVER_IS_AUTHOR"));
        verify(jdbc, never()).update(anyString(), anyObj(), anyObj(), anyObj());
    }

    @Test
    void anApprovalWithoutAValidSignatureChangesNothing() {
        pendingSubmittedBy(UUID.randomUUID(), author);
        doThrow(new AccessDeniedException("Electronic signature is required")).when(signatures).requireValidToken(approver, null);

        assertThatThrownBy(() -> service.approve(approver, CODE, 2, "Reviewed", null)).isInstanceOf(AccessDeniedException.class);
        verify(jdbc, never()).update(anyString(), anyObj(), anyObj(), anyObj());
        verify(signatures, never()).record(any(), any(), any(), any(), any(), any(), any(), any(), any());
    }

    @Test
    void aSignedApprovalRecordsTheReviewedVersionAndIsAudited() {
        pendingSubmittedBy(UUID.randomUUID(), author);
        var signature = mock(ElectronicSignature.class);
        when(signature.getSignatureId()).thenReturn("ESIG-42");
        when(signatures.record(any(), any(), any(), any(), any(), any(), any(), any(), any())).thenReturn(signature);

        service.approve(approver, CODE, 2, "Checked against the scope", "tok");

        verify(signatures).requireValidToken(approver, "tok");
        verify(signatures).record(eq(approver), eq("tok"), eq(ReportTemplateService.MEANING_TEMPLATE_APPROVAL), eq("REPORT_DEFINITION"), any(),
                eq(CODE), eq("Checked against the scope"), eq("PENDING_APPROVAL"), eq("APPROVED_V2"));
        verify(jdbc).update(anyString(), eq(2), eq(approver.getId()), eq("ESIG-42"), eq(CODE));
    }

    @Test
    void aVersionThatIsNotPendingCannotBeDecided() {
        when(jdbc.queryForList(anyString(), anyObj())).thenReturn(List.of(row("DRAFT", null, null)));

        assertThatThrownBy(() -> service.reject(approver, CODE, 2, "Not clear", "tok"))
                .isInstanceOfSatisfying(ResponseStatusException.class, e -> assertThat(e.getReason()).isEqualTo("REPORT_TEMPLATE_NOT_PENDING"));
        verify(jdbc, never()).update(anyString(), anyObj(), anyObj(), anyObj());
    }

    @Test
    void aRejectionIsSignedAndReturnsTheVersionToDraftWithTheReason() {
        pendingSubmittedBy(UUID.randomUUID(), author);
        var signature = mock(ElectronicSignature.class);
        when(signature.getSignatureId()).thenReturn("ESIG-77");
        when(signatures.record(any(), any(), any(), any(), any(), any(), any(), any(), any())).thenReturn(signature);

        service.reject(approver, CODE, 2, "The filter scope is wrong", "tok");

        verify(signatures).requireValidToken(approver, "tok");
        verify(signatures).record(eq(approver), eq("tok"), eq(ReportTemplateService.MEANING_TEMPLATE_REJECTION), eq("REPORT_DEFINITION"), any(),
                eq(CODE), eq("The filter scope is wrong"), eq("PENDING_APPROVAL"), eq("DRAFT_V2"));
        verify(jdbc).update(anyString(), eq("The filter scope is wrong"), eq(CODE));
    }

    @Test
    void aRejectionWithoutASignatureChangesNothing() {
        pendingSubmittedBy(UUID.randomUUID(), author);
        doThrow(new AccessDeniedException("Electronic signature is required")).when(signatures).requireValidToken(approver, null);

        assertThatThrownBy(() -> service.reject(approver, CODE, 2, "Not clear", null)).isInstanceOf(AccessDeniedException.class);
        verify(jdbc, never()).update(anyString(), anyObj(), anyObj());
    }

    @Test
    void theLifecycleFollowsDraftPendingActiveInactive() {
        assertThat(ReportTemplateService.lifecycleOf(Map.of("active", true, "approvalStatus", "DRAFT"))).isEqualTo("DRAFT");
        assertThat(ReportTemplateService.lifecycleOf(Map.of("active", true, "approvalStatus", "PENDING_APPROVAL"))).isEqualTo("PENDING_APPROVAL");
        assertThat(ReportTemplateService.lifecycleOf(Map.of("active", true, "approvalStatus", "APPROVED"))).isEqualTo("ACTIVE");
        assertThat(ReportTemplateService.lifecycleOf(Map.of("active", false, "approvalStatus", "APPROVED"))).isEqualTo("INACTIVE");
    }

    @Test
    void aVersionOtherThanTheCurrentOneIsRefused() {
        when(jdbc.queryForList(anyString(), anyObj())).thenReturn(List.of(row("DRAFT", null, null)));

        assertThatThrownBy(() -> service.submitForApproval(approver, CODE, 1, null))
                .isInstanceOfSatisfying(ResponseStatusException.class, e -> {
                    assertThat(e.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
                    assertThat(e.getReason()).isEqualTo("REPORT_TEMPLATE_VERSION_CHANGED");
                });
    }

    @Test
    void theAccessIsNotDecidedByNameAlone() {
        // The approve permission is what matters, not the manage permission: a manager without it cannot approve.
        var permissions = mock(EffectivePermissionService.class);
        when(permissions.getEffectivePermissionCodes(any(UserAccount.class))).thenReturn(Set.of("reports.definition.manage"));
        var onlyManager = new ReportTemplateService(jdbc, new ObjectMapper(), permissions, mock(AuditTrailService.class), List.of(new DocumentReportMetadataProvider()));
        assertThatThrownBy(() -> onlyManager.approve(approver, CODE, 2, "Reviewed", "tok")).isInstanceOf(SecurityException.class);
    }
}
