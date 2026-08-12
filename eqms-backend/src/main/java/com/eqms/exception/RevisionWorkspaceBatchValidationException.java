package com.eqms.exception;

import java.util.List;

public class RevisionWorkspaceBatchValidationException extends RuntimeException {

    private final List<RevisionWorkspaceValidationIssue> issues;

    public RevisionWorkspaceBatchValidationException(List<RevisionWorkspaceValidationIssue> issues) {
        super("Revision workspace batch validation failed");
        this.issues = issues == null ? List.of() : List.copyOf(issues);
    }

    public List<RevisionWorkspaceValidationIssue> getIssues() {
        return issues;
    }
}
