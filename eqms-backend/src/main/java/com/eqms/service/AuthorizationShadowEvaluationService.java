package com.eqms.service;

import com.eqms.dto.security.AuthorizationShadowMismatchResponse;
import com.eqms.entity.UserAccount;
import com.eqms.service.authorization.AuthorizationDecision;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.util.Objects;
import java.util.UUID;
import java.util.List;

/**
 * Persistent, non-enforcing evidence for the policy rollout gate
 * (SECURITY_AUTHORIZATION_HYBRID_REFACTOR_PLAN.md §7, Phase 0 step 7). {@code recordMismatch} is
 * the generic entry point every module's shadow-evaluation call site uses.
 *
 * <p>REVISION completed its cutover and had its legacy comparison path removed entirely (see
 * {@link RevisionWorkflowAuthorizationService}) -- its historical rows here are a frozen snapshot,
 * not live traffic. {@link #CUTOVER_COMPLETE_RESOURCE_TYPES} is what the Engine Health summary uses
 * to avoid presenting that as if it were still under active shadow monitoring; update it if another
 * resource type's legacy path is ever fully removed the same way.
 */
@Service
public class AuthorizationShadowEvaluationService {

    /** Resource types whose legacy evaluator has been physically deleted (not flag-gated) --
     * shadow-evaluation rows for these are permanent historical evidence and will never grow. */
    private static final java.util.Set<String> CUTOVER_COMPLETE_RESOURCE_TYPES = java.util.Set.of("REVISION");

    private final JdbcTemplate jdbc;

