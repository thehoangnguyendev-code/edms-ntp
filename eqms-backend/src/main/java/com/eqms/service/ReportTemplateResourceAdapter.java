package com.eqms.service;

import com.eqms.entity.UserAccount;
import com.eqms.entity.WorkflowActionPolicy;
import com.eqms.repository.WorkflowActionPolicyRelationRepository;
import com.eqms.service.workflow.ReportWorkflowDefinitionProvider;
import com.eqms.service.authorization.ResolvedPolicy;
import com.eqms.service.authorization.ResourceAuthorizationAdapter;
import com.eqms.service.report.ReportTemplateRevisionService;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

/**
 * Report template review (approve, reject) as a resource of the Hybrid authorization engine: phase B of {@code AUTHORIZATION_SYSTEM_WIDE_HYBRID_PLAN_2026_11_15}, rows approved by the owner
 * on 2026-11-18 as they are today ({@code AUTHORIZATION_ACTION_CATALOG_REPORT_AS_IS_2026_11_18}). It mirrors what {@code ReportTemplateService.approve / reject} decide in code:
 * <ul>
 *   <li>state: the template (or its open revision, when a revision is effective) must be {@code PENDING_APPROVAL};</li>
 *   <li>permission: {@code reports.definition.approve_gmp} for a template that is, or whose revision under review makes it, a GMP template, otherwise
 *       {@code reports.definition.approve} (the variant of the workflow is {@code GMP});</li>
 *   <li>a different person: the reviewer must be neither the author of the version under review nor the person who submitted it ({@code AUTHOR}, {@code SUBMITTER}).</li>
 * </ul>
 * The policies are rows of {@code workflow_action_policies} (module {@code REPORT}, workflow {@code REPORT_TEMPLATE}, seeded by V807), so Workflow Authorization shows and edits them like those of
 * Document Control: the permission, the required relations and, since V807, the relations the actor must NOT hold. A template for GMP decisions is reviewed by the actions with the suffix
 * {@code _GMP} (the engine passes the variant). The resource id is the one the audit trail already uses for a template: {@code UUID.nameUUIDFromBytes(code)}.
 * Whether the engine or the legacy checks decide is the cutover flag of {@code ReportTemplateService}; the other side runs in the shadow either way.
 */
@Component
public class ReportTemplateResourceAdapter implements ResourceAuthorizationAdapter {
    public static final String RESOURCE_TYPE = "REPORT_TEMPLATE";
    public static final String ACTION_APPROVE = "APPROVE";
    public static final String ACTION_REJECT = "REJECT";
    public static final String ACTION_DELETE = "DELETE";
    public static final String VARIANT_GMP = "GMP";
    public static final String PENDING = "PENDING_APPROVAL";
    /** The other actions of the life of a template; decided by permission (and, for a GMP template, by the absence of a policy), whatever the state. */
    public static final Set<String> LIFECYCLE_ACTIONS = Set.of("SUBMIT", "UPGRADE", "SET_ENABLED", "DISCARD_REVISION", "DELETE");
    public static final String RELATION_AUTHOR = "AUTHOR";
    public static final String RELATION_SUBMITTER = "SUBMITTER";

    private final JdbcTemplate jdbc;
    private final ReportTemplateRevisionService revisions;
    private final WorkflowActionPolicyService workflowActionPolicyService;
    private final WorkflowActionPolicyRelationRepository workflowActionPolicyRelationRepository;

    public ReportTemplateResourceAdapter(JdbcTemplate jdbc, ReportTemplateRevisionService revisions, WorkflowActionPolicyService workflowActionPolicyService,
                                         WorkflowActionPolicyRelationRepository workflowActionPolicyRelationRepository) {
        this.jdbc = jdbc;
        this.revisions = revisions;
        this.workflowActionPolicyService = workflowActionPolicyService;
        this.workflowActionPolicyRelationRepository = workflowActionPolicyRelationRepository;
    }

    /** The id the Audit Trail and this adapter use for the template with this code. */
    public static UUID idOf(String code) {
        return UUID.nameUUIDFromBytes(code.getBytes(StandardCharsets.UTF_8));
    }

    /** What the engine needs to know about one template, read once for one decision. */
    record Facts(String code, String state, boolean gmp, String authorId, String submitterId) {}

    @Override
    public String resourceType() {
        return RESOURCE_TYPE;
    }

    @Override
    public String resolveState(UUID resourceId) {
        Facts facts = facts(resourceId);
        return facts == null ? null : facts.state();
    }

    @Override
    public UUID resolveDocumentTypeId(UUID resourceId) {
        return null;
    }

    @Override
    public String resolveVariant(UUID resourceId) {
        Facts facts = facts(resourceId);
        return facts != null && facts.gmp() ? VARIANT_GMP : null;
    }

    @Override
    public Optional<ResolvedPolicy> resolvePolicy(String actionCode, String state, UUID documentTypeId) {
        return resolvePolicy(actionCode, state, documentTypeId, null);
    }

