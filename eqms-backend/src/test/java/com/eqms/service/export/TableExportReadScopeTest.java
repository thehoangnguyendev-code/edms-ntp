package com.eqms.service.export;

import jakarta.persistence.EntityManager;
import org.hibernate.FlushMode;
import org.hibernate.Session;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class TableExportReadScopeTest {
    @Test void boundsPersistenceContextAndRestoresWriteModeBeforeAudit() {
        var manager = mock(EntityManager.class);
        var session = mock(Session.class);
        when(manager.unwrap(Session.class)).thenReturn(session);
        when(session.getHibernateFlushMode()).thenReturn(FlushMode.AUTO);
        try (var scope = new TableExportReadScope(manager)) {
            verify(session).setHibernateFlushMode(FlushMode.MANUAL);
            verify(session).setDefaultReadOnly(true);
            scope.completedPage();
            scope.completedPage();
        }
        verify(session, times(2)).clear();
        var order = inOrder(session);
        order.verify(session).setDefaultReadOnly(false);
        order.verify(session).setHibernateFlushMode(FlushMode.AUTO);
    }

    @Test void extractionFailureAlsoRestoresOriginalSessionState() {
        var manager = mock(EntityManager.class);
        var session = mock(Session.class);
        when(manager.unwrap(Session.class)).thenReturn(session);
        when(session.getHibernateFlushMode()).thenReturn(FlushMode.COMMIT);
        when(session.isDefaultReadOnly()).thenReturn(true);
        assertThatThrownBy(() -> {
            try (var ignored = new TableExportReadScope(manager)) { throw new IllegalStateException("query failed"); }
        }).hasMessage("query failed");
        verify(session, times(2)).setDefaultReadOnly(true);
        verify(session).setHibernateFlushMode(FlushMode.COMMIT);
    }
}
