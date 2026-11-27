package com.eqms.service;

import com.eqms.auth.AuthenticatedUser;
import com.eqms.auth.CurrentUserService;
import com.eqms.dto.document.DocumentListItemResponse;
import com.eqms.dto.navigation.NavigationItemResponse;
import com.eqms.dto.search.GlobalSearchResponse;
import com.eqms.dto.user.PageResponse;
import com.eqms.dto.user.PaginationResponse;
import com.eqms.entity.UserAccount;
import com.eqms.service.training.TrainingActivityService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.List;
import java.util.Set;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class GlobalSearchServiceTest {

    private NavigationService navigation;
    private DocumentService documents;
    private RevisionService revisions;
    private ControlledCopyService controlledCopies;
    private UncontrolledCopyService uncontrolledCopies;
    private UserManagementService users;
    private TrainingActivityService training;
    private NotificationService notifications;
    private DictionaryManagementService dictionaries;
    private GlobalSearchService service;
    private final UserAccount user = mock(UserAccount.class);

    @BeforeEach
    void setUp() {
        navigation = mock(NavigationService.class);
        documents = mock(DocumentService.class);
        revisions = mock(RevisionService.class);
        controlledCopies = mock(ControlledCopyService.class);
        uncontrolledCopies = mock(UncontrolledCopyService.class);
        users = mock(UserManagementService.class);
        training = mock(TrainingActivityService.class);
        notifications = mock(NotificationService.class);
        dictionaries = mock(DictionaryManagementService.class);
        CurrentUserService current = mock(CurrentUserService.class);
        PermissionEvaluationService evaluation = mock(PermissionEvaluationService.class);
        when(current.requireCurrentUser()).thenReturn(user);
        when(evaluation.getPermissionCodes(user)).thenReturn(Set.of("documents.module.view"));
        when(navigation.searchNavigation(anyString(), any(UserAccount.class), any())).thenReturn(List.of());
        service = new GlobalSearchService(navigation, current, evaluation, documents, revisions, controlledCopies, uncontrolledCopies, users, training,
                mock(com.eqms.service.training.TrainingRequirementService.class), mock(com.eqms.service.training.TrainingMatrixService.class),
                mock(com.eqms.service.training.TrainingAssessmentLibraryService.class), mock(com.eqms.service.training.TrainingJobAssignmentService.class),
                mock(ReportPlatformService.class), mock(com.eqms.service.report.ReportTemplateService.class), mock(PermissionSetService.class),
                mock(AccessProfileService.class), notifications, dictionaries, mock(EducationManagementService.class), mock(com.eqms.controller.BackupRestoreController.class));
    }

    @AfterEach
    void clear() {
        SecurityContextHolder.clearContext();
    }

    private void menuHas(String... ids) {
        List<NavigationItemResponse> items = java.util.Arrays.stream(ids)
                .map(id -> new NavigationItemResponse(id, id, null, "/" + id, false, null)).toList();
        when(navigation.getNavigation(any(UserAccount.class), any())).thenReturn(items);
    }

    private PageResponse<DocumentListItemResponse> oneDocument() {
        DocumentListItemResponse d = mock(DocumentListItemResponse.class);
        when(d.id()).thenReturn("d1");
        when(d.documentNumber()).thenReturn("SOP.QA.0127");
        when(d.documentName()).thenReturn("Management of deviations");
        when(d.status()).thenReturn("Effective");
        return new PageResponse<>(List.of(d), new PaginationResponse(1, 5, 1, 1));
    }

    private void documentsAnswer() {
        when(documents.listDocuments(any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(),
                any(), any(), anyInt(), anyInt())).thenAnswer(call -> oneDocument());
    }

    private GlobalSearchResponse.Group group(GlobalSearchResponse response, String key) {
        return response.groups().stream().filter(g -> g.key().equals(key)).findFirst().orElse(null);
    }

    @Test
    void aQueryThatIsTooShortAsksNobody() {
        assertTrue(service.search("a").groups().isEmpty());
        assertTrue(service.search("   ").groups().isEmpty());
        assertTrue(service.search(null).groups().isEmpty());
        verifyNoInteractions(documents, revisions, controlledCopies, uncontrolledCopies, users, training, navigation);
    }

    @Test
    void aKindIsAskedOnlyWhenThePageOfThatKindIsInTheMenuOfThePerson() {
        menuHas("doc-all");
        documentsAnswer();
        GlobalSearchResponse response = service.search("SOP");
        assertEquals("SOP.QA.0127", group(response, "documents").items().get(0).code());
        assertEquals("Management of deviations", group(response, "documents").items().get(0).title());
        assertNull(group(response, "users"));
        verifyNoInteractions(users, training, controlledCopies, uncontrolledCopies, revisions);
    }

    @Test
    void aPersonWithoutThePageOfUsersNeverReachesTheUserList() {
        menuHas("doc-all", "cc-all");
        documentsAnswer();
        service.search("Nguyen");
        verifyNoInteractions(users);
    }

    @Test
    void theTasksRunAsTheSignedInPerson() {
        Authentication authentication = new TestingAuthenticationToken("someone", "x");
        SecurityContextHolder.getContext().setAuthentication(authentication);
        AtomicReference<Authentication> seen = new AtomicReference<>();
        menuHas("doc-all");
        when(documents.listDocuments(any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(),
                any(), any(), anyInt(), anyInt())).thenAnswer(call -> {
            seen.set(SecurityContextHolder.getContext().getAuthentication());
            return oneDocument();
        });
        service.search("SOP");
        assertSame(authentication, seen.get());
    }

    @Test
    void aKindTheServiceRefusesIsLeftOutAndAKindThatFailsIsReportedAsUnavailable() {
        menuHas("doc-all", "rev-all");
        when(documents.listDocuments(any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(),
                any(), any(), anyInt(), anyInt())).thenThrow(new AccessDeniedException("no"));
        when(revisions.listRevisions(any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(),
                anyBoolean(), anyBoolean(), any(), any(), anyInt(), anyInt())).thenThrow(new IllegalStateException("boom"));
        GlobalSearchResponse response = service.search("SOP");
        assertNull(group(response, "documents"));
        assertTrue(group(response, "revisions").unavailable());
    }

    @Test
    void aKindThatIsTooSlowIsReportedAsUnavailableAndDoesNotHoldBackTheOthers() {
        menuHas("doc-all", "rev-all");
        documentsAnswer();
        when(revisions.listRevisions(any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(),
                anyBoolean(), anyBoolean(), any(), any(), anyInt(), anyInt())).thenAnswer(call -> {
            Thread.sleep(GlobalSearchService.GROUP_TIMEOUT_MS + 3000);
            return null;
        });
        long started = System.nanoTime();
        GlobalSearchResponse response = service.search("SOP");
        long millis = (System.nanoTime() - started) / 1_000_000;
        assertFalse(group(response, "documents").unavailable());
        assertTrue(group(response, "revisions").unavailable());
        assertTrue(millis < GlobalSearchService.GROUP_TIMEOUT_MS + 1500, "took " + millis + " ms");
    }

    @Test
    void theNotificationsOfThePersonAreAskedWithoutAPageOfTheMenuButEverythingElseStaysBehindIt() {
        menuHas("doc-all");
        documentsAnswer();
        com.eqms.dto.notification.NotificationResponse n = mock(com.eqms.dto.notification.NotificationResponse.class);
        when(n.id()).thenReturn(java.util.UUID.randomUUID());
        when(n.title()).thenReturn("Review requested");
        when(n.actionUrl()).thenReturn("/documents/revisions/review/r1");
        when(notifications.list(any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), anyInt(), anyInt()))
                .thenReturn(new PageResponse<>(List.of(n), new PaginationResponse(1, 5, 1, 1)));
        GlobalSearchResponse response = service.search("review");
        assertEquals("/documents/revisions/review/r1", group(response, "notifications").items().get(0).path());
        assertNull(group(response, "permission-sets"));
        assertNull(group(response, "access-profiles"));
        assertNull(group(response, "report-runs"));
    }

    @Test
    void theCodeComesFirst_equalThenStartsWithThenContainsThenTheRest() {
        List<com.eqms.dto.search.GlobalSearchResponse.Item> candidates = List.of(
                new com.eqms.dto.search.GlobalSearchResponse.Item("1", "X.SOP.0001", "contains", null, null, null),
                new com.eqms.dto.search.GlobalSearchResponse.Item("2", null, "name only", null, null, null),
                new com.eqms.dto.search.GlobalSearchResponse.Item("3", "SOP.0001.A", "starts with", null, null, null),
                new com.eqms.dto.search.GlobalSearchResponse.Item("4", "sop.0001", "equal, other case", null, null, null));
        List<String> order = GlobalSearchService.rank(candidates, " SOP.0001 ").stream().map(com.eqms.dto.search.GlobalSearchResponse.Item::id).toList();
        assertEquals(List.of("4", "3", "1", "2"), order);
    }

    @Test
    void theReportTemplatesAreAskedWithAPageSizeTheirListAccepts() {
        assertTrue(Set.of(10, 20, 50, 100).contains(GlobalSearchService.TEMPLATE_CANDIDATES));
    }

    @Test
    void aKindWithNoScreenPerRecordOpensTheListScreenOfItsMenuPage() {
        when(navigation.getNavigation(any(UserAccount.class), any())).thenReturn(List.of(
                new NavigationItemResponse("dict-departments", "Departments", null, "/settings/dictionaries/departments", false, null)));
        com.eqms.dto.dictionary.DepartmentDictionaryResponse d = mock(com.eqms.dto.dictionary.DepartmentDictionaryResponse.class);
        when(d.id()).thenReturn(java.util.UUID.randomUUID());
        when(d.name()).thenReturn("Quality Assurance");
        when(d.abbreviation()).thenReturn("QA");
        when(d.isActive()).thenReturn(true);
        when(dictionaries.listDepartmentsPage(any(), any(), any(), any(), any(), anyInt(), anyInt(), any(), any()))
                .thenReturn(new PageResponse<>(List.of(d), new PaginationResponse(1, 15, 1, 1)));
        GlobalSearchResponse response = service.search("QA");
        assertEquals("QA", group(response, "departments").items().get(0).code());
        assertEquals("/settings/dictionaries/departments", group(response, "departments").items().get(0).path());
    }
}
