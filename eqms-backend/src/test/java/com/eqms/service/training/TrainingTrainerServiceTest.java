package com.eqms.service.training;

import com.eqms.entity.UserAccount;
import com.eqms.repository.UserAccountRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/** D-10: a trainer with a GMP record who was not trained on the topic is qualified only through the permission QA grants, never through heading the department. */
@ExtendWith(MockitoExtension.class)
class TrainingTrainerServiceTest {

    @Mock JdbcTemplate jdbc;
    @Mock TrainingAccess access;
    @Mock UserAccountRepository users;

    private final UUID sessionId = UUID.randomUUID();
    private final UUID trainerId = UUID.randomUUID();
    private final UserAccount trainer = mock(UserAccount.class);

    private Map<String, Object> qualification(boolean holdsPermission) {
        when(jdbc.queryForList(contains("from training_sessions s join"), eq(sessionId))).thenReturn(List.of(Map.of("trainer_user_id", trainerId, "organizer_department_id", UUID.randomUUID())));
        when(jdbc.queryForObject(contains("lower(r.topic_text) like '%gmp%'"), eq(Integer.class), eq(trainerId))).thenReturn(1);
        when(jdbc.queryForList(contains("from training_session_topics"), eq(sessionId))).thenReturn(List.of(Map.of("topic_text", "Gowning")));
        when(jdbc.queryForObject(contains("lower(r.topic_text) = lower(?)"), eq(Integer.class), any(), any(), any(), any())).thenReturn(0);
        when(jdbc.queryForList(contains("training_trainer_exceptions"), eq(sessionId))).thenReturn(List.of());
        when(users.findById(trainerId)).thenReturn(Optional.of(trainer));
        when(access.has(trainer, "training.trainer.qualified")).thenReturn(holdsPermission);
        return new TrainingTrainerService(jdbc, access, null, null, null, null, users).qualification(sessionId);
    }

    @Test
    void aTrainerWhoWasNotTrainedOnTheTopicIsNotQualifiedWithoutThePermission() {
        Map<String, Object> q = qualification(false);

        assertThat(q).containsEntry("qualified", false).containsEntry("qualifiedByPermission", false);
        assertThat((List<?>) q.get("reasons")).hasSize(1);
    }

    @Test
    void theQaGrantedPermissionQualifiesTheTrainerOnEveryTopic() {
        Map<String, Object> q = qualification(true);

        assertThat(q).containsEntry("qualified", true).containsEntry("qualifiedByPermission", true);
    }
}