    public AuthorizationShadowEvaluationService(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    /**
     * Generic shadow-evaluation record for any resource type registered with
     * {@code AuthorizationEngineService}. Only writes a row when the new engine's decision
     * actually disagrees with the legacy evaluator's -- agreement is not logged, keeping the
     * table to actionable mismatches only.
     */
    /**
     * REQUIRES_NEW so this write never inherits the caller's transaction -- many call sites
     * (e.g. capability lookups for a document/revision detail page) run inside a read-only
     * transaction, and a plain participating write there aborts the whole surrounding
     * transaction with "cannot execute INSERT in a read-only transaction", which then poisons
     * every subsequent statement in that transaction, not just this one.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void recordMismatch(
            UserAccount user, String resourceType, UUID resourceId, String actionCode,
            AuthorizationDecision policyDecision, boolean legacyAllowed, String legacyReasonCode
    ) {
        if (user == null || user.getId() == null || resourceType == null || resourceId == null
                || actionCode == null || policyDecision == null
                || (policyDecision.allowed() == legacyAllowed
                        && Objects.equals(policyDecision.reasonCode(), legacyReasonCode))) {
            return;
        }
        jdbc.update("""
                insert into authorization_shadow_evaluation_events(
                    resource_type, resource_id, action_code, subject_user_id,
                    policy_allowed, policy_reason_code, legacy_allowed, legacy_reason_code
                ) values (?, ?, ?, ?, ?, ?, ?, ?)
                """, resourceType, resourceId, actionCode, user.getId(),
                policyDecision.allowed(), policyDecision.reasonCode(), legacyAllowed, legacyReasonCode);
    }

    public List<AuthorizationShadowMismatchResponse> recentMismatches(int limit) {
        int safeLimit = Math.max(1, Math.min(limit, 500));
        return jdbc.query("""
                select id, resource_type, resource_id, action_code, subject_user_id,
                       policy_allowed, policy_reason_code, legacy_allowed, legacy_reason_code, created_at
                from authorization_shadow_evaluation_events
                order by created_at desc limit ?
                """, (rs, row) -> new AuthorizationShadowMismatchResponse(
                UUID.fromString(rs.getString("id")), rs.getString("resource_type"),
                UUID.fromString(rs.getString("resource_id")), rs.getString("action_code"),
                UUID.fromString(rs.getString("subject_user_id")), rs.getBoolean("policy_allowed"),
                rs.getString("policy_reason_code"), rs.getBoolean("legacy_allowed"),
                rs.getString("legacy_reason_code"), rs.getTimestamp("created_at").toInstant()), safeLimit);
    }

    /** Per-resource-type totals for the Engine Health summary cards, independent of the table's
     * current page/filter. */
    public List<com.eqms.dto.security.AuthorizationShadowMismatchSummaryResponse> summaryByResourceType() {
        return jdbc.query("""
                select resource_type,
                       count(*) as total,
                       sum(case when policy_allowed <> legacy_allowed then 1 else 0 end) as mismatches
                from authorization_shadow_evaluation_events
                group by resource_type
                order by resource_type
                """, (rs, row) -> {
            String resourceType = rs.getString("resource_type");
            return new com.eqms.dto.security.AuthorizationShadowMismatchSummaryResponse(
                    resourceType, rs.getLong("total"), rs.getLong("mismatches"),
                    CUTOVER_COMPLETE_RESOURCE_TYPES.contains(resourceType));
        });
    }

    /** Server-side filter/search/sort/pagination for the Engine Health table. */
    public com.eqms.dto.user.PageResponse<AuthorizationShadowMismatchResponse> pagedMismatches(
            int page, int limit, String resourceType, boolean mismatchesOnly, String search, String sortBy, String sortDir
    ) {
        int safePage = Math.max(page, 1);
        int safeLimit = Math.max(1, Math.min(limit, 200));

        StringBuilder where = new StringBuilder(" where 1=1 ");
        List<Object> args = new java.util.ArrayList<>();
        if (resourceType != null && !resourceType.isBlank()) {
            where.append(" and resource_type = ? ");
            args.add(resourceType);
        }
        if (mismatchesOnly) {
            where.append(" and policy_allowed <> legacy_allowed ");
        }
        if (search != null && !search.isBlank()) {
            where.append(" and (action_code ilike ? or resource_id::text ilike ? or resource_type ilike ?) ");
            String needle = "%" + search.trim() + "%";
            args.add(needle);
            args.add(needle);
            args.add(needle);
        }

        Long total = jdbc.queryForObject(
                "select count(*) from authorization_shadow_evaluation_events" + where, Long.class, args.toArray());
        long safeTotal = total == null ? 0 : total;

        String orderDir = "asc".equalsIgnoreCase(sortDir) ? "asc" : "desc";
        String orderBy = switch (sortBy == null ? "createdat" : sortBy.trim().toLowerCase(java.util.Locale.ROOT)) {
            case "resource", "resourcetype" -> "resource_type " + orderDir + ", resource_id " + orderDir;
            case "action", "actioncode" -> "action_code " + orderDir;
            case "policyallowed", "newengine" -> "policy_allowed " + orderDir;
            case "legacyallowed", "legacy" -> "legacy_allowed " + orderDir;
            default -> "created_at " + orderDir;
        };
        List<Object> pagedArgs = new java.util.ArrayList<>(args);
        pagedArgs.add(safeLimit);
        pagedArgs.add((safePage - 1) * safeLimit);
        List<AuthorizationShadowMismatchResponse> rows = jdbc.query(
                """
                select id, resource_type, resource_id, action_code, subject_user_id,
                       policy_allowed, policy_reason_code, legacy_allowed, legacy_reason_code, created_at
                from authorization_shadow_evaluation_events
                """ + where + " order by " + orderBy + ", id asc limit ? offset ?",
                (rs, row) -> new AuthorizationShadowMismatchResponse(
                        UUID.fromString(rs.getString("id")), rs.getString("resource_type"),
                        UUID.fromString(rs.getString("resource_id")), rs.getString("action_code"),
                        UUID.fromString(rs.getString("subject_user_id")), rs.getBoolean("policy_allowed"),
                        rs.getString("policy_reason_code"), rs.getBoolean("legacy_allowed"),
                        rs.getString("legacy_reason_code"), rs.getTimestamp("created_at").toInstant()),
                pagedArgs.toArray());

        int totalPages = Math.max(1, (int) Math.ceil((double) safeTotal / safeLimit));
        return new com.eqms.dto.user.PageResponse<>(
                rows, new com.eqms.dto.user.PaginationResponse(safePage, safeLimit, safeTotal, totalPages));
    }
}
