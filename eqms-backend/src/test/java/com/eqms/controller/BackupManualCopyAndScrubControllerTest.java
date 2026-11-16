package com.eqms.controller;

import com.eqms.auth.CurrentUserService;
import com.eqms.entity.UserAccount;
import com.eqms.service.AuditTrailService;
import com.eqms.service.BackupAgentClient;
import com.eqms.service.PermissionEvaluationService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.server.ResponseStatusException;

import java.util.Arrays;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/** The manual copy a person records, and the check of the live file store: permissions, bounds, audit and what is sent to the agent. */
class BackupManualCopyAndScrubControllerTest {

    private static final ObjectMapper JSON = new ObjectMapper();

    CurrentUserService users = mock(CurrentUserService.class);
    PermissionEvaluationService permissions = mock(PermissionEvaluationService.class);
    BackupAgentClient agent = mock(BackupAgentClient.class);
    AuditTrailService audit = mock(AuditTrailService.class);
    UserAccount actor = mock(UserAccount.class);
    BackupManualCopyController copies;
    BackupStoreScrubController scrubs;

    private BackupAgentClient.Reply reply(int code, String body) throws Exception {
        return new BackupAgentClient.Reply(code, JSON.readTree(body));
    }

    private void allow(String... codes) {
        when(permissions.hasAnyPermission(any(UserAccount.class), any(String[].class))).thenAnswer(inv -> {
            Object[] args = inv.getArguments();
            for (int i = 1; i < args.length; i++) {
                if (args[i] instanceof String s && Arrays.asList(codes).contains(s)) return true;
                if (args[i] instanceof String[] arr && Arrays.stream(arr).anyMatch(Arrays.asList(codes)::contains)) return true;
            }
            return false;
        });
    }

    @BeforeEach
    void setUp() {
        copies = new BackupManualCopyController(users, permissions, agent, audit);
        scrubs = new BackupStoreScrubController(users, permissions, agent, audit);
        when(users.requireCurrentUser()).thenReturn(actor);
        when(actor.getUsername()).thenReturn("admin");
    }

    @Test
    void aManualCopyIsRecordedOnlyWithItsOwnPermissionAndIsAuditedWithTheNameOfTheActor() throws Exception {
        allow("backup.admin.storage.view");
        assertThatThrownBy(() -> copies.record(new BackupManualCopyController.RecordBody("2026-11-10", null, "Safe", "A", null)))
                .isInstanceOf(AccessDeniedException.class);
        verifyNoInteractions(agent);

        allow("backup.admin.storage.view", "backup.admin.manual_copy.manage");
        when(agent.exchange(eq(HttpMethod.POST), eq("/internal/manual-copies"), any())).thenReturn(reply(201, "{\"id\":\"abc\",\"copiedOn\":\"2026-11-10\"}"));
        copies.record(new BackupManualCopyController.RecordBody("2026-11-10", "BK-1", "Safe, head office", "Nguyen Van A", "first"));
        verify(audit).logAs(eq(actor), eq("BACKUP_MANUAL_COPY"), eq("abc"), any(), eq("MANUAL_COPY_RECORDED"), isNull(), eq("RECORDED"), anyString());
        @SuppressWarnings("unchecked")
        org.mockito.ArgumentCaptor<java.util.Map<String, Object>> sent = org.mockito.ArgumentCaptor.forClass(java.util.Map.class);
        verify(agent).exchange(eq(HttpMethod.POST), eq("/internal/manual-copies"), sent.capture());
        assertThat(sent.getValue()).containsEntry("by", "admin").containsEntry("place", "Safe, head office").containsEntry("backupNumber", "BK-1");
    }

    @Test
    void aRefusedManualCopyIsNotAuditedAndTextIsBoundedBeforeItGoesToTheAgent() throws Exception {
        allow("backup.admin.storage.view", "backup.admin.manual_copy.manage");
        when(agent.exchange(eq(HttpMethod.POST), eq("/internal/manual-copies"), any())).thenReturn(reply(400, "{\"code\":\"MANUAL_COPY_PLACE_REQUIRED\"}"));
        copies.record(new BackupManualCopyController.RecordBody("2026-11-10", null, "x".repeat(5000), "A", null));
        @SuppressWarnings("unchecked")
        org.mockito.ArgumentCaptor<java.util.Map<String, Object>> sent = org.mockito.ArgumentCaptor.forClass(java.util.Map.class);
        verify(agent).exchange(eq(HttpMethod.POST), eq("/internal/manual-copies"), sent.capture());
        assertThat(((String) sent.getValue().get("place")).length()).isLessThanOrEqualTo(201);
        verify(audit, never()).logAs(any(), anyString(), anyString(), any(), anyString(), any(), any(), anyString());
    }

    @Test
    void theManualCopyStatusAndListAreSeenWithTheStoragePermissionAndPagesAreBounded() throws Exception {
        allow("backup.admin.storage.view");
        when(agent.exchange(eq(HttpMethod.GET), anyString(), any())).thenReturn(reply(200, "{}"));
        copies.status();
        copies.list(-3, 5000);
        verify(agent).exchange(HttpMethod.GET, "/internal/manual-copies/status", null);
        verify(agent).exchange(HttpMethod.GET, "/internal/manual-copies?page=1&limit=100", null);
        allow();
        assertThatThrownBy(() -> copies.status()).isInstanceOf(AccessDeniedException.class);
    }

    @Test
    void theFileStoreCheckIsStartedOnlyByThoseWhoMayVerifyAndTheIdIsChecked() throws Exception {
        allow("backup.module.view");
        assertThatThrownBy(() -> scrubs.start()).isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(() -> scrubs.detail("../../etc/passwd"))
                .isInstanceOfSatisfying(ResponseStatusException.class, e -> assertThat(e.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND));
        verifyNoInteractions(agent);

        allow("backup.module.view", "backup.backup.verify");
        when(agent.exchange(eq(HttpMethod.POST), eq("/internal/store-scrubs"), any())).thenReturn(reply(202, "{\"jobId\":\"j-1\"}"));
        scrubs.start();
        verify(audit).logAs(eq(actor), eq("BACKUP_STORE_SCRUB"), eq("Live file store check"), any(), eq("STORE_SCRUB_STARTED"), isNull(), eq("QUEUED"), anyString());
    }

    @Test
    void theFileStoreChecksAreListedWithABoundedPage() throws Exception {
        allow("backup.module.view");
        when(agent.exchange(eq(HttpMethod.GET), anyString(), any())).thenReturn(reply(200, "{\"data\":[]}"));
        scrubs.list(0, 9999);
        verify(agent).exchange(HttpMethod.GET, "/internal/store-scrubs?page=1&limit=100", null);
    }
}
