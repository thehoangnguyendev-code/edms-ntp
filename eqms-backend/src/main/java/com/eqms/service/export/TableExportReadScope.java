package com.eqms.service.export;

import jakarta.persistence.EntityManager;
import org.hibernate.FlushMode;
import org.hibernate.Session;
import org.springframework.data.jpa.domain.Specification;
import jakarta.persistence.criteria.JoinType;

/** Only for read-only register extraction; closed before the mandatory export audit is written. */
public final class TableExportReadScope implements AutoCloseable {
    private final Session session;
    private final FlushMode flushMode;
    private final boolean readOnly;

    public TableExportReadScope(EntityManager manager) {
        session = manager.unwrap(Session.class);
        flushMode = session.getHibernateFlushMode();
        readOnly = session.isDefaultReadOnly();
        session.setHibernateFlushMode(FlushMode.MANUAL);
        session.setDefaultReadOnly(true);
    }

    /** Release the completed page so memory does not grow with the exported register. */
    public void completedPage() { session.clear(); }

    @Override public void close() {
        session.setDefaultReadOnly(readOnly);
        session.setHibernateFlushMode(flushMode);
    }

    public static <T> Specification<T> fetchToOne(String... attributes) {
        return (root, query, cb) -> {
            if (query != null && query.getResultType() != Long.class && query.getResultType() != long.class) {
                for (String attribute : attributes) root.fetch(attribute, JoinType.LEFT);
            }
            return cb.conjunction();
        };
    }
}
