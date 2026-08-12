export type RevisionActionCapabilityKey =
  | "preview"
  | "downloadSource"
  | "editOnline"
  | "uploadSource"
  | "replaceSource"
  | "syncToOffice"
  | "syncFromOffice"
  | "completeAuthoring"
  | "updateDraftMetadata"
  | "openPublishingWorkspace"
  | "generateReviewSnapshot"
  | "regenerateSnapshot"
  | "submitForReview"
  | "completeReview"
  | "rejectReview"
  | "completeApproval"
  | "rejectApproval"
  | "completeTraining"
  | "publish"
  | "cancel"
  | "upgradeRevision";

export interface RevisionActionCapabilityDecision {
  allowed: boolean;
  reasonCode?: string | null;
  message?: string | null;
  permissionCode?: string | null;
  requiredPermissionCode?: string | null;
}

export interface RevisionActionCapabilitiesResponse {
  revisionId?: string | null;
  documentId?: string | null;
  revisionStatus?: string | null;
  previewObjectType?: string | null;
  previewStatus?: string | null;
  previewVersionToken?: string | null;
  generatedAt?: string | null;
  actions?: Partial<Record<RevisionActionCapabilityKey, RevisionActionCapabilityDecision>>;
}

export const REVISION_ACTION_CAPABILITY_KEYS: RevisionActionCapabilityKey[] = [
  "preview",
  "downloadSource",
  "editOnline",
  "uploadSource",
  "replaceSource",
  "syncToOffice",
  "syncFromOffice",
  "completeAuthoring",
  "updateDraftMetadata",
  "openPublishingWorkspace",
  "generateReviewSnapshot",
  "regenerateSnapshot",
  "submitForReview",
  "completeReview",
  "rejectReview",
  "completeApproval",
  "rejectApproval",
  "completeTraining",
  "publish",
  "cancel",
  "upgradeRevision",
];

export const getRevisionActionCapabilityDecision = (
  capabilities: RevisionActionCapabilitiesResponse | null | undefined,
  action: RevisionActionCapabilityKey,
) => capabilities?.actions?.[action] ?? null;

export const isRevisionActionAllowed = (
  capabilities: RevisionActionCapabilitiesResponse | null | undefined,
  action: RevisionActionCapabilityKey,
) => getRevisionActionCapabilityDecision(capabilities, action)?.allowed === true;
