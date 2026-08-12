import { api } from "./client";

/**
 * Reduced user shape returned by /security/eligible-users — matches
 * com.eqms.dto.security.EligibleUserResponse on the backend.
 */
export interface EligibleUser {
  id: string;
  employeeCode?: string | null;
  fullName: string;
  position?: string | null;
  email: string;
  department: string;
}

/**
 * Module-neutral action decision returned by the Authorization Platform.
 * New screens should use this contract instead of deriving button visibility from permissions.
 */
export interface ResourceActionCapability {
  allowed: boolean;
  reasonCode: string | null;
  reasonMessage: string | null;
  requiredPermissionCode: string | null;
  requiresESignature: boolean;
}

export interface ResourceCapabilities {
  resourceType: string;
  resourceId: string;
  state: string | null;
  generatedAt: string;
  actions: Record<string, ResourceActionCapability>;
}

export interface EligibleParticipant {
  userId: string;
  fullName: string;
  employeeCode?: string | null;
  department: string | null;
  participantType: string;
}

export interface PagedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface EffectiveAccessDiagnosisLayer {
  layerCode: string;
  passed: boolean;
  reasonCode: string | null;
  message: string | null;
}

export interface EffectiveAccessDiagnosis {
  subjectUserId: string;
  resourceType: string;
  resourceId: string;
  actionCode: string;
  state: string | null;
  allowed: boolean;
  reasonCode: string | null;
  reasonMessage: string | null;
  requiredPermissionCode: string | null;
  systemSuperAdmin: boolean;
  requiresESignature: boolean;
  layers: EffectiveAccessDiagnosisLayer[];
}

export interface AuthorizationShadowMismatch {
  id: string;
  resourceType: string;
  resourceId: string;
  actionCode: string;
  subjectUserId: string;
  policyAllowed: boolean;
  policyReasonCode: string | null;
  legacyAllowed: boolean;
  legacyReasonCode: string | null;
  createdAt: string;
}

export interface AuthorizationRelationDefinition {
  id: string;
  code: string;
  displayName: string;
  resourceType: string;
  resolverCode: string;
  resolverConfig: Record<string, unknown> | null;
  description: string | null;
  active: boolean;
  updatedAt: string;
}

export interface AuthorizationEvaluateRequestPayload {
  subjectUserId: string;
  resourceType: string;
  resourceId: string;
  actionCode: string;
}

/** Mirrors com.eqms.service.authorization.AuthorizationDecision. */
export interface AuthorizationEngineDecision {
  allowed: boolean;
  reasonCode: string | null;
  requiredPermission: string | null;
  resolvedScopes: string[];
  matchedRelations: string[];
  matchedPolicyVersion: number | null;
  resourceState: string | null;
  requiredControls: Record<string, unknown>;
}

export interface ParticipantReconciliationMismatch {
  discrepancyType: string;
  resourceId: string;
  participantType: string;
  userId: string;
  sequenceOrder: number;
  legacyActionStatus: string | null;
  genericActionStatus: string | null;
}

/**
 * Shared security-authorization API surface, usable by any module (Documents, CAPA,
 * Deviations, ...) — not specific to Documents. Add cross-module security/authorization
 * lookups here instead of duplicating them per feature.
 */
