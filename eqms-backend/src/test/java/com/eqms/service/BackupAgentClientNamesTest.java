package com.eqms.service;

import com.eqms.entity.UserAccount;
import com.eqms.repository.UserAccountRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;

/** The Backup Agent keeps user names; the screens show the full name. */
class BackupAgentClientNamesTest {

    private BackupAgentClient client() {
        UserAccountRepository users = Mockito.mock(UserAccountRepository.class);
        UserAccount admin = new UserAccount();
        admin.setUsername("admin");
        admin.setFullName("Nguyen The Hoang");
        Mockito.when(users.findByUsernameIgnoreCase("admin")).thenReturn(Optional.of(admin));
        Mockito.when(users.findByUsernameIgnoreCase("scheduler")).thenReturn(Optional.empty());
        BackupAgentClient client = new BackupAgentClient("http://agent", "t");
        ReflectionTestUtils.setField(client, "userAccountRepository", users);
        return client;
    }

    @Test
    void replacesUserNamesInPersonFieldsOnlyAndLeavesUnknownOnesAlone() throws Exception {
        JsonNode body = new ObjectMapper().readTree("""
                {"data":[{"restored_by":"admin","closed_by":"scheduler","backup_number":"admin","requestedBy":"Nguyen The Hoang (admin)"}],
                 "verifications":[{"verified_by":"admin"}]}""");
        client().withFullNames(body);
        JsonNode row = body.get("data").get(0);
        assertEquals("Nguyen The Hoang", row.get("restored_by").asText());
        assertEquals("scheduler", row.get("closed_by").asText());
        assertEquals("admin", row.get("backup_number").asText());
        assertEquals("Nguyen The Hoang", row.get("requestedBy").asText());
        assertEquals("Nguyen The Hoang", body.get("verifications").get(0).get("verified_by").asText());
    }
}
