package com.eqms.service;

import com.eqms.entity.UserAccount;
import com.eqms.repository.ControlledCopyRepository;
import com.eqms.repository.DocumentRecordRepository;
import com.eqms.repository.DocumentRevisionRepository;
import com.eqms.repository.DocumentStakeholderHistoryRepository;
import com.eqms.repository.DocumentWorkflowParticipantRepository;
import com.eqms.repository.RevisionWorkflowParticipantRepository;
import com.eqms.repository.UncontrolledCopyRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Set;

/**
 * Which groups of the Document Control menu a person has something to do in (DC-VISIBILITY-TIERS-2026-11-07). A group is listed when the
 * administrator granted its permission AND the person either holds the matching view-everything permission or has a name in that flow.
 * The tests behind it are the same ones the lists use ({@link DocumentAuthorizationService}), so the menu never shows a group whose list
 * would be empty by rule, and never hides one that has rows. A person newly named in a flow sees the group at the next menu refresh.
 * The menu is only a hint: every list and action is decided again on the server.
 */
@Service
public class DocumentControlMenuAccess {

    static final String P_CONTROLLED_COPY_VIEW = "documents.controlled_copy.view";
    static final String P_UNCONTROLLED_COPY_VIEW = "documents.uncontrolled_copy.view";
    static final String P_UNCONTROLLED_COPY_REQUEST = "documents.uncontrolled_copy.request";
    static final String P_UNCONTROLLED_COPY_DISTRIBUTE = "documents.uncontrolled_copy.distribute";

    /** Which groups to list. */
    public record Sections(boolean documents, boolean controlledCopies, boolean uncontrolledCopies) {
    }

    private final DocumentAuthorizationService documentAuthorization;
    private final PermissionEvaluationService permissions;
    private final SystemConfigurationService configuration;
    private final DocumentRecordRepository documents;
    private final DocumentRevisionRepository revisions;
    private final DocumentWorkflowParticipantRepository documentParticipants;
    private final RevisionWorkflowParticipantRepository revisionParticipants;
    private final DocumentStakeholderHistoryRepository history;
    private final ControlledCopyRepository controlledCopies;
    private final UncontrolledCopyRepository uncontrolledCopies;

    public DocumentControlMenuAccess(
            DocumentAuthorizationService documentAuthorization,
            PermissionEvaluationService permissions,
            SystemConfigurationService configuration,
            DocumentRecordRepository documents,
            DocumentRevisionRepository revisions,
            DocumentWorkflowParticipantRepository documentParticipants,
            RevisionWorkflowParticipantRepository revisionParticipants,
            DocumentStakeholderHistoryRepository history,
            ControlledCopyRepository controlledCopies,
            UncontrolledCopyRepository uncontrolledCopies
    ) {
        this.documentAuthorization = documentAuthorization;
        this.permissions = permissions;
        this.configuration = configuration;
        this.documents = documents;
        this.revisions = revisions;
        this.documentParticipants = documentParticipants;
        this.revisionParticipants = revisionParticipants;
        this.history = history;
        this.controlledCopies = controlledCopies;
        this.uncontrolledCopies = uncontrolledCopies;
    }

    @Transactional(readOnly = true)
    public Sections sectionsFor(UserAccount user) {
        if (user == null || user.getId() == null) {
            return new Sections(false, false, false);
        }
        return new Sections(
                documentAuthorization.canListAllDocuments(user) || documentAuthorization.canViewDepartmentRecords(user) || namedInDocumentFlow(user),
                permissions.hasPermission(user, P_CONTROLLED_COPY_VIEW)
                        && (documentAuthorization.canViewAllControlledCopies(user) || controlledCopies.existsByRecipientUser_Id(user.getId())
                        || namedInDocumentFlow(user)),
                uncontrolledCopiesVisible(user));
    }

    /** Creator, Author, Co-author, Reviewer or Approver of any Document or Revision; also a role the person was removed from, when its "retain visibility" toggle is on. */
    boolean namedInDocumentFlow(UserAccount user) {
        java.util.UUID id = user.getId();
        if (documents.existsByAuthor_Id(id) || documents.existsByOwner_Id(id) || revisions.existsByAuthor_Id(id)
                || documentParticipants.existsByUser_Id(id) || revisionParticipants.existsByUser_Id(id)) {
            return true;
        }
        Set<String> retained = configuration.getRetainVisibilityForRemovedParticipantTypes();
        return retained != null && !retained.isEmpty() && history.existsByUser_IdAndParticipantTypeIn(id, retained);
    }

    private boolean uncontrolledCopiesVisible(UserAccount user) {
        boolean mayOpen = permissions.hasAnyPermission(user, P_UNCONTROLLED_COPY_VIEW, P_UNCONTROLLED_COPY_REQUEST);
        if (!mayOpen) {
            return false;
        }
        // a person who may distribute sees the requests that wait for distribution, even without the view-everything permission
        boolean distributor = permissions.hasPermission(user, P_UNCONTROLLED_COPY_DISTRIBUTE);
        return distributor
                || (permissions.hasPermission(user, P_UNCONTROLLED_COPY_VIEW) && documentAuthorization.canViewAllUncontrolledCopies(user))
                || (permissions.hasPermission(user, P_UNCONTROLLED_COPY_VIEW) && namedInDocumentFlow(user))
                || uncontrolledCopies.existsByRecipientUserId(user.getId());
    }
}
