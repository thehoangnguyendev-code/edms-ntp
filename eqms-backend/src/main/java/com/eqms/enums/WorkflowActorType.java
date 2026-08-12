package com.eqms.enums;

public enum WorkflowActorType {
    AUTHOR,
    CO_AUTHOR,
    OWNER,
    ASSIGNED_REVIEWER,
    ASSIGNED_APPROVER,
    ACCESS_PROFILE,
    /** Immutable permission code stored in the policy actorCode. */
    PERMISSION,
    /** Actor is the current user themself (e.g. own Preferences). */
    SELF,
    /** Actor is assigned a coordinator role on this specific record (e.g. submission/publishing/distribution coordinator). */
    ASSIGNED_COORDINATOR,
    /** Actor created the controlled-copy request/batch. */
    REQUESTER,
    /** Actor/email is the recipient of a controlled-copy record. */
    RECIPIENT,
    /** Actor holds Department-scoped visibility via Access Profile/Object Rule. */
    DEPARTMENT_SCOPE,
    /** Actor holds Business-Unit-scoped visibility via Access Profile/Object Rule. */
    BUSINESS_UNIT_SCOPE,
    /** Global scope, granted only via profile and audited. */
    ALL_RECORDS,
    /** Object-level explicit Allow or Deny exception. */
    EXPLICIT_GRANT
}
