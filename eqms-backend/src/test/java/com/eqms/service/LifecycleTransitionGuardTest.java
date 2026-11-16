package com.eqms.service;

import com.eqms.entity.DocumentRecord;
import com.eqms.entity.DocumentRevisionRecord;
import com.eqms.entity.DocumentStatusDefinition;
import com.eqms.entity.RevisionStatusDefinition;
import jakarta.persistence.EntityManagerFactory;
import org.hibernate.event.spi.PreUpdateEvent;
import org.hibernate.persister.entity.EntityPersister;
import org.junit.jupiter.api.Test;
import java.util.List;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/** LIFECYCLE-GUARD-2026-11-14: the data cannot be put in a status that no path of the product leads to. */
class LifecycleTransitionGuardTest {
    private static final List<String> DOCUMENT = List.of("DRAFT", "ACTIVE", "OBSOLETED", "CLOSED_CANCELLED");
    private static final List<String> REVISION = List.of("DRAFT", "PENDING_REVIEW", "PENDING_APPROVAL", "PENDING_TRAINING", "READY_FOR_PUBLISHING", "EFFECTIVE", "OBSOLETED", "CLOSED_CANCELLED");

    @Test
    void anEndingStatusNeverTurnsIntoTheOtherEndingStatus() {
        assertFalse(LifecycleTransitionGuard.documentTransitionAllowed("OBSOLETED", "CLOSED_CANCELLED"));
        assertFalse(LifecycleTransitionGuard.documentTransitionAllowed("CLOSED_CANCELLED", "OBSOLETED"));
        assertFalse(LifecycleTransitionGuard.revisionTransitionAllowed("OBSOLETED", "CLOSED_CANCELLED"));
        assertFalse(LifecycleTransitionGuard.revisionTransitionAllowed("CLOSED_CANCELLED", "OBSOLETED"));
    }

    @Test
    void theRealPathsOfTheProductStayAllowed() {
        // cancel in Draft, activate, obsolete from Active, reopen to the status before
        for (String[] move : new String[][]{{"DRAFT", "CLOSED_CANCELLED"}, {"DRAFT", "ACTIVE"}, {"ACTIVE", "OBSOLETED"}, {"OBSOLETED", "ACTIVE"}, {"CLOSED_CANCELLED", "DRAFT"}, {"ACTIVE", "ACTIVE"}})
            assertTrue(LifecycleTransitionGuard.documentTransitionAllowed(move[0], move[1]), "Document " + move[0] + " > " + move[1]);
        for (String[] move : new String[][]{{"DRAFT", "PENDING_REVIEW"}, {"READY_FOR_PUBLISHING", "EFFECTIVE"}, {"EFFECTIVE", "OBSOLETED"}, {"EFFECTIVE", "DRAFT"}, {"PENDING_REVIEW", "CLOSED_CANCELLED"},
                {"DRAFT", "CLOSED_CANCELLED"}, {"OBSOLETED", "EFFECTIVE"}, {"CLOSED_CANCELLED", "DRAFT"}, {"DRAFT", "OBSOLETED"} /* the Legacy Batch Import */})
            assertTrue(LifecycleTransitionGuard.revisionTransitionAllowed(move[0], move[1]), "Revision " + move[0] + " > " + move[1]);
    }

    /** STATUS-CONSISTENCY-2026-11-14: what was Effective is Obsoleted, never Closed - Cancelled; Cancel of a Document needs it to have no revision, so it is Draft. */
    @Test
    void closedCancelledIsReachedOnlyByWhatWasNeverEffective() {
        for (String from : DOCUMENT) assertEquals("DRAFT".equals(from) || "CLOSED_CANCELLED".equals(from), LifecycleTransitionGuard.documentTransitionAllowed(from, "CLOSED_CANCELLED"), "Document " + from);
        assertFalse(LifecycleTransitionGuard.documentTransitionAllowed("ACTIVE", "CLOSED_CANCELLED"));
        assertFalse(LifecycleTransitionGuard.revisionTransitionAllowed("EFFECTIVE", "CLOSED_CANCELLED"));
        for (String from : List.of("DRAFT", "PENDING_REVIEW", "PENDING_APPROVAL", "PENDING_TRAINING", "READY_FOR_PUBLISHING"))
            assertTrue(LifecycleTransitionGuard.revisionTransitionAllowed(from, "CLOSED_CANCELLED"), "Revision " + from);
    }

