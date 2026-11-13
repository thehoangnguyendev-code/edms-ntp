package com.eqms.service.report;

import com.eqms.entity.UserAccount;
import com.eqms.service.DocumentAuthorizationService;
import com.eqms.service.PermissionEvaluationService;
import com.eqms.service.SystemConfigurationService;
import com.eqms.service.UncontrolledCopyService;
import org.springframework.stereotype.Component;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;

/**
 * REPORT-DC-VISIBILITY-2026-11-12: the reports on Document Control records show a person only what the Document Control lists show the same person.
 * Each method is the SQL form of the rule the matching list already applies (DocumentService / RevisionService / ControlledCopyService /
 * UncontrolledCopyService); the decision of "sees everything" is asked from {@link DocumentAuthorizationService}, so the two cannot drift.
 * The result is added with AND to the grants of the template scope: a template scope can narrow what a person sees, never widen it.
 */
@Component
public class DocumentReportVisibility {
    private final DocumentAuthorizationService authorization;
    private final PermissionEvaluationService permissions;
    private final SystemConfigurationService configuration;

    public DocumentReportVisibility(DocumentAuthorizationService authorization, PermissionEvaluationService permissions, SystemConfigurationService configuration) {
        this.authorization = authorization;
        this.permissions = permissions;
        this.configuration = configuration;
    }

    /** Documents: everything for a view-everything holder; otherwise the author, the owner, a person named in the flow of the document or of one of its revisions, or kept by "Retain Visibility". */
    public ReportQueryKit.Cond documents(UserAccount actor, String doc) {
        if (authorization.canListAllDocuments(actor)) {
            return ReportQueryKit.EVERYTHING;
        }
        List<Object> args = new ArrayList<>();
        StringBuilder sql = new StringBuilder("(" + doc + ".author_user_id=? or " + doc + ".owner_user_id=?");
        args.add(actor.getId()); args.add(actor.getId());
        sql.append(" or exists(select 1 from document_workflow_participants vp where vp.document_id=").append(doc).append(".id and vp.user_id=?)");
        args.add(actor.getId());
        sql.append(" or exists(select 1 from revision_workflow_participants vp join document_revisions vr on vr.id=vp.revision_id where vr.document_id=").append(doc).append(".id and vp.user_id=?)");
        args.add(actor.getId());
        retained(sql, args, actor, doc + ".id");
        return new ReportQueryKit.Cond(sql.append(")").toString(), args);
    }

    /** Revisions: everything for a view-everything holder; otherwise the author or owner of the revision, the owner of the document, a person named in the flow of the revision, or kept by "Retain Visibility". */
    public ReportQueryKit.Cond revisions(UserAccount actor, String rev) {
        if (authorization.canListAllDocuments(actor)) {
            return ReportQueryKit.EVERYTHING;
        }
        List<Object> args = new ArrayList<>();
        StringBuilder sql = new StringBuilder("(" + rev + ".author_user_id=? or " + rev + ".owner_user_id=?"
                + " or exists(select 1 from documents vd where vd.id=" + rev + ".document_id and vd.owner_user_id=?)"
                + " or exists(select 1 from revision_workflow_participants vp where vp.revision_id=" + rev + ".id and vp.user_id=?)");
        args.add(actor.getId()); args.add(actor.getId()); args.add(actor.getId()); args.add(actor.getId());
        retained(sql, args, actor, rev + ".document_id");
        return new ReportQueryKit.Cond(sql.append(")").toString(), args);
    }

    /** Controlled Copies: everything for a view-everything holder; otherwise the copies on which the person is the named recipient. */
    public ReportQueryKit.Cond controlledCopies(UserAccount actor, String copy) {
        if (authorization.canViewAllControlledCopies(actor)) {
            return ReportQueryKit.EVERYTHING;
        }
        return new ReportQueryKit.Cond("(" + copy + ".recipient_user_id=?)", List.of(actor.getId()));
    }

    /** Uncontrolled Copies: everything for a view-everything holder; otherwise the copies of the recipient, and, for a person who may approve or reject, the requests that wait for a decision. */
    public ReportQueryKit.Cond uncontrolledCopies(UserAccount actor, String copy) {
        if (permissions.hasPermission(actor, UncontrolledCopyService.P_VIEW) && authorization.canViewAllUncontrolledCopies(actor)) {
            return ReportQueryKit.EVERYTHING;
        }
        String sql = "(" + copy + ".recipient_user_id=?";
        if (permissions.hasAnyPermission(actor, UncontrolledCopyService.P_APPROVE, UncontrolledCopyService.P_REJECT)) {
            sql += " or " + copy + ".status_code='" + UncontrolledCopyService.STATUS_REQUESTED + "'";
        }
        return new ReportQueryKit.Cond(sql + ")", List.of(actor.getId()));
    }

    private void retained(StringBuilder sql, List<Object> args, UserAccount actor, String documentIdSql) {
        Set<String> types = configuration.getRetainVisibilityForRemovedParticipantTypes();
        if (types == null || types.isEmpty()) {
            return;
        }
        // The role codes are values of the system setting, not of a request; they are still passed as parameters.
        sql.append(" or exists(select 1 from document_stakeholder_history vh where vh.document_id=").append(documentIdSql)
                .append(" and vh.user_id=? and vh.participant_type in (").append(String.join(",", types.stream().map(t -> "?").toList())).append("))");
        args.add(actor.getId());
        args.addAll(types);
    }
}
