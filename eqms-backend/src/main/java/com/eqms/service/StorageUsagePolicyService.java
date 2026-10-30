package com.eqms.service;

import com.eqms.dto.audittrail.AuditTrailChangeResponse;
import com.eqms.entity.UserAccount;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;

@Service
public class StorageUsagePolicyService {
    public record Policy(Long budgetBytes, int warningPercent) {}
    private final JdbcTemplate jdbc;
    private final AuditTrailService audit;

    public StorageUsagePolicyService(JdbcTemplate jdbc, AuditTrailService audit) {
        this.jdbc = jdbc;
        this.audit = audit;
    }

    @Transactional(readOnly = true)
    public Policy get() {
        return jdbc.queryForObject("SELECT budget_bytes,warning_percent FROM storage_usage_policy WHERE id=true",
                (rs, row) -> new Policy(rs.getObject(1, Long.class), rs.getInt(2)));
    }

    @Transactional
    public Policy save(UserAccount actor, Policy policy) {
        if (policy == null || policy.warningPercent() < 1 || policy.warningPercent() > 100
                || (policy.budgetBytes() != null && policy.budgetBytes() <= 0))
            throw new IllegalArgumentException("Invalid storage budget or warning threshold");
        Policy before = jdbc.queryForObject("SELECT budget_bytes,warning_percent FROM storage_usage_policy WHERE id=true FOR UPDATE",
                (rs, row) -> new Policy(rs.getObject(1, Long.class), rs.getInt(2)));
        if (policy.equals(before)) return before;
        jdbc.update("UPDATE storage_usage_policy SET budget_bytes=?,warning_percent=? WHERE id=true", policy.budgetBytes(), policy.warningPercent());
        audit.logAs(actor, "STORAGE_USAGE_POLICY", "Storage usage policy", null, "STORAGE_USAGE_POLICY_UPDATED",
                null, null, "Storage usage policy updated", List.of(
                        new AuditTrailChangeResponse("Budget bytes", String.valueOf(before.budgetBytes()), String.valueOf(policy.budgetBytes())),
                        new AuditTrailChangeResponse("Warning percent", String.valueOf(before.warningPercent()), String.valueOf(policy.warningPercent()))));
        return policy;
    }
}
