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
        when(jdbc.queryForObject(contains("r.is_gmp"), eq(Boolean.class))).thenReturn(false);
        when(jdbc.queryForObject(contains("lower(rec.topic_text) like '%gmp%'"), eq(Boolean.class), eq(trainerId))).thenReturn(true);
        when(jdbc.queryForList(contains("from training_session_topics"), eq(sessionId))).thenReturn(List.of(Map.of("topic_text", "Gowning")));
        when(jdbc.queryForObject(contains("training_topic_key(r.topic_text) = training_topic_key(?)"), eq(Integer.class), any(), any(), any(), any())).thenReturn(0);
        when(jdbc.queryForList(contains("training_trainer_exceptions"), eq(sessionId))).thenReturn(List.of());
        when(users.findById(trainerId)).thenReturn(Optional.of(trainer));
        when(access.has(trainer, "training.trainer.qualified")).thenReturn(holdsPermission);
        return new TrainingTrainerService(jdbc, access, null, null, null, null, users, com.eqms.service.authorization.TestGuards.allowingTraining()).qualification(sessionId);
    }

    /** Owner decision 2026-10-28: the record "Trainer" (written when the person gave a training) counts for the matrix, not as proof that the trainer was trained on the topic (SOP.0003 5.1). */
    @Test
    void theRecordWrittenForATrainerIsNotCountedAsTrainingOfTheTrainer() {
        when(jdbc.queryForList(contains("from training_sessions s join"), eq(sessionId))).thenReturn(List.of(Map.of("trainer_user_id", trainerId, "organizer_department_id", UUID.randomUUID())));
        // both queries only answer when they leave the Trainer records out; a query that does not would get the default (null) and fail
        when(jdbc.queryForObject(contains("r.is_gmp"), eq(Boolean.class))).thenReturn(false);
        when(jdbc.queryForObject(contains("rec.result <> 'TRAINER' and lower(rec.topic_text) like '%gmp%'"), eq(Boolean.class), eq(trainerId))).thenReturn(true);
        when(jdbc.queryForList(contains("from training_session_topics"), eq(sessionId))).thenReturn(List.of(Map.of("topic_text", "Gowning")));
        when(jdbc.queryForObject(contains("r.result <> 'TRAINER' and ((cast(? as varchar)"), eq(Integer.class), any(), any(), any(), any())).thenReturn(0);
        when(jdbc.queryForList(contains("training_trainer_exceptions"), eq(sessionId))).thenReturn(List.of());
        when(users.findById(trainerId)).thenReturn(Optional.of(trainer));
        when(access.has(trainer, "training.trainer.qualified")).thenReturn(false);

        Map<String, Object> q = new TrainingTrainerService(jdbc, access, null, null, null, null, users, com.eqms.service.authorization.TestGuards.allowingTraining()).qualification(sessionId);

        assertThat(q).containsEntry("gmpTrained", true).containsEntry("qualified", false);
    }

    /** DEC-TRAINING-2026-11-27-01 A2: once QA marks a row, only a record of a marked row counts; a topic that merely names GMP does not. */
    @Test
    void onceAGmpRowIsMarkedTheNameOfTheTopicNoLongerCounts() {
        when(jdbc.queryForList(contains("from training_sessions s join"), eq(sessionId))).thenReturn(List.of(Map.of("trainer_user_id", trainerId, "organizer_department_id", UUID.randomUUID())));
        when(jdbc.queryForObject(contains("from training_matrix_rows r join training_matrix_versions v on v.id = r.version_id where"), eq(Boolean.class))).thenReturn(true);
        when(jdbc.queryForObject(contains("where r.is_gmp and"), eq(Boolean.class), eq(trainerId))).thenReturn(false);
        when(jdbc.queryForList(contains("from training_session_topics"), eq(sessionId))).thenReturn(List.of());
        when(jdbc.queryForList(contains("training_trainer_exceptions"), eq(sessionId))).thenReturn(List.of());
        when(users.findById(trainerId)).thenReturn(Optional.of(trainer));
        when(access.has(trainer, "training.trainer.qualified")).thenReturn(false);

        Map<String, Object> q = new TrainingTrainerService(jdbc, access, null, null, null, null, users, com.eqms.service.authorization.TestGuards.allowingTraining()).qualification(sessionId);

        assertThat(q).containsEntry("gmpTrained", false).containsEntry("qualified", false);
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
