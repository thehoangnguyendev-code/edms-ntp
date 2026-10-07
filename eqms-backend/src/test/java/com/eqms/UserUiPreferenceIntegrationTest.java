package com.eqms;

import com.eqms.entity.UserAccount;
import com.eqms.repository.UserAccountRepository;
import com.eqms.repository.UserUiPreferenceRepository;
import com.eqms.service.UserUiPreferenceService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Assumptions;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** V553 and the service against the real schema: a preference is per user, upserted, deletable, and goes with its user. */
@SpringBootTest
@Transactional
class UserUiPreferenceIntegrationTest {

    private static final String KEY = UserUiPreferenceService.NOTIFICATION_DOCK;

    @Autowired private UserUiPreferenceService service;
    @Autowired private UserUiPreferenceRepository repository;
    @Autowired private UserAccountRepository users;
    @Autowired private JdbcTemplate jdbc;
    private final ObjectMapper mapper = new ObjectMapper();

    private List<UserAccount> twoUsers() {
        List<UserAccount> all = users.findAll();
        Assumptions.assumeTrue(all.size() >= 2, "Seed data needs two users");
        return all.subList(0, 2);
    }

    @Test
    void savesUpdatesReadsAndResetsAPreference() throws Exception {
        UUID ada = twoUsers().get(0).getId();
        assertThat(service.find(ada, KEY)).isEmpty();

        service.save(ada, KEY, mapper.readTree("{\"pinned\":true}"));
        assertThat(service.find(ada, KEY).orElseThrow().get("pinned").asBoolean()).isTrue();

        service.save(ada, KEY, mapper.readTree("{\"pinned\":false}"));
        assertThat(service.find(ada, KEY).orElseThrow().get("pinned").asBoolean()).isFalse();
        assertThat(repository.findAll().stream().filter(row -> row.getUserId().equals(ada) && row.getPrefKey().equals(KEY)).count()).isEqualTo(1);

        service.reset(ada, KEY);
        assertThat(service.find(ada, KEY)).isEmpty();
    }

    @Test
    void oneUsersChoiceNeverShowsUpForAnotherUser() throws Exception {
        List<UserAccount> pair = twoUsers();
        service.save(pair.get(0).getId(), KEY, mapper.readTree("{\"pinned\":true}"));

        assertThat(service.find(pair.get(1).getId(), KEY)).isEmpty();
    }

    @Test
    void theDatabaseItselfAllowsOnlyOneRowPerUserAndKey() {
        UUID ada = twoUsers().get(0).getId();
        jdbc.update("insert into user_ui_preferences (user_id, pref_key, value) values (?, ?, ?)", ada, KEY, "{\"pinned\":true}");

        assertThatThrownBy(() -> jdbc.update("insert into user_ui_preferences (user_id, pref_key, value) values (?, ?, ?)", ada, KEY, "{\"pinned\":false}"))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    // Each constraint is checked in its own test: after a violation PostgreSQL refuses further statements in the same transaction.
    @Test
    void theDatabaseItselfRefusesAPreferenceForAUserThatDoesNotExist() {
        assertThatThrownBy(() -> jdbc.update("insert into user_ui_preferences (user_id, pref_key, value) values (?, ?, ?)", UUID.randomUUID(), KEY, "{}"))
                .isInstanceOf(DataIntegrityViolationException.class);
    }
}
