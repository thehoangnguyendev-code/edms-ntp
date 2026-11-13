package com.eqms.service;

import com.eqms.dto.navigation.NavigationItemResponse;
import com.eqms.entity.UserAccount;
import com.eqms.repository.ControlledCopyRepository;
import com.eqms.repository.DocumentRecordRepository;
import com.eqms.repository.DocumentRevisionRepository;
import com.eqms.repository.DocumentStakeholderHistoryRepository;
import com.eqms.repository.DocumentWorkflowParticipantRepository;
import com.eqms.repository.RevisionWorkflowParticipantRepository;
import com.eqms.repository.UncontrolledCopyRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/** The Document Control menu lists a group only where the person has something to do (DC-VISIBILITY-TIERS-2026-11-07). */
class DocumentControlMenuAccessTest {

    private final DocumentAuthorizationService documentAuthorization = mock(DocumentAuthorizationService.class);
    private final PermissionEvaluationService permissions = mock(PermissionEvaluationService.class);
    private final SystemConfigurationService configuration = mock(SystemConfigurationService.class);
    private final DocumentRecordRepository documents = mock(DocumentRecordRepository.class);
    private final DocumentRevisionRepository revisions = mock(DocumentRevisionRepository.class);
    private final DocumentWorkflowParticipantRepository documentParticipants = mock(DocumentWorkflowParticipantRepository.class);
    private final RevisionWorkflowParticipantRepository revisionParticipants = mock(RevisionWorkflowParticipantRepository.class);
    private final DocumentStakeholderHistoryRepository history = mock(DocumentStakeholderHistoryRepository.class);
    private final ControlledCopyRepository controlledCopies = mock(ControlledCopyRepository.class);
    private final UncontrolledCopyRepository uncontrolledCopies = mock(UncontrolledCopyRepository.class);
    private final UserAccount user = new UserAccount();
    private DocumentControlMenuAccess access;

    @BeforeEach
    void setUp() {
        user.setId(UUID.randomUUID());
        when(configuration.getRetainVisibilityForRemovedParticipantTypes()).thenReturn(Set.of());
        access = new DocumentControlMenuAccess(documentAuthorization, permissions, configuration, documents, revisions,
                documentParticipants, revisionParticipants, history, controlledCopies, uncontrolledCopies);
    }

    @Test
    void aNewUserWithNoNameAndNoViewEverythingSeesNoGroup() {
        when(permissions.hasPermission(any(), any())).thenReturn(true); // every single permission is granted: the permission alone is not enough
        when(permissions.hasAnyPermission(user, DocumentControlMenuAccess.P_UNCONTROLLED_COPY_VIEW, DocumentControlMenuAccess.P_UNCONTROLLED_COPY_REQUEST)).thenReturn(true);

        assertThat(access.sectionsFor(user)).isEqualTo(new DocumentControlMenuAccess.Sections(false, false, false));
    }

    @Test
    void aNamedAuthorSeesDocumentsAndRevisionsOnly() {
        when(documents.existsByAuthor_Id(user.getId())).thenReturn(true);

        assertThat(access.sectionsFor(user).documents()).isTrue();
        assertThat(access.sectionsFor(user).controlledCopies()).isFalse();
    }

    @Test
    void aReviewerOrApproverOfARevisionSeesTheDocumentGroups() {
        when(revisionParticipants.existsByUser_Id(user.getId())).thenReturn(true);

        assertThat(access.sectionsFor(user).documents()).isTrue();
    }

    @Test
    void aRemovedParticipantKeepsTheGroupsOnlyWhenTheRetainToggleIsOn() {
        when(history.existsByUser_IdAndParticipantTypeIn(any(), any())).thenReturn(true);
        assertThat(access.sectionsFor(user).documents()).isFalse();

        when(configuration.getRetainVisibilityForRemovedParticipantTypes()).thenReturn(Set.of("REVIEWER"));
        assertThat(access.sectionsFor(user).documents()).isTrue();
    }

