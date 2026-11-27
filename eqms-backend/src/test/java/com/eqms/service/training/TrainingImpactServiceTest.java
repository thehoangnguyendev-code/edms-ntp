package com.eqms.service.training;

import com.eqms.dto.audittrail.AuditTrailChangeResponse;
import com.eqms.entity.ElectronicSignature;
import com.eqms.entity.UserAccount;
import com.eqms.service.ElectronicSignatureService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.server.ResponseStatusException;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.spy;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** SOP.0003 5.3.1: the department assesses the effect of a new document on the matrix; the assessment is signed, has a reason, and is checked against the matrix by the server. */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class TrainingImpactServiceTest {

    @Mock JdbcTemplate jdbc;
    @Mock TrainingAccess access;
    @Mock TrainingStore store;
    @Mock ElectronicSignatureService signatures;

    private final UUID activityId = UUID.randomUUID();
    private final UUID departmentId = UUID.randomUUID();
    private final UUID positionId = UUID.randomUUID();
    private final UserAccount actor = mock(UserAccount.class);
    private TrainingImpactService service;

    @BeforeEach
    void setUp() {
        when(actor.getId()).thenReturn(UUID.randomUUID());
        when(actor.getFullName()).thenReturn("Matrix Manager");
        Map<String, Object> activity = new HashMap<>();
        activity.put("id", activityId);
        activity.put("document_id", UUID.randomUUID());
        activity.put("document_number", "SOP.10292");
        activity.put("training_number", "TRN/QA/26-002");
        activity.put("status", "PLANNED");
        activity.put("organizer_department_id", departmentId);
        when(store.activityForUpdate(activityId)).thenReturn(Optional.of(activity));
        ElectronicSignature signature = mock(ElectronicSignature.class);
        when(signature.getId()).thenReturn(UUID.randomUUID());
        when(signatures.createEntitySignature(any(), any(), any(), any(), any(), any(), any(), any(), any(), any())).thenReturn(signature);
        when(jdbc.queryForList(contains("from training_job_roles where id = ? and is_active and department_id = ?"), any(Object[].class))).thenReturn(List.of(Map.of("id", positionId, "name", "QA Specialist")));
        // the person belongs to the department of the activity (SOP.0003 5.3.1: the department assesses)
        when(access.inOwnDepartment(actor, departmentId)).thenReturn(true);
        service = spy(new TrainingImpactService(jdbc, access, store, signatures));
        doReturn(Map.of()).when(service).context(any(), any());
    }

    @Test
    void aPersonOfAnotherDepartmentCanLookButCannotAssess() {
        // the permission to see every department puts the activity in the scope of the person, but the person is not of the department
        when(access.inOwnDepartment(actor, departmentId)).thenReturn(false);
        when(access.inScope(actor, departmentId)).thenReturn(true);

        assertThatThrownBy(() -> service.assess(actor, activityId, request("NO_TRAINING_IMPACT", "Editorial change only", List.of(), "token")))
                .isInstanceOf(SecurityException.class);
        verify(signatures, never()).createEntitySignature(any(), any(), any(), any(), any(), any(), any(), any(), any(), any());
        verify(jdbc, never()).update(contains("insert into training_impact_assessments"), any(Object[].class));
    }

    @Test
    void theListOffersTheAssessmentOnlyForTheLinesOfTheDepartmentOfThePerson() {
        UUID other = UUID.randomUUID();
        Map<String, Object> mine = new HashMap<>(Map.of("id", UUID.randomUUID(), "assessing_department_id", departmentId, "activity_status", "PLANNED"));
        Map<String, Object> theirs = new HashMap<>(Map.of("id", UUID.randomUUID(), "assessing_department_id", other, "activity_status", "PLANNED"));
        when(access.has(actor, "training.matrix.manage")).thenReturn(true);
        when(access.departmentOf(actor)).thenReturn(departmentId);
        when(jdbc.queryForObject(contains("select count(*)"), eq(Long.class), any(Object[].class))).thenReturn(2L);
        when(jdbc.queryForList(contains("select x.*"), any(Object[].class))).thenReturn(List.of(mine, theirs));

        Map<String, Object> page = service.list(actor, other, null, null, null, null, 1, 10);

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> data = (List<Map<String, Object>>) page.get("data");
        assertThat(data).extracting(r -> r.get("canAssess")).containsExactly(true, false);
    }

    @Test
    void theAssessmentIsOfferedOnlyUntilTheParticipantsAreNotified() {
        Map<String, Object> planned = new HashMap<>(Map.of("id", UUID.randomUUID(), "assessing_department_id", departmentId, "activity_status", "PENDING_APPROVAL"));
        Map<String, Object> notified = new HashMap<>(Map.of("id", UUID.randomUUID(), "assessing_department_id", departmentId, "activity_status", "NOTIFIED"));
        Map<String, Object> completed = new HashMap<>(Map.of("id", UUID.randomUUID(), "assessing_department_id", departmentId, "activity_status", "COMPLETED"));
        when(access.has(actor, "training.matrix.manage")).thenReturn(true);
        when(access.departmentOf(actor)).thenReturn(departmentId);
        when(jdbc.queryForObject(contains("select count(*)"), eq(Long.class), any(Object[].class))).thenReturn(3L);
        when(jdbc.queryForList(contains("select x.*"), any(Object[].class))).thenReturn(List.of(planned, notified, completed));

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> data = (List<Map<String, Object>>) service.list(actor, departmentId, null, null, null, null, 1, 10).get("data");

        assertThat(data).extracting(r -> r.get("canAssess")).containsExactly(true, false, false);
    }

    @Test
    void aTrainingImplementedBeforeItsImpactWasAssessedIsADeviationNotSomethingToAssess() {
        UUID id = UUID.randomUUID();
        Map<String, Object> late = new HashMap<>(Map.of("id", id, "assessing_department_id", departmentId, "activity_status", "COMPLETED", "impact_status", "PENDING"));
        Map<String, Object> lateMatrix = new HashMap<>(Map.of("id", UUID.randomUUID(), "assessing_department_id", departmentId, "activity_status", "IN_PROGRESS", "impact_status", "MATRIX_UPDATE_PENDING"));
        Map<String, Object> done = new HashMap<>(Map.of("id", UUID.randomUUID(), "assessing_department_id", departmentId, "activity_status", "COMPLETED", "impact_status", "DONE"));
        Map<String, Object> onTime = new HashMap<>(Map.of("id", UUID.randomUUID(), "assessing_department_id", departmentId, "activity_status", "PLANNED", "impact_status", "PENDING"));
        when(access.has(actor, "training.matrix.manage")).thenReturn(true);
        when(access.departmentOf(actor)).thenReturn(departmentId);
        when(jdbc.queryForObject(contains("select count(*)"), eq(Long.class), any(Object[].class))).thenReturn(4L);
        when(jdbc.queryForList(contains("select x.*"), any(Object[].class))).thenReturn(List.of(late, lateMatrix, done, onTime));

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> data = (List<Map<String, Object>>) service.list(actor, departmentId, null, null, null, null, 1, 10).get("data");

        assertThat(data).extracting(r -> r.get("deviation")).containsExactly(true, true, false, false);
        assertThat(data).extracting(r -> r.get("canAssess")).containsExactly(false, false, false, true);
    }

    @Test
    void anActivityWhoseParticipantsWereNotifiedCannotBeAssessedAnyMore() {
        Map<String, Object> notified = new HashMap<>(store.activityForUpdate(activityId).orElseThrow());
        notified.put("status", "NOTIFIED");
        when(store.activityForUpdate(activityId)).thenReturn(Optional.of(notified));

        assertThatThrownBy(() -> service.assess(actor, activityId, request("NO_TRAINING_IMPACT", "Editorial change only", List.of(), "token")))
                .isInstanceOf(ResponseStatusException.class).hasMessageContaining("TRAINING_IMPACT_AFTER_NOTICE");
    }

    @Test
    void theParticipantsCannotBeNotifiedUntilTheImpactIsAssessedAndTheMatrixUpdated() {
        when(jdbc.queryForList(contains("select organizer_department_id from training_activities where id = ?"), eq(UUID.class), eq(activityId))).thenReturn(List.of(departmentId));
        when(jdbc.queryForList(contains("select x.impact_status from"), eq(String.class), any(Object[].class))).thenReturn(List.of("PENDING"));
        assertThat(service.notifyBlocker(activityId)).isEqualTo("TRAINING_IMPACT_NOT_ASSESSED");

        when(jdbc.queryForList(contains("select x.impact_status from"), eq(String.class), any(Object[].class))).thenReturn(List.of("MATRIX_UPDATE_PENDING"));
        assertThat(service.notifyBlocker(activityId)).isEqualTo("TRAINING_MATRIX_NOT_UPDATED");

        when(jdbc.queryForList(contains("select x.impact_status from"), eq(String.class), any(Object[].class))).thenReturn(List.of("DONE"));
        assertThat(service.notifyBlocker(activityId)).isNull();

        // a training that is not subject to the assessment (a periodic or unplanned one) has no line in the queue: nothing stops it
        when(jdbc.queryForList(contains("select x.impact_status from"), eq(String.class), any(Object[].class))).thenReturn(List.of());
        assertThat(service.notifyBlocker(activityId)).isNull();
    }

    private TrainingImpactService.AssessRequest request(String outcome, String reason, List<UUID> positions, String token) {
        return new TrainingImpactService.AssessRequest(outcome, reason, positions, token);
    }

    @Test
    void anAssessmentNeedsAKnownOutcomeAReasonAndASignature() {
        assertThatThrownBy(() -> service.assess(actor, activityId, request("SOMETHING", "r", List.of(), "t"))).hasMessage("TRAINING_IMPACT_OUTCOME_INVALID");
        assertThatThrownBy(() -> service.assess(actor, activityId, request("NO_TRAINING_IMPACT", " ", List.of(), "t"))).hasMessage("TRAINING_REASON_REQUIRED");
        assertThatThrownBy(() -> service.assess(actor, activityId, request("NO_TRAINING_IMPACT", "Editorial change only", List.of(), null))).hasMessage("TRAINING_SIGNATURE_REQUIRED");
        verify(jdbc, never()).update(contains("insert into training_impact_assessments"), any(Object[].class));
    }

    @Test
    void whenTheMatrixMustBeUpdatedThePositionsToTrainMustBeNamed() {
        assertThatThrownBy(() -> service.assess(actor, activityId, request("MATRIX_UPDATE_NEEDED", "New SOP", List.of(), "t"))).hasMessage("TRAINING_IMPACT_POSITION_REQUIRED");
    }

    @Test
    void aPositionOfAnotherDepartmentIsRefused() {
        when(jdbc.queryForList(contains("from training_job_roles where id = ? and is_active and department_id = ?"), any(Object[].class))).thenReturn(List.of());

        assertThatThrownBy(() -> service.assess(actor, activityId, request("MATRIX_UPDATE_NEEDED", "New SOP", List.of(positionId), "t"))).hasMessage("TRAINING_IMPACT_POSITION_INVALID");
    }

    @Test
    void sayingThatTheMatrixAlreadyCoversTheDocumentIsRefusedWhenNoEffectiveMatrixHasIt() {
        when(jdbc.queryForObject(contains("from training_activities x where x.id = ?"), eq(Boolean.class), eq(departmentId), eq(activityId))).thenReturn(false);

        assertThatThrownBy(() -> service.assess(actor, activityId, request("MATRIX_ALREADY_COVERS", "Already in", List.of(), "t")))
                .isInstanceOf(ResponseStatusException.class).hasMessageContaining("TRAINING_IMPACT_NOT_IN_MATRIX");
    }

    @Test
    void aSignedAssessmentIsWrittenAndAuditedWithTheOutcomeThePositionsAndTheReason() {
        service.assess(actor, activityId, request("MATRIX_UPDATE_NEEDED", "New SOP for the QA team", List.of(positionId), "token"));

        verify(signatures).createEntitySignature(any(), any(), any(), any(), eq("token"), eq("TRAINING_IMPACT_ASSESSED"), any(), any(), any(), any());
        verify(jdbc).update(contains("insert into training_impact_assessments"), any(), eq(activityId), eq("MATRIX_UPDATE_NEEDED"), eq("New SOP for the QA team"), any(), any(), any(), eq(departmentId));
        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<AuditTrailChangeResponse>> changes = ArgumentCaptor.forClass(List.class);
        verify(store).auditActivity(eq(actor), any(), eq("TRAINING_IMPACT_ASSESSED"), any(), any(), contains("SOP.10292"), changes.capture());
        assertThat(changes.getValue()).extracting(AuditTrailChangeResponse::field).containsExactly("Impact on the training matrix", "Positions to be trained", "Reason");
        assertThat(changes.getValue().get(1).newValue()).isEqualTo("QA Specialist");
    }

    @Test
    void aCancelledActivityHasNothingToAssess() {
        Map<String, Object> cancelled = new HashMap<>(store.activityForUpdate(activityId).orElseThrow());
        cancelled.put("status", "CANCELLED");
        when(store.activityForUpdate(activityId)).thenReturn(Optional.of(cancelled));

        assertThatThrownBy(() -> service.assess(actor, activityId, request("NO_TRAINING_IMPACT", "r", List.of(), "t")))
                .isInstanceOf(ResponseStatusException.class).hasMessageContaining("TRAINING_IMPACT_NOT_APPLICABLE");
    }

    private void positionsFixtures(long total) {
        Map<String, Object> activity = new HashMap<>(store.activityForUpdate(activityId).orElseThrow());
        when(jdbc.queryForList(contains("from training_activities a where id = ?"), eq(activityId))).thenReturn(List.of(activity));
        when(jdbc.queryForObject(contains("select count(*) from training_job_roles p"), eq(Long.class), any(Object[].class))).thenReturn(total);
        when(jdbc.queryForList(contains("from training_job_roles p"), any(Object[].class))).thenReturn(List.of(Map.of("id", positionId, "code", "QAS", "name", "QA Specialist", "in_matrix", true)));
    }

    @Test
    void theWorkPositionsAreSearchedSortedAndPagedByTheServer() {
        positionsFixtures(25L);

        Map<String, Object> page = service.positions(actor, activityId, "qa_%", "inMatrix", "desc", 2, 10);

        ArgumentCaptor<String> sql = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<Object[]> args = ArgumentCaptor.forClass(Object[].class);
        verify(jdbc, org.mockito.Mockito.atLeastOnce()).queryForList(sql.capture(), args.capture());
        assertThat(sql.getValue()).contains("p.is_active and p.department_id = ?").contains("eqms_fold(p.name) like eqms_fold(?)").contains("eqms_fold(coalesce(p.code,'')) like eqms_fold(?)").contains("order by in_matrix desc").endsWith("limit ? offset ?");
        // the document of the activity, the department, the escaped search twice, the page size and the offset
        assertThat(args.getValue()).hasSize(6);
        assertThat(args.getValue()[1]).isEqualTo(departmentId);
        assertThat(args.getValue()[2]).isEqualTo("%qa" + "\\" + "_" + "\\" + "%%");
        assertThat(args.getValue()[4]).isEqualTo(10);
        assertThat(args.getValue()[5]).isEqualTo(10);
        assertThat(page.get("pagination")).isEqualTo(Map.of("page", 2, "limit", 10, "total", 25L, "totalPages", 3L));
    }

    @Test
    void aSortKeyThatIsNotOnTheListFallsBackToTheNameAndNeverReachesTheSql() {
        positionsFixtures(1L);

        service.positions(actor, activityId, null, "p.name; drop table x", "asc", 1, 10);

        ArgumentCaptor<String> sql = ArgumentCaptor.forClass(String.class);
        verify(jdbc, org.mockito.Mockito.atLeastOnce()).queryForList(sql.capture(), any(Object[].class));
        assertThat(sql.getValue()).contains("order by p.name limit ? offset ?").doesNotContain("drop table");
    }

    @Test
    void thePageSizeIsLimitedAndThePageStartsAtOne() {
        positionsFixtures(500L);

        Map<String, Object> page = service.positions(actor, activityId, "", null, null, -3, 5000);

        assertThat(page.get("pagination")).isEqualTo(Map.of("page", 1, "limit", 100, "total", 500L, "totalPages", 5L));
    }

    @Test
    void thePositionsOfADepartmentAreOnlyForAPersonWhoMayActInIt() {
        positionsFixtures(1L);
        org.mockito.Mockito.doThrow(new SecurityException("TRAINING_SCOPE_DENIED")).when(access).requireScope(actor, departmentId);

        assertThatThrownBy(() -> service.positions(actor, activityId, null, null, null, 1, 10)).isInstanceOf(SecurityException.class);
        verify(jdbc, never()).queryForList(contains("from training_job_roles p"), any(Object[].class));
    }

    /** SOP.0003 5.3.1: the related departments assess too; the participants are not notified until all of them are done. */
    @Test
    void theNoticeWaitsForEveryRelatedDepartment() {
        UUID related = UUID.randomUUID();
        when(jdbc.queryForList(contains("select organizer_department_id from training_activities where id = ?"), eq(UUID.class), eq(activityId))).thenReturn(List.of(departmentId));
        when(jdbc.queryForList(contains("from training_impact_departments where activity_id = ?"), eq(UUID.class), eq(activityId))).thenReturn(List.of(related));
        when(jdbc.queryForList(contains("select x.impact_status from"), eq(String.class), eq(departmentId), eq(activityId))).thenReturn(List.of("DONE"));
        when(jdbc.queryForList(contains("select x.impact_status from"), eq(String.class), eq(related), eq(activityId))).thenReturn(List.of("PENDING"));

        assertThat(service.notifyBlocker(activityId)).isEqualTo("TRAINING_IMPACT_NOT_ASSESSED");
    }
}
