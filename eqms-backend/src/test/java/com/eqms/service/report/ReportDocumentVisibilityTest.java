package com.eqms.service.report;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.eqms.entity.UserAccount;
import com.eqms.entity.UserStatus;
import com.eqms.service.DocumentAuthorizationService;
import com.eqms.service.PermissionEvaluationService;
import com.eqms.service.SystemConfigurationService;
import com.eqms.service.UncontrolledCopyService;
import java.util.*;
import org.junit.jupiter.api.Test;

/**
 * REPORT-DC-VISIBILITY-2026-11-12: a report on Document Control records shows a person only what the Document Control list shows the same person.
 * The template scope can narrow the rows, never widen them.
 */
class ReportDocumentVisibilityTest {
    private final DocumentAuthorizationService authorization = mock(DocumentAuthorizationService.class);
    private final PermissionEvaluationService permissions = mock(PermissionEvaluationService.class);
    private final SystemConfigurationService configuration = mock(SystemConfigurationService.class);
    private final DocumentReportVisibility visibility = new DocumentReportVisibility(authorization, permissions, configuration);

    private UserAccount actor() {
        var actor = new UserAccount();
        actor.setId(UUID.randomUUID());
        actor.setStatus(UserStatus.Active);
        return actor;
    }

    @Test
    void aViewEverythingHolderGetsNoCondition() {
        when(authorization.canListAllDocuments(any())).thenReturn(true);
        when(authorization.canViewAllControlledCopies(any())).thenReturn(true);
        when(authorization.canViewAllUncontrolledCopies(any())).thenReturn(true);
        when(permissions.hasPermission(any(), anyString())).thenReturn(true);
        var actor = actor();
        assertSame(ReportQueryKit.EVERYTHING, visibility.documents(actor, "d"));
        assertSame(ReportQueryKit.EVERYTHING, visibility.revisions(actor, "r"));
        assertSame(ReportQueryKit.EVERYTHING, visibility.controlledCopies(actor, "cc"));
        assertSame(ReportQueryKit.EVERYTHING, visibility.uncontrolledCopies(actor, "uc"));
    }

    @Test
    void uncontrolledCopiesNeedTheBasePermissionAsWellAsTheViewEverythingOne() {
        when(authorization.canViewAllUncontrolledCopies(any())).thenReturn(true);
        when(permissions.hasPermission(any(), anyString())).thenReturn(false);
        assertNotSame(ReportQueryKit.EVERYTHING, visibility.uncontrolledCopies(actor(), "uc"));
    }

    @Test
    void anyoneElseSeesTheDocumentsTheyTookPartIn() {
        var actor = actor();
        var cond = visibility.documents(actor, "d");
        assertTrue(cond.sql().contains("d.author_user_id=?") && cond.sql().contains("d.owner_user_id=?"));
        assertTrue(cond.sql().contains("document_workflow_participants") && cond.sql().contains("revision_workflow_participants"));
        assertEquals(List.of(actor.getId(), actor.getId(), actor.getId(), actor.getId()), cond.args());
        assertFalse(cond.sql().contains("document_stakeholder_history"), "removed-participant history only when the setting keeps it");
    }

    @Test
    void theRemovedParticipantHistoryIsUsedOnlyForTheRolesTheSettingKeeps() {
        when(configuration.getRetainVisibilityForRemovedParticipantTypes()).thenReturn(new LinkedHashSet<>(List.of("AUTHOR", "REVIEWER")));
        var actor = actor();
        var cond = visibility.documents(actor, "d");
        assertTrue(cond.sql().contains("document_stakeholder_history") && cond.sql().contains("in (?,?)"));
        assertEquals(7, cond.args().size());
        assertTrue(cond.args().containsAll(List.of("AUTHOR", "REVIEWER")));
        assertEquals(cond.sql().length() - cond.sql().replace("?", "").length(), cond.args().size(), "one value for every placeholder");
        var revisions = visibility.revisions(actor, "r");
        assertEquals(revisions.sql().length() - revisions.sql().replace("?", "").length(), revisions.args().size());
    }

    @Test
    void aRevisionIsSeenByItsAuthorItsOwnerTheOwnerOfTheDocumentOrItsFlow() {
        var actor = actor();
        var cond = visibility.revisions(actor, "r");
        assertTrue(cond.sql().contains("r.author_user_id=?") && cond.sql().contains("r.owner_user_id=?") && cond.sql().contains("vd.owner_user_id=?"));
        assertTrue(cond.sql().contains("revision_workflow_participants vp where vp.revision_id=r.id"));
        assertEquals(4, cond.args().size());
    }

    @Test
    void aControlledCopyIsSeenByItsRecipientOnly() {
        var actor = actor();
        var cond = visibility.controlledCopies(actor, "cc");
        assertEquals("(cc.recipient_user_id=?)", cond.sql());
        assertEquals(List.of(actor.getId()), cond.args());
    }

    @Test
    void anUncontrolledCopyIsSeenByItsRecipientAndAnApproverSeesTheRequestsWaitingForDecision() {
        var actor = actor();
        var plain = visibility.uncontrolledCopies(actor, "uc");
        assertEquals("(uc.recipient_user_id=?)", plain.sql());
        when(permissions.hasAnyPermission(any(), anyString(), anyString())).thenReturn(true);
        var approver = visibility.uncontrolledCopies(actor, "uc");
        assertTrue(approver.sql().contains("uc.status_code='" + UncontrolledCopyService.STATUS_REQUESTED + "'"));
        assertEquals(List.of(actor.getId()), approver.args());
    }

    @Test
    void theConditionIsAddedToTheGrantsOfTheTemplateScopeNotInsteadOfThem() {
        var actor = actor();
        var providers = List.of(new DocumentReportMetadataProvider(visibility), new RevisionReportMetadataProvider(visibility),
                new ControlledCopyReportMetadataProvider(visibility), new UncontrolledCopyReportMetadataProvider(visibility));
        for (var provider : providers) {
            var query = provider.query(actor, List.of("SYSTEM"), Map.of("search", "abc"));
            assertTrue(query.fromWhere().replaceAll("\s+", " ").contains(") and ("), provider.code() + " adds the visibility with AND");
            int placeholders = query.fromWhere().length() - query.fromWhere().replace("?", "").length();
            assertEquals(placeholders, query.arguments().size(), provider.code() + ": one value for every placeholder");
            assertEquals(actor.getId(), query.arguments().get(0), provider.code() + ": the person comes before the search text");
            assertTrue(query.arguments().stream().anyMatch(v -> String.valueOf(v).contains("abc")));
        }
    }

    @Test
    void aPersonalScopeIsNarrowedAgainAndNeverWidened() {
        var actor = actor();
        var query = new ControlledCopyReportMetadataProvider(visibility).query(actor, List.of("PERSONAL"), Map.of());
        assertTrue(query.fromWhere().contains("cc.requested_by_user_id=?") && query.fromWhere().contains("cc.recipient_user_id=?"));
        assertEquals(4, query.arguments().size(), "three for the personal scope and one for the recipient");
    }
}
