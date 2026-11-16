package com.eqms.service;

import com.eqms.entity.ControlledCopyRecord;
import com.eqms.entity.DocumentRecord;
import com.eqms.entity.DocumentRevisionRecord;
import com.eqms.entity.DocumentStatusDefinition;
import com.eqms.entity.RevisionStatusDefinition;
import com.eqms.entity.UncontrolledCopyRecord;
import jakarta.annotation.PostConstruct;
import jakarta.persistence.EntityManagerFactory;
import org.hibernate.event.service.spi.EventListenerRegistry;
import org.hibernate.event.spi.EventType;
import org.hibernate.event.spi.PreUpdateEvent;
import org.hibernate.event.spi.PreUpdateEventListener;
import org.hibernate.internal.SessionFactoryImpl;
import org.springframework.stereotype.Component;

import java.util.Arrays;

/**
 * The server refuses to save a Document or a Revision into a status the product can never lead it to, whoever asks: a service, a job, a script or a test that saves the
 * entity directly (LIFECYCLE-GUARD-2026-11-14). The rules are only the ones that hold for every path of the product:
 * <ul>
 *   <li>an ending status (Obsoleted, Closed - Cancelled) never turns into the other ending status; Reopen leaves it for the status the record had before;</li>
 *   <li>a Document becomes Obsoleted only from Active (the one place that does it is the Obsolete action, which requires it);</li>
 *   <li>a Document becomes Closed - Cancelled only from Draft (Cancel requires that it has no revision), and a Revision never from Effective: what was Effective is
 *       Obsoleted, never Closed - Cancelled (STATUS-CONSISTENCY-2026-11-14);</li>
 *   <li>a Revision becomes Obsoleted only from Effective (a new revision replaces it, or its Document is obsoleted), or from Draft in the Legacy Batch Import, which
 *       closes the historical revisions it creates.</li>
 * </ul>
 * A Controlled Copy and an Uncontrolled Copy are guarded the same way (STATUS-CONSISTENCY-2026-11-14): a copy is Ready for Distribution when it is made, becomes Distributed
 * only from Ready, Closed - Cancelled only from Ready (an Uncontrolled Copy also from Distributed, when its validity ends), and Obsoleted (Controlled Copy) only from
 * Distributed or Ready; nothing leaves an ending status.
 * It does not replace the rules of the services (who may do what, when); it makes the data impossible to put in a state that no rule allows. The transition is read from the
 * values Hibernate holds before and after the change, so a save that does not change the status is never looked at.
 */
@Component
public class LifecycleTransitionGuard implements PreUpdateEventListener {
    public static final String TRANSITION_REFUSED = "LIFECYCLE_TRANSITION_NOT_ALLOWED";
    private static final String OBSOLETED = "OBSOLETED";
    private static final String CLOSED_CANCELLED = "CLOSED_CANCELLED";

    private final EntityManagerFactory entityManagerFactory;

    public LifecycleTransitionGuard(EntityManagerFactory entityManagerFactory) {
        this.entityManagerFactory = entityManagerFactory;
    }

    @PostConstruct
    void register() {
        var registry = entityManagerFactory.unwrap(SessionFactoryImpl.class).getServiceRegistry().getService(EventListenerRegistry.class);
        registry.appendListeners(EventType.PRE_UPDATE, this);
    }

    static boolean isEnding(String status) {
        return OBSOLETED.equals(status) || CLOSED_CANCELLED.equals(status);
    }

    /** Whether a Document may be saved from one status into another. */
    public static boolean documentTransitionAllowed(String from, String to) {
        if (from == null || to == null || from.equals(to)) return true;
        if (isEnding(from) && isEnding(to)) return false;
        if (CLOSED_CANCELLED.equals(to) && !"DRAFT".equals(from)) return false;
        return !OBSOLETED.equals(to) || "ACTIVE".equals(from);
    }

    /** Whether a Revision may be saved from one status into another. */
    public static boolean revisionTransitionAllowed(String from, String to) {
        if (from == null || to == null || from.equals(to)) return true;
        if (isEnding(from) && isEnding(to)) return false;
        if (CLOSED_CANCELLED.equals(to) && "EFFECTIVE".equals(from)) return false;
        return !OBSOLETED.equals(to) || "EFFECTIVE".equals(from) || "DRAFT".equals(from);
    }

    /** Whether a Controlled Copy may be saved from one status into another. */
    public static boolean controlledCopyTransitionAllowed(String from, String to) {
        if (from == null || to == null || from.equals(to)) return true;
        if (isEnding(from)) return false;
        return switch (to) {
            case "DISTRIBUTED", CLOSED_CANCELLED -> "READY_FOR_DISTRIBUTION".equals(from);
            case OBSOLETED -> "DISTRIBUTED".equals(from) || "READY_FOR_DISTRIBUTION".equals(from);
            default -> false;
        };
    }

    /** Whether an Uncontrolled Copy may be saved from one status into another. */
    public static boolean uncontrolledCopyTransitionAllowed(String from, String to) {
        if (from == null || to == null || from.equals(to)) return true;
        if (isEnding(from)) return false;
        return switch (to) {
            case "DISTRIBUTED" -> "READY_FOR_DISTRIBUTION".equals(from);
            case CLOSED_CANCELLED -> "READY_FOR_DISTRIBUTION".equals(from) || "DISTRIBUTED".equals(from);
            default -> false;
        };
    }

    @Override
    public boolean onPreUpdate(PreUpdateEvent event) {
        Object entity = event.getEntity();
        if (entity instanceof ControlledCopyRecord || entity instanceof UncontrolledCopyRecord) return checkCopy(event, entity);
        if (!(entity instanceof DocumentRecord) && !(entity instanceof DocumentRevisionRecord)) return false;
        String[] names = event.getPersister().getPropertyNames();
        int at = Arrays.asList(names).indexOf("status");
        Object[] before = event.getOldState();
        Object[] after = event.getState();
        if (at < 0 || before == null || after == null) return false;
        String from = codeOf(before[at]);
        String to = codeOf(after[at]);
        boolean allowed = entity instanceof DocumentRecord ? documentTransitionAllowed(from, to) : revisionTransitionAllowed(from, to);
        if (!allowed) {
            throw new IllegalStateException(TRANSITION_REFUSED + ": " + (entity instanceof DocumentRecord ? "Document " : "Revision ") + from + " -> " + to);
        }
        return false;
    }

    private boolean checkCopy(PreUpdateEvent event, Object entity) {
        int at = Arrays.asList(event.getPersister().getPropertyNames()).indexOf("statusCode");
        Object[] before = event.getOldState();
        Object[] after = event.getState();
        if (at < 0 || before == null || after == null) return false;
        String from = before[at] == null ? null : before[at].toString();
        String to = after[at] == null ? null : after[at].toString();
        boolean controlled = entity instanceof ControlledCopyRecord;
        if (!(controlled ? controlledCopyTransitionAllowed(from, to) : uncontrolledCopyTransitionAllowed(from, to))) {
            throw new IllegalStateException(TRANSITION_REFUSED + ": " + (controlled ? "Controlled Copy " : "Uncontrolled Copy ") + from + " -> " + to);
        }
        return false;
    }

    private static String codeOf(Object status) {
        if (status instanceof DocumentStatusDefinition document) return document.getCode();
        if (status instanceof RevisionStatusDefinition revision) return revision.getCode();
        return null;
    }
}
