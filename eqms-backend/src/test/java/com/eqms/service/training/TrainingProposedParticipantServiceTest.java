package com.eqms.service.training;

import com.eqms.entity.DocumentRecord;
import com.eqms.entity.UserAccount;
import com.eqms.dto.audittrail.AuditTrailChangeResponse;
import com.eqms.service.AuditTrailService;
import com.eqms.service.DocumentAuthorizationService;
import org.mockito.ArgumentCaptor;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** The people proposed for a document's training: who may edit them is decided by Document Control or by Training, and every change is audited on the activity. */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class TrainingProposedParticipantServiceTest {

    @Mock JdbcTemplate jdbc;
    @Mock TrainingAccess access;
    @Mock TrainingStore store;
    @Mock DocumentAuthorizationService documents;
    @Mock EntityManager entityManager;
    @Mock AuditTrailService audit;

    private final UUID documentId = UUID.randomUUID();
    private final UUID activityId = UUID.randomUUID();
    private final UUID departmentId = UUID.randomUUID();
    private final UUID anne = UUID.randomUUID();
    private final UserAccount actor = mock(UserAccount.class);
    private final DocumentRecord document = mock(DocumentRecord.class);
    private TrainingProposedParticipantService service;

    @BeforeEach
    void setUp() {
        when(actor.getId()).thenReturn(UUID.randomUUID());
        service = new TrainingProposedParticipantService(jdbc, access, store, documents, audit);
        ReflectionTestUtils.setField(service, "entityManager", entityManager);
        when(entityManager.find(DocumentRecord.class, documentId)).thenReturn(document);
        Map<String, Object> activity = new java.util.HashMap<>();
        activity.put("id", activityId);
        activity.put("document_id", documentId);
        activity.put("revision_id", null);
        activity.put("status", "RESERVED");
        activity.put("training_number", "TR-001");
        activity.put("organizer_department_id", departmentId);
        when(jdbc.queryForList(contains("from training_activities where document_id=?"), eq(documentId))).thenReturn(List.of(activity));
        when(jdbc.queryForList(contains("select full_name from app_users where id=? and status='Active'"), eq(String.class), eq(anne))).thenReturn(List.of("Anne"));
        when(jdbc.queryForList(contains("select person_user_id from training_proposed_participants"), eq(UUID.class), eq(activityId))).thenReturn(List.of());
    }

    @Test
    void aPersonWhoMayEditTheDraftDocumentCanProposePeopleAndTheChangeIsAuditedOnTheActivity() {
        when(documents.canEditInitialDocumentDraft(actor, document)).thenReturn(true);
        when(documents.canViewDocument(actor, document)).thenReturn(true);

        service.replace(actor, documentId, new TrainingProposedParticipantService.ReplaceRequest(List.of(anne)));

        verify(jdbc).update(contains("insert into training_proposed_participants"), any(), eq(activityId), eq(anne), any());
        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<AuditTrailChangeResponse>> changes = ArgumentCaptor.forClass(List.class);
        verify(audit).logAs(eq(actor), eq("TRAINING_ACTIVITY"), any(), eq(activityId), eq("TRAINING_PARTICIPANTS_PROPOSED"), any(), any(), contains("1 added, 0 removed, 1 in total"), changes.capture());
        assertThat(changes.getValue()).extracting(AuditTrailChangeResponse::field).containsExactly("List of participants in the Training", "Participant added");
        assertThat(changes.getValue().get(0).oldValue()).isEqualTo("0 people");
        assertThat(changes.getValue().get(0).newValue()).isEqualTo("1 people");
        verify(audit).logAs(eq(actor), eq("DOCUMENT"), any(), eq(documentId), eq("TRAINING_PARTICIPANTS_PROPOSED"), any(), any(), any(), any(List.class));
    }

    @Test
    void aPersonWhoCannotEditTheDocumentNorOrganizeTheTrainingIsRefusedAndNothingIsWritten() {
        when(documents.canEditInitialDocumentDraft(actor, document)).thenReturn(false);
        when(access.has(actor, "training.activity.organize")).thenReturn(false);

        assertThatThrownBy(() -> service.replace(actor, documentId, new TrainingProposedParticipantService.ReplaceRequest(List.of(anne))))
                .isInstanceOf(SecurityException.class);
        verify(jdbc, never()).update(contains("insert into training_proposed_participants"), any(), any(), any(), any());
    }

    @Test
    void anOrganizerOfTheDepartmentMayProposeEvenWithoutEditingTheDocument() {
        when(documents.canEditInitialDocumentDraft(actor, document)).thenReturn(false);
        when(access.has(actor, "training.activity.organize")).thenReturn(true);
        when(access.inScope(actor, departmentId)).thenReturn(true);
        when(documents.canViewDocument(actor, document)).thenReturn(true);

        assertThat(service.replace(actor, documentId, new TrainingProposedParticipantService.ReplaceRequest(List.of(anne)))).containsKey("people");
    }

    @Test
    void aPersonWhoIsNotActiveCannotBeProposed() {
        when(documents.canEditInitialDocumentDraft(actor, document)).thenReturn(true);
        UUID gone = UUID.randomUUID();
        when(jdbc.queryForList(contains("select full_name from app_users where id=? and status='Active'"), eq(String.class), eq(gone))).thenReturn(List.of());

        assertThatThrownBy(() -> service.replace(actor, documentId, new TrainingProposedParticipantService.ReplaceRequest(List.of(gone))))
                .isInstanceOf(IllegalArgumentException.class).hasMessage("TRAINING_PARTICIPANT_NOT_ELIGIBLE");
    }

    @Test
    void thePeopleSearchIsRefusedToSomeoneWhoCannotEditDocumentsNorOrganizeTraining() {
        when(documents.canManageDocumentWorkspace(actor)).thenReturn(false);
        when(documents.canCreateDocument(actor)).thenReturn(false);
        when(access.has(actor, "training.activity.organize")).thenReturn(false);

        assertThatThrownBy(() -> service.people(actor, "an", 20)).isInstanceOf(SecurityException.class);
    }
}
