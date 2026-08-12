package com.eqms.service;

import com.eqms.dto.security.ParticipantReconciliationMismatchResponse;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.UUID;

/** Read-only gate evidence for the generic workflow participant rollout. */
@Service
public class AuthorizationParticipantReconciliationService {
    private final JdbcTemplate jdbc;
    public AuthorizationParticipantReconciliationService(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    public List<ParticipantReconciliationMismatchResponse> list(int limit) {
        int safeLimit = Math.max(1, Math.min(limit, 500));
        return jdbc.query("""
                select discrepancy_type, resource_id, participant_type, user_id, sequence_order,
                       legacy_action_status, generic_action_status
                from authorization_participant_reconciliation
                order by discrepancy_type, resource_id, participant_type, sequence_order
                limit ?
                """, (rs, row) -> new ParticipantReconciliationMismatchResponse(
                rs.getString("discrepancy_type"), UUID.fromString(rs.getString("resource_id")),
                rs.getString("participant_type"), UUID.fromString(rs.getString("user_id")),
                rs.getInt("sequence_order"), rs.getString("legacy_action_status"),
                rs.getString("generic_action_status")), safeLimit);
    }
}
