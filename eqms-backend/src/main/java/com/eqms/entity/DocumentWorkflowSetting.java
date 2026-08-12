package com.eqms.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "document_workflow_settings")
public class DocumentWorkflowSetting {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "reviewer_no_approve", nullable = false)
    private boolean reviewerNoApprove = false;

    @Column(name = "require_two_reviewers", nullable = false)
    private boolean requireTwoReviewers = false;

    @Column(name = "require_one_approver", nullable = false)
    private boolean requireOneApprover = true;

    @Column(name = "author_cannot_be_reviewer_or_approver", nullable = false)
    private boolean authorCannotBeReviewerOrApprover = false;

    @Column(name = "co_author_cannot_be_reviewer_or_approver", nullable = false)
    private boolean coAuthorCannotBeReviewerOrApprover = false;

    @Column(name = "same_user_cannot_hold_multiple_workflow_roles", nullable = false)
    private boolean sameUserCannotHoldMultipleWorkflowRoles = false;

    @Column(name = "workflow_coordinator_cannot_be_reviewer_or_approver", nullable = false)
    private boolean dcoCannotBeReviewerOrApprover = false;

    @Column(name = "reviewer_and_approver_different_departments", nullable = false)
    private boolean reviewerAndApproverDifferentDepartments = false;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Column(name = "version", nullable = false)
    private long version = 0L;

    @PrePersist
    void onCreate() {
        Instant now = Instant.now();
        if (createdAt == null) {
            createdAt = now;
        }
        if (updatedAt == null) {
            updatedAt = now;
        }
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = Instant.now();
    }

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public boolean isReviewerNoApprove() {
        return reviewerNoApprove;
    }

    public void setReviewerNoApprove(boolean reviewerNoApprove) {
        this.reviewerNoApprove = reviewerNoApprove;
    }

    public boolean isRequireTwoReviewers() {
        return requireTwoReviewers;
    }

    public void setRequireTwoReviewers(boolean requireTwoReviewers) {
        this.requireTwoReviewers = requireTwoReviewers;
    }

    public boolean isRequireOneApprover() {
        return requireOneApprover;
    }

    public void setRequireOneApprover(boolean requireOneApprover) {
        this.requireOneApprover = requireOneApprover;
    }

    public boolean isAuthorCannotBeReviewerOrApprover() {
        return authorCannotBeReviewerOrApprover;
    }

    public void setAuthorCannotBeReviewerOrApprover(boolean authorCannotBeReviewerOrApprover) {
        this.authorCannotBeReviewerOrApprover = authorCannotBeReviewerOrApprover;
    }

    public boolean isCoAuthorCannotBeReviewerOrApprover() {
        return coAuthorCannotBeReviewerOrApprover;
    }

    public void setCoAuthorCannotBeReviewerOrApprover(boolean coAuthorCannotBeReviewerOrApprover) {
        this.coAuthorCannotBeReviewerOrApprover = coAuthorCannotBeReviewerOrApprover;
    }

    public boolean isSameUserCannotHoldMultipleWorkflowRoles() {
        return sameUserCannotHoldMultipleWorkflowRoles;
    }

    public void setSameUserCannotHoldMultipleWorkflowRoles(boolean sameUserCannotHoldMultipleWorkflowRoles) {
        this.sameUserCannotHoldMultipleWorkflowRoles = sameUserCannotHoldMultipleWorkflowRoles;
    }

    public boolean isDcoCannotBeReviewerOrApprover() {
        return dcoCannotBeReviewerOrApprover;
    }

    public void setDcoCannotBeReviewerOrApprover(boolean dcoCannotBeReviewerOrApprover) {
        this.dcoCannotBeReviewerOrApprover = dcoCannotBeReviewerOrApprover;
    }

    public boolean isWorkflowCoordinatorCannotBeReviewerOrApprover() {
        return dcoCannotBeReviewerOrApprover;
    }

    public void setWorkflowCoordinatorCannotBeReviewerOrApprover(boolean workflowCoordinatorCannotBeReviewerOrApprover) {
        this.dcoCannotBeReviewerOrApprover = workflowCoordinatorCannotBeReviewerOrApprover;
    }

    public long getVersion() {
        return version;
    }

    public void setVersion(long version) {
        this.version = version;
    }

    public boolean isReviewerAndApproverDifferentDepartments() {
        return reviewerAndApproverDifferentDepartments;
    }

    public void setReviewerAndApproverDifferentDepartments(boolean reviewerAndApproverDifferentDepartments) {
        this.reviewerAndApproverDifferentDepartments = reviewerAndApproverDifferentDepartments;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(Instant updatedAt) {
        this.updatedAt = updatedAt;
    }
}
