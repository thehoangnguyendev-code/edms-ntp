package com.eqms.service.training;

import com.eqms.entity.DocumentRecord;
import com.eqms.entity.UserAccount;
import com.eqms.repository.DocumentRecordRepository;
import com.eqms.repository.DocumentRevisionRepository;
import com.eqms.service.DocumentAuthorizationService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.JdbcTemplate;

import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class TrainingLinkServiceTest {
    @Mock JdbcTemplate jdbc;
    @Mock TrainingAccess access;
    @Mock DocumentRecordRepository documents;
    @Mock DocumentRevisionRepository revisions;
    @Mock DocumentAuthorizationService authorization;
    @Mock UserAccount actor;
    @Mock DocumentRecord document;
    private final UUID documentId = UUID.randomUUID();
    private TrainingLinkService service;

    @BeforeEach
    void setUp() {
        service = new TrainingLinkService(jdbc, access, documents, revisions, authorization);
        when(documents.findById(documentId)).thenReturn(Optional.of(document));
    }

    private Map<String, Object> readLink(Timestamp timestamp) {
        when(authorization.canViewDocument(actor, document)).thenReturn(true);
        Map<String, Object> activity = new HashMap<>();
        activity.put("id", UUID.randomUUID());
        activity.put("attendance_sent_at", timestamp);
        activity.put("completed_on", LocalDate.of(2026, 10, 23));
        when(jdbc.queryForList(contains("select * from training_activities"), eq(documentId))).thenReturn(List.of(activity));
        return service.forDocument(actor, documentId);
    }

    @Test
    void attendanceDayUsesSiteZoneAndRemainsATypedApiDate() {
        assertThat(readLink(Timestamp.from(Instant.parse("2026-10-23T17:01:00Z"))).get("attendanceSentOn"))
                .isEqualTo(LocalDate.of(2026, 10, 24));
    }

    @Test
    void attendanceDayBeforeSiteMidnightStaysOnThePreviousDay() {
        assertThat(readLink(Timestamp.from(Instant.parse("2026-10-23T16:59:00Z"))).get("attendanceSentOn"))
                .isEqualTo(LocalDate.of(2026, 10, 23));
    }

    @Test
    void theRevisionCanBeCompletedOnlyFromTheDayTheTrainerFinishedTheTraining() {
        // the attendance list is sent but the training is not finished: no finishing day, so the revision cannot be completed yet
        assertThat(readLink(Timestamp.from(Instant.parse("2026-10-23T10:00:00Z"))).get("finishedOn")).isNull();
    }

    @Test
    void unsentAttendanceHasNoDate() {
        assertThat(readLink(null).get("attendanceSentOn")).isNull();
    }

    @Test
    void cannotReadTrainingMetadataWithoutDocumentAccess() {
        assertThatThrownBy(() -> service.forDocument(actor, documentId)).isInstanceOf(SecurityException.class);
        verifyNoInteractions(jdbc);
    }
}
