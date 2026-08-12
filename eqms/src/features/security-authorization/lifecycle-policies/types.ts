/**
 * Values are provided by the policy-metadata API. The client renders those
 * options only; backend enums and persisted workflow policies enforce access.
 */
export type WorkflowActorType = string;

export type WorkflowPolicySource = "DOCUMENT_TYPE_OVERRIDE" | "GLOBAL" | "NOT_CONFIGURED";

export interface WorkflowPolicyWarning {
  code: string;
  message: string;
}

export interface WorkflowActionPolicyActor {
  id?: string;
  actorType: WorkflowActorType;
  actorTypeLabel?: string;
  actorCode?: string | null;
  actorDisplayName?: string | null;
}

export interface WorkflowActionPolicyRelation {
  id: string;
  relationDefinitionId: string;
  relationCode: string;
  relationDisplayName: string;
  resolverCode: string;
  priority: number;
}

export interface WorkflowActionPolicy {
  id: string;
  moduleKey: string;
  moduleLabel?: string;
  workflowKey: string;
  workflowLabel?: string;
  objectType: string;
  actionCode: string;
  actionLabel?: string;
  fromStatus: string;
  fromStatusLabel?: string;
  documentTypeId?: string | null;
  documentTypeName?: string | null;
  requiredPermissionCode: string;
  requiredPermissionName?: string | null;
  priority: number;
  active: boolean;
  system: boolean;
  editable?: boolean;
  resettable?: boolean;
  deactivatable?: boolean;
  description?: string | null;
  warnings?: WorkflowPolicyWarning[];
  actors: WorkflowActionPolicyActor[];
  createdAt?: string;
  updatedAt?: string;
  /** New hybrid-engine relation model -- what ResourceAuthorizationAdapters actually read once a
   * resource type's cutover flag is on, independent of the legacy `actors` list above. */
  relationMatchRule?: string;
  relations?: WorkflowActionPolicyRelation[];
}

export interface WorkflowActionPolicyActorRequest {
  actorType: WorkflowActorType;
  actorCode?: string | null;
}

export interface WorkflowActionPolicyRequest {
  requiredPermissionCode: string;
  priority: number;
  active: boolean;
  description?: string | null;
  documentTypeId?: string | null;
  actors: WorkflowActionPolicyActorRequest[];
  changeReason?: string;
  signatureToken?: string;
}

export interface WorkflowActionPolicyCreateRequest extends WorkflowActionPolicyRequest {
  moduleKey: string;
  workflowKey: string;
  objectType: string;
  actionCode: string;
  fromStatus: string;
}

export interface WorkflowPolicyDiffChange {
  field: string;
  oldValue?: string | null;
  newValue?: string | null;
}

export interface WorkflowActionPolicyPreviewResponse {
  valid: boolean;
  policyId: string;
  changes: WorkflowPolicyDiffChange[];
  warnings: WorkflowPolicyWarning[];
  wouldAffect: {
    moduleKey: string;
    workflowKey: string;
    actionCode: string;
    fromStatus: string;
    documentTypeId?: string | null;
  };
}

export interface WorkflowActionPolicyEffectiveResponse {
  source: WorkflowPolicySource;
  policy: WorkflowActionPolicy | null;
  fallbackUsed: boolean;
}

export interface WorkflowActorTypeOption {
  value: WorkflowActorType;
  label: string;
  requiresActorCode?: boolean;
}

export interface WorkflowActionOption {
  value: string;
  label: string;
  workflowKey?: string;
  objectType?: string;
  allowedActorTypes?: WorkflowActorType[];
  defaultFromStatuses?: string[];
  requiredPermissionCandidates?: string[];
}

export interface WorkflowOption {
  value: string;
  label: string;
  moduleKey: string;
}

export interface PermissionOption {
  code: string;
  name: string;
  moduleKey?: string;
}

export interface DocumentTypeOption {
  id: string;
  name: string;
}

export interface ActorCodeOption {
  value: string;
  label: string;
}

export interface WorkflowActionPolicyOptions {
  modules: string[];
  workflows: string[];
  workflowOptions?: WorkflowOption[];
  objectTypes: string[];
  actions: WorkflowActionOption[];
  actorTypes: WorkflowActorTypeOption[];
  permissions: PermissionOption[];
  documentTypes: DocumentTypeOption[];
  /** Selectable actor codes keyed by actor type. The server owns this metadata. */
  actorCodeOptions?: Record<string, ActorCodeOption[]>;
}

export type PolicyEditorMode = "create" | "edit" | "duplicate" | "override";
