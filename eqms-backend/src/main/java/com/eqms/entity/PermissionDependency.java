package com.eqms.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

/**
 * Phase 1 (Permission Catalog only) dependency reference row -- see
 * PERMISSION_DEPENDENCY_MATRIX_REVIEW_DRAFT.md. Deliberately NOT consulted by
 * PermissionSetService/Access Profile save paths yet; that enforcement is Phase 2.
 */
@Entity
@Table(name = "permission_dependencies")
public class PermissionDependency {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "permission_code", nullable = false, length = 80)
    private String permissionCode;

    @Column(name = "depends_on_code", length = 80)
    private String dependsOnCode;

    @Column(name = "relation_type", nullable = false, length = 30)
    private String relationType;

    @Column(name = "status", nullable = false, length = 30)
    private String status;

    @Column(name = "rule_id", nullable = false, length = 20)
    private String ruleId;

    @Column(name = "rationale", length = 500)
    private String rationale;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    public UUID getId() {
        return id;
    }

    public String getPermissionCode() {
        return permissionCode;
    }

    public void setPermissionCode(String permissionCode) {
        this.permissionCode = permissionCode;
    }

    public String getDependsOnCode() {
        return dependsOnCode;
    }

    public void setDependsOnCode(String dependsOnCode) {
        this.dependsOnCode = dependsOnCode;
    }

    public String getRelationType() {
        return relationType;
    }

    public void setRelationType(String relationType) {
        this.relationType = relationType;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getRuleId() {
        return ruleId;
    }

    public void setRuleId(String ruleId) {
        this.ruleId = ruleId;
    }

    public String getRationale() {
        return rationale;
    }

    public void setRationale(String rationale) {
        this.rationale = rationale;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }
}