    @Override
    public Optional<ResolvedPolicy> resolvePolicy(String actionCode, String state, UUID documentTypeId, String variant) {
        boolean review = ACTION_APPROVE.equals(actionCode) || ACTION_REJECT.equals(actionCode);
        if (!review && !LIFECYCLE_ACTIONS.contains(actionCode)) return Optional.empty();
        // A review is decided from the state it starts in (Pending Approval); the other actions are decided by permission whatever the state, which stays a precondition of the service.
        String fromStatus = review ? state : "ANY";
        if (fromStatus == null) return Optional.empty();
        // only a review and a deletion differ for a GMP template (a different approval permission; never deleted); every other action is the same for both
        boolean variantMatters = review || ACTION_DELETE.equals(actionCode);
        String policyAction = variantMatters && VARIANT_GMP.equals(variant) ? actionCode + "_GMP" : actionCode;
        return workflowActionPolicyService
                .resolvePolicy(ReportWorkflowDefinitionProvider.MODULE, ReportWorkflowDefinitionProvider.WORKFLOW, ReportWorkflowDefinitionProvider.OBJECT_TYPE, policyAction, fromStatus, null)
                .map(policy -> new ResolvedPolicy(policy.getRequiredPermissionCode(), policy.getVersion(), relationCodes(policy, false), policy.getRelationMatchRule(), relationCodes(policy, true)));
    }

    private List<String> relationCodes(WorkflowActionPolicy policy, boolean forbidden) {
        return workflowActionPolicyRelationRepository.findAllByPolicy_IdAndActiveTrueOrderByPriorityAsc(policy.getId()).stream()
                .filter(r -> r.isForbidden() == forbidden)
                .map(r -> r.getRelationDefinition().getCode())
                .toList();
    }

    @Override
    public Set<String> resolveMatchedRelations(UserAccount actor, UUID resourceId) {
        Facts facts = facts(resourceId);
        Set<String> matched = new HashSet<>();
        if (facts == null || actor == null || actor.getId() == null) return matched;
        String me = actor.getId().toString();
        if (me.equals(facts.authorId())) matched.add(RELATION_AUTHOR);
        if (me.equals(facts.submitterId())) matched.add(RELATION_SUBMITTER);
        return matched;
    }

    @Override
    public boolean isWithinObjectScope(UserAccount actor, UUID resourceId, String action) {
        // A report template has no object scope of its own: who may review it is the permission and the relations above.
        return true;
    }

    /** The code of the template whose id this is (there are a few dozen templates, so the ids are compared in memory), or null. */
    private String codeOf(UUID resourceId) {
        if (resourceId == null) return null;
        for (String code : jdbc.queryForList("select code from report_definitions", String.class)) {
            if (idOf(code).equals(resourceId)) return code;
        }
        return null;
    }

    /** Mirrors {@code ReportTemplateService.lockedForReview}, {@code reviewPermissionFor} and {@code requireIndependentReviewer} without a lock and without throwing. */
    Facts facts(UUID resourceId) {
        String code = codeOf(resourceId);
        if (code == null) return null;
        List<Map<String, Object>> rows = jdbc.queryForList(
                "select active, deleted_at, approval_status, submitted_version, submitted_by_user_id, gmp_use from report_definitions where code=?", code);
        if (rows.isEmpty() || rows.getFirst().get("deleted_at") != null) return null;
        Map<String, Object> row = rows.getFirst();
        boolean gmp = Boolean.TRUE.equals(row.get("gmp_use"));
        String state = row.get("approval_status") == null ? null : String.valueOf(row.get("approval_status"));
        String submitter = row.get("submitted_by_user_id") == null ? null : String.valueOf(row.get("submitted_by_user_id"));
        String author = null;

        Map<String, Object> open = revisions == null ? null : revisions.open(code);
        boolean reviewedThroughRevision = revisions != null && revisions.effective(code) != null && open != null && open.get("snapshot") != null;
        if (reviewedThroughRevision) {
            state = open.get("status") == null ? null : String.valueOf(open.get("status"));
            submitter = open.get("submitted_by_user_id") == null ? null : String.valueOf(open.get("submitted_by_user_id"));
            author = open.get("last_changed_by_user_id") == null ? null : String.valueOf(open.get("last_changed_by_user_id"));
        } else if (row.get("submitted_version") != null) {
            List<String> authors = jdbc.queryForList(
                    "select changed_by_user_id::text from report_definition_versions where definition_code=? and version=? order by created_at desc limit 1",
                    String.class, code, ((Number) row.get("submitted_version")).intValue());
            author = authors.isEmpty() ? null : authors.getFirst();
        }
        if (!gmp && reviewedThroughRevision) {
            var payload = revisions.payloadOf(open);
            gmp = payload != null && Boolean.TRUE.equals(payload.get("gmpUse"));
        }
        return new Facts(code, state, gmp, author, submitter);
    }
}