    /** STATUS-CONSISTENCY-2026-11-14: a copy goes Ready for Distribution, then Distributed or closed; nothing leaves an ending status. */
    @Test
    void aCopyFollowsItsLifecycleAndNothingLeavesAnEndingStatus() {
        List<String> all = List.of("READY_FOR_DISTRIBUTION", "DISTRIBUTED", "OBSOLETED", "CLOSED_CANCELLED");
        for (String[] ok : new String[][]{{"READY_FOR_DISTRIBUTION", "DISTRIBUTED"}, {"READY_FOR_DISTRIBUTION", "CLOSED_CANCELLED"}, {"READY_FOR_DISTRIBUTION", "OBSOLETED"}, {"DISTRIBUTED", "OBSOLETED"}})
            assertTrue(LifecycleTransitionGuard.controlledCopyTransitionAllowed(ok[0], ok[1]), "Controlled Copy " + ok[0] + " > " + ok[1]);
        for (String[] no : new String[][]{{"DISTRIBUTED", "CLOSED_CANCELLED"}, {"DISTRIBUTED", "READY_FOR_DISTRIBUTION"}, {"OBSOLETED", "DISTRIBUTED"}, {"OBSOLETED", "CLOSED_CANCELLED"}, {"CLOSED_CANCELLED", "DISTRIBUTED"}, {"CLOSED_CANCELLED", "OBSOLETED"}})
            assertFalse(LifecycleTransitionGuard.controlledCopyTransitionAllowed(no[0], no[1]), "Controlled Copy " + no[0] + " > " + no[1]);
        for (String from : List.of("OBSOLETED", "CLOSED_CANCELLED")) for (String to : all) if (!from.equals(to)) assertFalse(LifecycleTransitionGuard.controlledCopyTransitionAllowed(from, to));
        for (String[] ok : new String[][]{{"READY_FOR_DISTRIBUTION", "DISTRIBUTED"}, {"READY_FOR_DISTRIBUTION", "CLOSED_CANCELLED"}, {"DISTRIBUTED", "CLOSED_CANCELLED"}})
            assertTrue(LifecycleTransitionGuard.uncontrolledCopyTransitionAllowed(ok[0], ok[1]), "Uncontrolled Copy " + ok[0] + " > " + ok[1]);
        for (String[] no : new String[][]{{"DISTRIBUTED", "READY_FOR_DISTRIBUTION"}, {"CLOSED_CANCELLED", "DISTRIBUTED"}, {"READY_FOR_DISTRIBUTION", "OBSOLETED"}, {"CLOSED_CANCELLED", "READY_FOR_DISTRIBUTION"}})
            assertFalse(LifecycleTransitionGuard.uncontrolledCopyTransitionAllowed(no[0], no[1]), "Uncontrolled Copy " + no[0] + " > " + no[1]);
    }

    @Test
    void aDocumentBecomesObsoletedOnlyFromActive() {
        for (String from : DOCUMENT) assertEquals("ACTIVE".equals(from) || "OBSOLETED".equals(from), LifecycleTransitionGuard.documentTransitionAllowed(from, "OBSOLETED"), from);
    }

    @Test
    void aRevisionBecomesObsoletedOnlyFromEffectiveOrFromDraftInTheLegacyImport() {
        for (String from : REVISION) {
            boolean expected = List.of("EFFECTIVE", "DRAFT", "OBSOLETED").contains(from);
            assertEquals(expected, LifecycleTransitionGuard.revisionTransitionAllowed(from, "OBSOLETED"), from);
        }
        assertFalse(LifecycleTransitionGuard.revisionTransitionAllowed("PENDING_APPROVAL", "OBSOLETED"));
        assertFalse(LifecycleTransitionGuard.revisionTransitionAllowed("READY_FOR_PUBLISHING", "OBSOLETED"));
    }

    private PreUpdateEvent event(Object entity, String from, String to, boolean revision) {
        var persister = mock(EntityPersister.class);
        when(persister.getPropertyNames()).thenReturn(new String[]{"name", "status"});
        var event = mock(PreUpdateEvent.class);
        when(event.getEntity()).thenReturn(entity);
        when(event.getPersister()).thenReturn(persister);
        Object before = status(from, revision);
        Object after = status(to, revision);
        when(event.getOldState()).thenReturn(new Object[]{"n", before});
        when(event.getState()).thenReturn(new Object[]{"n", after});
        return event;
    }

    private Object status(String code, boolean revision) {
        if (revision) {
            var status = mock(RevisionStatusDefinition.class);
            when(status.getCode()).thenReturn(code);
            return status;
        }
        var status = mock(DocumentStatusDefinition.class);
        when(status.getCode()).thenReturn(code);
        return status;
    }

    @Test
    void theListenerRefusesTheSaveOfAnImpossibleTransitionAndOnlyThat() {
        var guard = new LifecycleTransitionGuard(mock(EntityManagerFactory.class));
        var refused = assertThrows(IllegalStateException.class, () -> guard.onPreUpdate(event(new DocumentRevisionRecord(), "OBSOLETED", "CLOSED_CANCELLED", true)));
        assertTrue(refused.getMessage().startsWith(LifecycleTransitionGuard.TRANSITION_REFUSED));
        assertThrows(IllegalStateException.class, () -> guard.onPreUpdate(event(new DocumentRecord(), "DRAFT", "OBSOLETED", false)));
        assertFalse(guard.onPreUpdate(event(new DocumentRecord(), "DRAFT", "CLOSED_CANCELLED", false)));
        assertFalse(guard.onPreUpdate(event(new DocumentRevisionRecord(), "EFFECTIVE", "OBSOLETED", true)));
        assertFalse(guard.onPreUpdate(event("another entity", "OBSOLETED", "CLOSED_CANCELLED", false)), "another kind of entity is not looked at");
    }
}
