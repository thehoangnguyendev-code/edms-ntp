package com.eqms;

import com.eqms.entity.Department;
import com.eqms.entity.DocumentRecord;
import com.eqms.entity.DocumentRevisionRecord;
import com.eqms.entity.UserAccount;
import com.eqms.repository.DocumentRelationRepository;
import com.eqms.repository.DocumentRevisionRepository;
import com.eqms.repository.DocumentStakeholderHistoryRepository;
import com.eqms.repository.DocumentWorkflowParticipantRepository;
import com.eqms.repository.RevisionWorkflowParticipantRepository;
import com.eqms.service.DocumentAuthorizationService;
import com.eqms.service.LifecycleStatePolicyEvaluator;
import com.eqms.service.PermissionEvaluationService;
import com.eqms.service.SystemConfigurationService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;

import java.util.List;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;

/**
 * The department level of Document Control visibility (VISIBILITY-TIERS-2026-11-20): a person holding
 * {@code documents.document.view_department} sees the Documents and Revisions whose Department is their own Department, with or without a name
 * in the flow. The cases are the ones that must never go wrong in a regulated system: another department, no department, a missing permission,
 * the base view permission, a Revision following its Document, and the fact that the level is an indirect grant (it never makes the person a
 * direct stakeholder, so the separate preview and Audit Trail permissions still apply).
 */
@ExtendWith(MockitoExtension.class)
class DocumentDepartmentVisibilityTest {

    @Mock private DocumentWorkflowParticipantRepository documentWorkflowParticipantRepository;
    @Mock private RevisionWorkflowParticipantRepository revisionWorkflowParticipantRepository;
    @Mock private DocumentRevisionRepository documentRevisionRepository;
    @Mock private PermissionEvaluationService permissionEvaluationService;
    @Mock private LifecycleStatePolicyEvaluator lifecycleStatePolicyEvaluator;
    @Mock private DocumentRelationRepository documentRelationRepository;
    @Mock private DocumentStakeholderHistoryRepository documentStakeholderHistoryRepository;
    @Mock private SystemConfigurationService systemConfigurationService;

    @InjectMocks
    private DocumentAuthorizationService service;

    private final UUID ownDepartmentId = UUID.randomUUID();
    private final UUID otherDepartmentId = UUID.randomUUID();
    private UserAccount viewer;
    private DocumentRecord document;
    private DocumentRevisionRecord revision;

    @BeforeEach
    void setUp() {
        viewer = new UserAccount();
        viewer.setId(UUID.randomUUID());
        viewer.setDepartmentId(ownDepartmentId);

        document = new DocumentRecord();
        document.setId(UUID.randomUUID());
        document.setDepartment(department(ownDepartmentId));

        revision = new DocumentRevisionRecord();
        revision.setId(UUID.randomUUID());
        revision.setDocument(document);

        lenient().when(documentWorkflowParticipantRepository.findAllByDocument_IdOrderBySequenceOrderAsc(any())).thenReturn(List.of());
        lenient().when(revisionWorkflowParticipantRepository.countByRevision_Document_IdAndUser_Id(any(), any())).thenReturn(0L);
        lenient().when(revisionWorkflowParticipantRepository.findAllByRevision_IdAndParticipantTypeOrderBySequenceOrderAsc(any(), any())).thenReturn(List.of());
        lenient().when(systemConfigurationService.getRetainVisibilityForRemovedParticipantTypes()).thenReturn(Set.of());
    }

    private static Department department(UUID id) {
        Department department = new Department();
        department.setId(id);
        return department;
    }

    private void grant(String... codes) {
        for (String code : codes) {
            lenient().when(permissionEvaluationService.hasPermission(viewer, code)).thenReturn(true);
        }
    }

    @Test
    void sameDepartment_withDepartmentLevel_seesDocumentAndRevision_withoutAnyNameInTheFlow() {
        grant("documents.document.view_department", "documents.document.view");
        assertThat(service.canViewDocument(viewer, document)).isTrue();
        assertThat(service.canViewRevision(viewer, revision)).isTrue();
        service.requireCanViewDocument(viewer, document);
        service.requireCanViewRevision(viewer, revision);
    }

