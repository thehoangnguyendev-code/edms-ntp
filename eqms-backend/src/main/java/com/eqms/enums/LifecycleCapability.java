package com.eqms.enums;

/**
 * Capabilities governed by lifecycle state policies (additive ALLOW-only, ANY-actor-scope model).
 * OBSOLETE/CANCEL are DOCUMENT-master-level transitions modeled here (not in
 * WorkflowActionPolicy/RevisionWorkflowAuthorizationService) because the master document has
 * no workflow participants — its transitions only ever need permission + optional document-type
 * scoping, which this simpler evaluator already provides.
 */
public enum LifecycleCapability {
    VIEW,
    PREVIEW,
    DOWNLOAD_SOURCE,
    DOWNLOAD_PUBLISHED,
    EDIT_METADATA,
    OBSOLETE,
    CANCEL
}