export const securityApi = {
  /**
   * GET /authorization/resources/{resourceType}/{resourceId}/capabilities.
   * Additive shared capability contract; resource-specific APIs remain available during migration.
   */
  getResourceCapabilities: async (
    resourceType: string,
    resourceId: string,
  ): Promise<ResourceCapabilities> => {
    const response = await api.get<ResourceCapabilities>(
      `/authorization/resources/${encodeURIComponent(resourceType)}/${encodeURIComponent(resourceId)}/capabilities`,
    );
    return response.data;
  },

  getEligibleParticipants: async (
    resourceType: string,
    resourceId: string,
    participantType: string,
    search?: string,
    page = 1,
    limit = 20,
  ): Promise<PagedResponse<EligibleParticipant>> => {
    const response = await api.get<PagedResponse<EligibleParticipant>>(
      `/authorization/resources/${encodeURIComponent(resourceType)}/${encodeURIComponent(resourceId)}/eligible-users`,
      { params: { participantType, search, page, limit } },
    );
    return response.data;
  },

  /** Security Admin-only, evidence-oriented explanation of a real resource decision. */
  diagnoseEffectiveAccess: async (payload: {
    subjectUserId: string;
    resourceType: string;
    resourceId: string;
    actionCode: string;
  }): Promise<EffectiveAccessDiagnosis> => {
    const response = await api.post<EffectiveAccessDiagnosis>(
      "/security/effective-access/diagnose",
      payload,
    );
    return response.data;
  },

  /**
   * POST /authorization/evaluate — admin simulator, runs AuthorizationEngineService without
   * executing any mutation. Gated server-side by security.access_profiles.update.
   */
  evaluateAuthorization: async (
    payload: AuthorizationEvaluateRequestPayload,
  ): Promise<AuthorizationEngineDecision> => {
    const response = await api.post<AuthorizationEngineDecision>(
      "/authorization/evaluate",
      payload,
    );
    return response.data;
  },

  /** GET /authorization/relation-definitions?resourceType=... — read-only relation catalog. */
  getAuthorizationRelationDefinitions: async (
    resourceType?: string,
  ): Promise<AuthorizationRelationDefinition[]> => {
    const response = await api.get<AuthorizationRelationDefinition[]>(
      "/authorization/relation-definitions",
      {
        params: resourceType ? { resourceType } : undefined,
      },
    );
    return response.data;
  },

  /** Server-side filter/sort/pagination variant of the relation catalog, for the Relation Definitions tab. */
  getAuthorizationRelationDefinitionsPaged: async (params: {
    page: number;
    limit: number;
    search?: string;
    resourceType?: string;
    status?: string;
    updatedFrom?: string;
    updatedTo?: string;
    sortBy?: string;
    sortDir?: string;
  }): Promise<{
    data: AuthorizationRelationDefinition[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> => {
    const response = await api.get<{
      data: AuthorizationRelationDefinition[];
      pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
      };
    }>("/authorization/relation-definitions/paged", { params });
    return response.data;
  },

  getAuthorizationShadowMismatches: async (
    limit = 50,
  ): Promise<AuthorizationShadowMismatch[]> => {
    const response = await api.get<AuthorizationShadowMismatch[]>(
      "/security/authorization-shadow-mismatches",
      {
        params: { limit },
      },
    );
    return response.data;
  },

  /** Per-resource-type totals for the Engine Health summary cards. */
  getAuthorizationShadowMismatchSummary: async (): Promise<
    { resourceType: string; total: number; mismatches: number }[]
  > => {
    const response = await api.get<
      { resourceType: string; total: number; mismatches: number }[]
    >("/security/authorization-shadow-mismatches/summary");
    return response.data;
  },

  /** Server-side filter/search/sort/pagination for the Engine Health table. */
  getAuthorizationShadowMismatchesPaged: async (params: {
    page: number;
    limit: number;
    search?: string;
    resourceType?: string;
    mismatchesOnly: boolean;
    sortBy?: string;
    sortDir?: string;
  }): Promise<{
    data: AuthorizationShadowMismatch[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> => {
    const response = await api.get<{
      data: AuthorizationShadowMismatch[];
      pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
      };
    }>("/security/authorization-shadow-mismatches/paged", { params });
    return response.data;
  },

  getParticipantReconciliationMismatches: async (
    limit = 50,
  ): Promise<ParticipantReconciliationMismatch[]> => {
    const response = await api.get<ParticipantReconciliationMismatch[]>(
      "/security/participant-reconciliation",
      {
        params: { limit },
      },
    );
    return response.data;
  },

  /**
   * GET /security/eligible-users?permissionCode=...
   * Returns active users who currently hold the given permission code (via Access Profile
   * or legacy role fallback — resolved server-side). Does not filter by document type or
   * any object-level scoping; that belongs to Object Access Rules elsewhere.
   */
  getEligibleUsers: async (
    permissionCode: string,
    search?: string,
  ): Promise<EligibleUser[]> => {
    const response = await api.get<EligibleUser[]>("/security/eligible-users", {
      params: { permissionCode, search },
    });
    return response.data;
  },

  /**
   * GET /security/access-profiles/{id}/effective-access?documentTypeId=...
   * Read-only diagnostic (EffectiveAccessPanel): for every Document Revision workflow action
   * and Document Master lifecycle capability (Cancel/Obsolete), resolves Allow/Deny per status
   * by calling the 3 real runtime evaluators server-side. Matches
   * com.eqms.dto.security.EffectiveAccessResponse on the backend.
   */
  getEffectiveAccess: async (
    accessProfileId: string,
    documentTypeId?: string,
  ): Promise<EffectiveAccessResponse> => {
    const response = await api.get<EffectiveAccessResponse>(
      `/security/access-profiles/${accessProfileId}/effective-access`,
      { params: documentTypeId ? { documentTypeId } : undefined },
    );
    return response.data;
  },
};

export interface EffectiveAccessRow {
  moduleKey: string;
  actionCode: string;
  actionLabel: string;
  requiredPermissionCode: string | null;
  objectType: "DOCUMENT" | "DOCUMENT_REVISION";
  statusCode: string;
  statusLabel: string;
  allowed: boolean;
  reasonCode:
    | "MISSING_PERMISSION"
    | "ACTOR_SCOPE_NOT_SATISFIED"
    | "OBJECT_ACCESS_DENIED"
    | "NO_MATCHING_POLICY"
    | null;
  message: string | null;
  objectAccessRuleEvaluated: boolean;
}

export interface EffectiveAccessResponse {
  accessProfileId: string;
  accessProfileName: string;
  documentTypeId: string | null;
  objectAccessRulesApplicable: boolean;
  objectAccessRulesNote: string;
  rows: EffectiveAccessRow[];
}