    @Test
    void otherDepartment_isRefused_evenWithTheDepartmentLevel() {
        grant("documents.document.view_department", "documents.document.view");
        document.setDepartment(department(otherDepartmentId));
        assertThat(service.canViewDocument(viewer, document)).isFalse();
        assertThat(service.canViewRevision(viewer, revision)).isFalse();
        assertThatThrownBy(() -> service.requireCanViewDocument(viewer, document)).isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(() -> service.requireCanViewRevision(viewer, revision)).isInstanceOf(AccessDeniedException.class);
    }

    @Test
    void personWithoutDepartment_staysAtTheFlowLevel() {
        grant("documents.document.view_department", "documents.document.view");
        viewer.setDepartmentId(null);
        assertThat(service.canViewDepartmentRecords(viewer)).isFalse();
        assertThat(service.canViewDocument(viewer, document)).isFalse();
        assertThat(service.canViewRevision(viewer, revision)).isFalse();
    }

    @Test
    void withoutTheDepartmentPermission_sameDepartmentSeesNothing() {
        grant("documents.document.view");
        assertThat(service.canViewDocument(viewer, document)).isFalse();
        assertThat(service.canViewRevision(viewer, revision)).isFalse();
    }

    @Test
    void withoutTheBaseViewPermission_theDepartmentLevelAloneOpensNothing() {
        grant("documents.document.view_department");
        assertThat(service.canViewDepartmentRecords(viewer)).isFalse();
        assertThat(service.canViewDocument(viewer, document)).isFalse();
    }

    @Test
    void documentWithoutDepartment_isNotSeenThroughTheDepartmentLevel() {
        grant("documents.document.view_department", "documents.document.view");
        document.setDepartment(null);
        assertThat(service.isInViewerDepartment(viewer, document)).isFalse();
        assertThat(service.isInViewerDepartment(viewer, null)).isFalse();
    }

    @Test
    void nullUser_isRefused() {
        assertThat(service.canViewDepartmentRecords(null)).isFalse();
        assertThat(service.isInViewerDepartment(null, document)).isFalse();
    }

    @Test
    void personNamedInTheFlowOfAnotherDepartment_stillSeesTheirOwnRecord() {
        grant("documents.document.view");
        document.setDepartment(department(otherDepartmentId));
        document.setAuthor(viewer);
        assertThat(service.canViewDocument(viewer, document)).isTrue();
    }

    @Test
    void theDepartmentLevel_isIndirect_andNeverMakesAPersonADirectStakeholder() {
        grant("documents.document.view_department", "documents.document.view");
        // Preview and Audit Trail bypass (HDR-AUTH-001) is reserved for the people in the flow and the view-everything holders.
        assertThat(service.isDirectStakeholder(viewer, document)).isFalse();
        assertThat(service.isDirectStakeholder(viewer, revision)).isFalse();
    }

    @Test
    void viewEverything_includesTheDepartmentLevel_forEveryDepartment() {
        grant("documents.document.view_all");
        document.setDepartment(department(otherDepartmentId));
        assertThat(service.canViewAllDocuments(viewer)).isTrue();
        assertThat(service.canViewDocument(viewer, document)).isTrue();
        assertThat(service.canViewRevision(viewer, revision)).isTrue();
    }

    @Test
    void departmentLevel_isReadOnly_doesNotMakeThePersonAnActorForTheDocument() {
        grant("documents.document.view_department", "documents.document.view");
        // canViewDocument is the view rule; canViewDocumentAsActor decides who matches the "viewer" actor of a policy (request a copy for oneself)
        assertThat(service.canViewDocument(viewer, document)).isTrue();
        assertThat(service.canViewDocumentAsActor(viewer, document)).isFalse();
    }

    @Test
    void personNamedInTheFlow_isAnActor() {
        grant("documents.document.view");
        document.setAuthor(viewer);
        assertThat(service.canViewDocumentAsActor(viewer, document)).isTrue();
    }
}