    @Test
    void theViewEverythingPermissionShowsTheGroupsWithoutAnyName() {
        when(documentAuthorization.canListAllDocuments(user)).thenReturn(true);
        when(documentAuthorization.canViewAllControlledCopies(user)).thenReturn(true);
        when(permissions.hasPermission(user, DocumentControlMenuAccess.P_CONTROLLED_COPY_VIEW)).thenReturn(true);

        DocumentControlMenuAccess.Sections sections = access.sectionsFor(user);

        assertThat(sections.documents()).isTrue();
        assertThat(sections.controlledCopies()).isTrue();
        assertThat(sections.uncontrolledCopies()).isFalse();
    }

    @Test
    void theRecipientOfAControlledCopySeesThatGroupOnlyWithItsViewPermission() {
        when(controlledCopies.existsByRecipientUser_Id(user.getId())).thenReturn(true);
        assertThat(access.sectionsFor(user).controlledCopies()).isFalse();

        when(permissions.hasPermission(user, DocumentControlMenuAccess.P_CONTROLLED_COPY_VIEW)).thenReturn(true);
        assertThat(access.sectionsFor(user).controlledCopies()).isTrue();
    }

    @Test
    void anApproverOfUncontrolledCopiesSeesThatGroupForTheRequestsThatWaitForHim() {
        when(permissions.hasAnyPermission(user, DocumentControlMenuAccess.P_UNCONTROLLED_COPY_VIEW, DocumentControlMenuAccess.P_UNCONTROLLED_COPY_REQUEST)).thenReturn(true);
        when(permissions.hasAnyPermission(user, DocumentControlMenuAccess.P_UNCONTROLLED_COPY_APPROVE, DocumentControlMenuAccess.P_UNCONTROLLED_COPY_REJECT)).thenReturn(true);

        assertThat(access.sectionsFor(user).uncontrolledCopies()).isTrue();
    }

    @Test
    void theUncontrolledCopyGroupNeedsItsPermissionBeforeAnyNameCounts() {
        when(uncontrolledCopies.existsByRecipientUserId(user.getId())).thenReturn(true);

        assertThat(access.sectionsFor(user).uncontrolledCopies()).isFalse();
    }

    @Test
    void noSignedInAccountMeansNoGroup() {
        assertThat(access.sectionsFor(null)).isEqualTo(new DocumentControlMenuAccess.Sections(false, false, false));
    }

    // ---- the menu itself ---------------------------------------------------------------------

    private static List<String> documentControlLeaves(List<NavigationItemResponse> menu) {
        return menu.stream().filter(item -> "doc-control".equals(item.id())).findFirst()
                .map(item -> item.children() == null ? List.<String>of() : item.children().stream().map(NavigationItemResponse::id).toList())
                .orElse(List.of());
    }

    private NavigationService navigation() {
        SystemConfigurationService features = mock(SystemConfigurationService.class);
        when(features.isFeatureEnabled(any())).thenReturn(true);
        NavigationService navigation = new NavigationService(features);
        navigation.setDocumentControlMenuAccess(access);
        return navigation;
    }

    @Test
    void theDocumentControlMenuDisappearsForAUserWithTheModulePermissionButNoNameAndNoViewEverything() {
        Set<String> granted = Set.of("documents.module.view", "documents.document.view", "documents.controlled_copy.view");

        assertThat(documentControlLeaves(navigation().getNavigation(user, granted))).isEmpty();
    }

    @Test
    void theDocumentControlMenuListsTheDocumentGroupsOnceTheUserIsNamedInAFlow() {
        when(documents.existsByAuthor_Id(user.getId())).thenReturn(true);
        Set<String> granted = Set.of("documents.module.view");

        assertThat(documentControlLeaves(navigation().getNavigation(user, granted)))
                .contains("doc-owned-me", "doc-all", "doc-revisions")
                .doesNotContain("controlled-copies", "uncontrolled-copies");
    }

    @Test
    void withoutAUserTheMenuFollowsPermissionsAlone() {
        Set<String> granted = Set.of("documents.module.view");

        assertThat(documentControlLeaves(navigation().getNavigation(null, granted))).contains("doc-owned-me", "doc-revisions", "controlled-copies");
    }
}
