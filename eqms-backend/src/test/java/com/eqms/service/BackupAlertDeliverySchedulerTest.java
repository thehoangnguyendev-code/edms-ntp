package com.eqms.service;

import com.eqms.entity.UserAccount;
import com.eqms.entity.UserStatus;
import com.eqms.repository.UserAccountRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.http.HttpMethod;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** Telling the recipients about the alerts the agent raised: by the channels the rule allows, and an alert is done only when everyone was told. */
class BackupAlertDeliverySchedulerTest {

    private static final ObjectMapper JSON = new ObjectMapper();

    BackupAgentClient agent = mock(BackupAgentClient.class);
    UserAccountRepository users = mock(UserAccountRepository.class);
    NotificationDispatcher dispatcher = mock(NotificationDispatcher.class);
    DistributedSchedulerLockService locks = mock(DistributedSchedulerLockService.class);
    BackupAlertDeliveryScheduler scheduler;
    UserAccount alice = mock(UserAccount.class);

    @BeforeEach
    void setUp() {
        scheduler = new BackupAlertDeliveryScheduler(agent, users, dispatcher, locks);
        when(alice.getUsername()).thenReturn("alice");
        when(alice.getEmail()).thenReturn("alice@example.com");
        when(alice.getStatus()).thenReturn(UserStatus.Active);
        when(users.findByUsernameIgnoreCase("alice")).thenReturn(Optional.of(alice));
    }

    private void pending(String json) throws Exception {
        when(agent.exchange(eq(HttpMethod.GET), eq("/internal/alerts/pending-delivery?limit=50"), any()))
                .thenReturn(new BackupAgentClient.Reply(200, JSON.readTree(json)));
    }

    @Test
    void anAlertGoesThroughTheRegistryEventWithTheChannelsItsRuleAllowsThenIsMarkedDone() throws Exception {
        pending("{\"recipients\":[\"alice\"],\"alerts\":[{\"id\":\"a1\",\"code\":\"BACKUP_DUMP_FAILED\",\"severity\":\"HIGH\",\"detail\":\"pg_dump failed\",\"ref\":\"BK-1\",\"inApp\":true,\"email\":true}]}");
        assertThat(scheduler.run()).isEqualTo(1);
        ArgumentCaptor<Map<String, String>> variables = ArgumentCaptor.forClass(Map.class);
        verify(dispatcher).dispatchIndependently(eq("backup.alert"), eq(List.of(alice)), variables.capture(), eq(Set.of("IN_APP", "EMAIL")));
        assertThat(variables.getValue()).containsEntry("title", "Backup alert: Backup Dump Failed").containsEntry("actionUrl", "/settings/administration/backup/alerts");
        assertThat(variables.getValue().get("message")).contains("pg_dump failed").contains("Severity: High").contains("BK-1").doesNotContain("HIGH");
        verify(agent).exchange(HttpMethod.POST, "/internal/alerts/delivered", Map.of("ids", List.of("a1")));
    }

    @Test
    void aRuleThatTurnsAChannelOffIsHonoured() throws Exception {
        pending("{\"recipients\":[\"alice\"],\"alerts\":[{\"id\":\"a2\",\"code\":\"AGENT_RESTARTED\",\"severity\":\"INFO\",\"detail\":\"restarted\",\"ref\":\"\",\"inApp\":true,\"email\":false}]}");
        scheduler.run();
        verify(dispatcher).dispatchIndependently(eq("backup.alert"), eq(List.of(alice)), any(), eq(Set.of("IN_APP")));
    }

    @Test
    void anAlertWithNoChannelIsNotDispatchedButIsDone() throws Exception {
        pending("{\"recipients\":[\"alice\"],\"alerts\":[{\"id\":\"a5\",\"code\":\"X\",\"severity\":\"INFO\",\"detail\":\"x\",\"ref\":\"\",\"inApp\":false,\"email\":false}]}");
        assertThat(scheduler.run()).isEqualTo(1);
        verify(dispatcher, never()).dispatchIndependently(anyString(), any(), any(), org.mockito.ArgumentMatchers.<Set<String>>any());
    }

    @Test
    void anAlertIsNotMarkedDoneWhenTellingSomeoneFailedSoItIsTriedAgain() throws Exception {
        pending("{\"recipients\":[\"alice\"],\"alerts\":[{\"id\":\"a3\",\"code\":\"BACKUP_DUMP_FAILED\",\"severity\":\"HIGH\",\"detail\":\"x\",\"ref\":\"BK-3\",\"inApp\":true,\"email\":false}]}");
        doThrow(new IllegalStateException("database busy")).when(dispatcher).dispatchIndependently(anyString(), any(), any(), org.mockito.ArgumentMatchers.<Set<String>>any());
        assertThat(scheduler.run()).isZero();
        verify(agent, never()).exchange(eq(HttpMethod.POST), eq("/internal/alerts/delivered"), any());
    }

    @Test
    void nothingIsDoneWhenThereIsNothingToTellOrTheAgentCannotAnswer() throws Exception {
        pending("{\"recipients\":[\"alice\"],\"alerts\":[]}");
        assertThat(scheduler.run()).isZero();
        when(agent.exchange(eq(HttpMethod.GET), eq("/internal/alerts/pending-delivery?limit=50"), any())).thenReturn(new BackupAgentClient.Reply(404, JSON.readTree("{}")));
        assertThat(scheduler.run()).isZero();
        verify(dispatcher, never()).dispatchIndependently(anyString(), any(), any(), org.mockito.ArgumentMatchers.<Set<String>>any());
    }

    @Test
    void aRecipientWhoIsNoLongerActiveIsNotTold() throws Exception {
        when(alice.getStatus()).thenReturn(UserStatus.Inactive);
        pending("{\"recipients\":[\"alice\"],\"alerts\":[{\"id\":\"a4\",\"code\":\"BACKUP_DUMP_FAILED\",\"severity\":\"HIGH\",\"detail\":\"x\",\"ref\":\"\",\"inApp\":true,\"email\":true}]}");
        scheduler.run();
        verify(dispatcher, never()).dispatchIndependently(anyString(), any(), any(), org.mockito.ArgumentMatchers.<Set<String>>any());
    }
}
