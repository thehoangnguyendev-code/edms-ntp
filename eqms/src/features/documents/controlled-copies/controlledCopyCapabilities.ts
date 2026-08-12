export type ControlledCopyActionCode =
  | "requestCopy"
  | "distributeBatch"
  | "distributeCopy"
  | "viewCopy"
  | "previewFile"
  | "downloadFile"
  | "recallBatch"
  | "recallCopy"
  | "reportLostDamaged"
  | "replaceLostDamaged"
  | "uploadEvidence"
  | "expireCopy"
  | "cancelRequest"
  | "cancelBatch";

export interface ControlledCopyActionDecision {
  allowed: boolean;
  reasonCode?: string | null;
  message?: string | null;
  permissionCode?: string | null;
  requiredPermissionCode?: string | null;
  actionCode?: ControlledCopyActionCode | string | null;
  objectType?: "CONTROLLED_COPY" | "CONTROLLED_COPY_BATCH" | string | null;
  status?: string | null;
}

export interface ControlledCopyActionCapabilities {
  controlledCopyId?: string | null;
  batchId?: string | null;
  revisionId?: string | null;
  documentId?: string | null;
  copyStatus?: string | null;
  batchStatus?: string | null;
  previewObjectType?: string | null;
  previewStatus?: string | null;
  previewVersionToken?: string | null;
  generatedAt?: string | null;
  actions: Partial<Record<ControlledCopyActionCode, ControlledCopyActionDecision>>;
}

export const emptyControlledCopyDecision: ControlledCopyActionDecision = {
  allowed: false,
  reasonCode: "CAPABILITY_NOT_LOADED",
  message: "Capability information is still loading.",
};

export const getControlledCopyActionDecision = (
  capabilities: ControlledCopyActionCapabilities | null | undefined,
  action: ControlledCopyActionCode,
): ControlledCopyActionDecision | null => capabilities?.actions?.[action] ?? null;

export const isControlledCopyActionAllowed = (
  capabilities: ControlledCopyActionCapabilities | null | undefined,
  action: ControlledCopyActionCode,
) => getControlledCopyActionDecision(capabilities, action)?.allowed === true;

export const getControlledCopyActionDeniedReason = (
  decision?: ControlledCopyActionDecision | null,
): string => {
  if (!decision) {
    return emptyControlledCopyDecision.message || "Capability information is still loading.";
  }

  if (decision.allowed) {
    return "";
  }

  const reasonCode = decision.reasonCode || "";
  const backendMessage = decision.message?.trim();
  if (backendMessage) {
    return backendMessage;
  }

  const fallbackMessages: Record<string, string> = {
    AUTH_REQUIRED: "Please sign in to perform this action.",
    USER_INACTIVE: "Your account is inactive.",
    BASE_ACCESS_DENIED: "You do not have access to this controlled copy.",
    MISSING_PERMISSION: "You do not have the required permission for this action.",
    ACTOR_NOT_ALLOWED: "You are not assigned to perform this action.",
    INVALID_CONTROLLED_COPY_STATE: "This action is not available in the current controlled copy state.",
    INVALID_BATCH_STATE: "This action is not available in the current batch state.",
    REVISION_NOT_EFFECTIVE: "Controlled copies can only be requested from an effective revision.",
    DOCUMENT_NOT_ACTIVE: "The parent document is not active.",
    EXPIRED: "This controlled copy has expired.",
    RECALLED: "This controlled copy has been recalled.",
    LOST_DAMAGED: "This controlled copy is marked as lost or damaged.",
    DESTROYED: "This controlled copy has been destroyed.",
    CANCELLED: "This controlled copy request was cancelled.",
    REJECTED: "This controlled copy request was rejected.",
    DOWNLOAD_NOT_ALLOWED_BY_POLICY: "Download is not allowed for this controlled copy.",
    MANUAL_RECALL_DISABLED_BY_POLICY: "Manual recall is disabled by the Controlled Copies Policy.",
    REPORT_LOST_DAMAGED_DISABLED_BY_POLICY: "Reporting lost or damaged copies is disabled by the Controlled Copies Policy.",
    REPLACEMENT_DISABLED_BY_POLICY: "Replacement for lost/damaged copies is disabled by the Controlled Copies Policy.",
    FILE_NOT_FOUND: "The controlled copy file is not available.",
    NOT_COPY_RECIPIENT: "You are not the recipient of this controlled copy.",
    REQUESTER_CANNOT_APPROVE_OWN_REQUEST: "Requesters cannot approve their own controlled copy request.",
    WORKFLOW_POLICY_MISCONFIGURED: "Controlled Copy authorization policy is misconfigured. Contact an administrator.",
    CAPABILITY_NOT_LOADED: "Capability information is still loading.",
  };

  return fallbackMessages[reasonCode] || backendMessage || "You are not allowed to perform this action.";
};

export const getControlledCopyActionTooltip = (
  capabilities: ControlledCopyActionCapabilities | null | undefined,
  action: ControlledCopyActionCode,
  loading = false,
): string => {
  if (loading) {
    return "Capability information is still loading.";
  }
  const decision = getControlledCopyActionDecision(capabilities, action);
  if (decision?.allowed) {
    return "";
  }
  return getControlledCopyActionDeniedReason(decision);
};
