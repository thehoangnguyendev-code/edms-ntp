package com.eqms.enums;

/**
 * Who a lifecycle state policy row applies to. Admin bypass (doc-admin/DCO/superadmin)
 * is structural in code and intentionally not expressible as a policy scope.
 */
public enum LifecycleActorScope {
    ANY,
    AUTHOR,
    PARTICIPANT
}
