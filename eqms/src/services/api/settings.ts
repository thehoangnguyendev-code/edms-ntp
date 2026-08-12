import { api } from './client';
import type {
  User,
  CreateUserPayload,
  SuspendUserPayload,
  TerminateUserPayload,
  ResetPasswordPayload,
  ForceLogoutPayload,
} from '@/features/security-authorization/user-management/types';
import type { PaginatedResponse } from '@/types';

// ─── Security & Authorization types ──────────────────────────────────────────

export interface SecuritySignaturePayload {
  signatureToken: string;
  reason?: string;
}

export interface PermissionSetAssignedAccessProfile {
  id: string;
  name: string;
  code: string;
  businessUnitScope: string | null;
  departmentScope: string | null;
  active: boolean;
  userCount: number;
}

export interface PermissionSetResponse {
  id: string;
  name: string;
  code: string;
  description: string | null;
  active: boolean;
  system: boolean;
  permissionCount: number;
  permissionCodes: string[];
  /** Server-computed module coverage + derived category. */
  modules: string[];
  category: string;
  createdAt: string;
  updatedAt: string;
}
export interface PermissionSetPayload {
  name: string;
  code?: string;
  description?: string;
  active: boolean;
  permissionCodes: string[];
}

export interface PermissionSetActionCapability {
  allowed: boolean;
  reason: string | null;
  requiredPermission: string | null;
}

export interface PermissionSetCapabilitiesResponse {
  permissionSetId: string;
  actions: Record<string, PermissionSetActionCapability>;
}

export interface UserActionCapability {
  allowed: boolean;
  reason: string | null;
  requiredPermission: string | null;
}

export interface UserActionCapabilitiesResponse {
  userId: string;
  actions: Record<string, UserActionCapability>;
}

export interface UserAuthorizationSummary {
  userId: string;
  effectivePermissionCount: number;
  accessProfiles: {
    id: string;
    code: string;
    name: string;
    active: boolean;
    businessUnitScope: string | null;
    departmentScope: string | null;
    workflowRoles: string[];
    permissionSets: { id: string; code: string; name: string; active: boolean; permissionCount: number }[];
  }[];
}

export interface ObjectAccessRuleResponse {
  id: string;
  name: string;
  description: string | null;
  accessProfileId: string | null;
  accessProfileName: string | null;
  resourceType: 'DOCUMENT_CATEGORY' | 'DOCUMENT_TYPE' | 'DOCUMENT_STATUS';
  resourceId: string | null;
  resourceName: string | null;
  actions: string[];
  effect: 'ALLOW' | 'DENY';
  priority: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}
export interface ObjectAccessRuleOptionsResponse {
  resourceTypes: string[];
  actions: string[];
  effects: string[];
  /** Selectable resource names per resource type — pickers instead of typed names. */
  resourceValues?: Record<string, string[]>;
  accessProfiles: { id: string; name: string; code: string }[];
}

export interface ExternalIdentityProvisioningResponse {
  userId: string;
  email: string;
  provider: string;
  tenantId: string | null;
  invitationId: string | null;
  status: 'NOT_INVITED' | 'NOT_LINKED' | 'INVITE_PENDING' | 'INVITED' | 'REDEEMED' | 'FAILED' | 'DISABLE_PENDING' | 'DISABLED' | 'REMOVE_PENDING' | 'REMOVED' | string;
  statusLabel: string;
  statusColor: string;
  invitedAt: string | null;
  redeemedAt: string | null;
  disabledAt: string | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  attemptCount: number;
}
export interface ObjectAccessRulePayload {
  name: string;
  description?: string;
  accessProfileId?: string | null;
  resourceType: string;
  resourceId?: string | null;
  resourceName?: string | null;
  actions: string[];
  effect: 'ALLOW' | 'DENY';
  priority: number;
  active: boolean;
}

export interface SodConstraintResponse {
  id: string;
  name: string;
  description: string | null;
  permissionCodeA: string;
  permissionCodeB: string;
  permissionNameA: string;
  permissionNameB: string;
  severity: 'WARN' | 'BLOCK';
  regulationRef: string | null;
  active: boolean;
  system: boolean;
  createdAt: string;
  updatedAt: string;
}
export interface SodConstraintPayload {
  name: string;
  description?: string;
  permissionCodeA: string;
  permissionCodeB: string;
  severity: 'WARN' | 'BLOCK';
  regulationRef?: string;
  active: boolean;
}
export interface SodViolationResponse {
  constraintId: string;
  constraintName: string;
  severity: 'WARN' | 'BLOCK';
  permissionCodeA: string;
  permissionCodeB: string;
  regulationRef: string | null;
  violatingAccessProfiles: {
    accessProfileId: string;
    accessProfileName: string;
    accessProfileCode: string;
  }[];
}

export interface SodProfileCombinationViolationResponse {
  constraintId: string;
  constraintName: string;
  severity: 'WARN' | 'BLOCK';
  permissionCodeA: string;
  permissionNameA: string;
  permissionCodeB: string;
  permissionNameB: string;
  regulationRef: string | null;
  contributingProfilesA: { accessProfileId: string; accessProfileName: string; accessProfileCode: string }[];
  contributingProfilesB: { accessProfileId: string; accessProfileName: string; accessProfileCode: string }[];
}

const ENDPOINT = '/settings/users';
const pendingGetUsersRequests = new Map<string, Promise<PaginatedResponse<User>>>();
const pendingGetSystemConfigurationRequests = new Map<string, Promise<{
  general: Record<string, any>;
  security: Record<string, any>;
  documents: Record<string, any>;
  notifications: Record<string, any>;
  integrations: Record<string, any>;
  features: Record<string, any>[];
}>>();
const pendingGetSecurityConfigurationRequests = new Map<string, Promise<{ sessionTimeoutMinutes: number }>>();
export type DocumentAdministrationRule = {
  code: string;
  label: string;
  description: string;
  enabled: boolean;
};

// ─── Access Profile types ─────────────────────────────────────────────────────

export interface AccessProfileResponse {
  id: string;
  code: string;
  name: string;
  description: string | null;
  type: 'SYSTEM' | 'CUSTOM';
  active: boolean;
  system: boolean;
  businessUnitScope: string | null;
  departmentScope: string | null;
  permissionSetCount: number;
  workflowRoleCount: number;
  assignedUserCount: number;
  workflowRoles: string[];
  createdAt: string;
  updatedAt: string;
  /** Server-formatted "dd/MM/yyyy HH:mm:ss" — render as-is, do not reformat on the client. */
  createdAtDisplay: string | null;
}

export interface AccessProfilePayload {
  name: string;
  code?: string;
  description?: string | null;
  type?: 'SYSTEM' | 'CUSTOM';
  active: boolean;
  businessUnitScope?: string | null;
  departmentScope?: string | null;
}

export interface PermissionSetSummary {
  id: string;
  code: string;
  name: string;
  description: string | null;
  permissionCount: number;
  system: boolean;
}

export interface AssignedUserSummary {
  id: string;
  fullName: string;
  email: string;
  department: string | null;
  status: string | null;
  assignedAt: string;
}

export interface AccessProfileDetailResponse {
  id: string;
  code: string;
  name: string;
  description: string | null;
  type: 'SYSTEM' | 'CUSTOM';
  active: boolean;
  system: boolean;
  businessUnitScope: string | null;
  departmentScope: string | null;
  permissionSets: PermissionSetSummary[];
  workflowRoles: string[];
  assignedUsers: AssignedUserSummary[];
  createdAt: string;
  updatedAt: string;
}

export interface AccessProfileActionCapability {
  allowed: boolean;
  reason: string | null;
  requiredPermission: string | null;
}

export interface AccessProfileCapabilitiesResponse {
  accessProfileId: string;
  actions: Record<string, AccessProfileActionCapability>;
}

export type DocumentAdministrationSettings = {
  reviewerNoApprove: boolean;
  requireTwoReviewers: boolean;
  requireOneApprover: boolean;
  authorCannotBeReviewerOrApprover: boolean;
  coAuthorCannotBeReviewerOrApprover: boolean;
  sameUserCannotHoldMultipleWorkflowRoles: boolean;
  workflowCoordinatorCannotBeReviewerOrApprover: boolean;
  reviewerAndApproverDifferentDepartments: boolean;
  sodRules?: DocumentAdministrationRule[];
  version: number;
};

const pendingGetDocumentAdministrationRequests = new Map<string, Promise<DocumentAdministrationSettings>>();

export interface GetUsersParams {
  page?: number;
  limit?: number;
  search?: string;
  role?: string;
  status?: string;
  online?: "online" | "offline";
  businessUnit?: string;
  department?: string;
  position?: string;
  dateFrom?: string;
  dateTo?: string;
  lastUpdatedFrom?: string;
  lastUpdatedTo?: string;
  suspendFrom?: string;
  suspendTo?: string;
  terminateFrom?: string;
  terminateTo?: string;
  sortBy?: string;
  sortDirection?: "asc" | "desc";
  includeTerminated?: boolean;
}

const normalizeInSession = (value: unknown): boolean => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return normalized === 'true' || normalized === 'yes' || normalized === '1';
  }
  if (typeof value === 'number') return value === 1;
  return false;
};

const normalizeUserSessionState = <T extends User>(user: T): T => ({
  ...user,
  inSession: normalizeInSession(user.inSession),
  online: normalizeInSession(user.online),
});

export interface GetRolesParams {
  page?: number;
  limit?: number;
  search?: string;
  type?: string;
  status?: string;
  sortBy?: string;
  sortDirection?: "asc" | "desc";
}

export interface PermissionCatalogFlatItem {
  code: string;
  name: string;
  description: string;
  module: string;
  groupName: string;
  requiresAudit: boolean;
}

export interface PermissionCatalogGroup {
  id: string;
  name: string;
  description: string;
  permissions: {
    code: string;
    name: string;
    description: string;
    module: string;
    group: string;
    resource?: string;
    action?: string;
    riskLevel?: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" | string;
    order: number;
    requiresAudit: boolean;
    requiresESign?: boolean;
    systemDefined?: boolean;
    active?: boolean;
  }[];
}

export interface SmtpConnectionTestPayload {
  smtpHost: string;
  smtpPort: number;
  smtpUsername: string;
  smtpPassword: string;
  senderEmail: string;
  senderName: string;
  useSSL: boolean;
}

export type StorageTestPayload =
  | { provider: 'local'; basePath?: string }
  | { provider: 'aws-s3'; bucketName: string; region: string; accessKeyId: string; secretAccessKey: string; basePath?: string }
  | { provider: 'azure-blob'; bucketName: string; accessKeyId: string; secretAccessKey: string; basePath?: string }
  | { provider: 'google-cloud'; bucketName: string; accessKeyId: string; secretAccessKey: string; basePath?: string }
  | {
      provider: 'minio';
      minioEndpoint: string;
      minioBucket: string;
      minioAccessKeyId: string;
      minioSecretAccessKey: string;
      minioRetentionYears?: number;
      documentsPrefix?: string;
      controlledCopiesPrefix?: string;
      templatesPrefix?: string;
      trainingPrefix?: string;
      auditPrefix?: string;
      tempPrefix?: string;
    }
  | { provider: 'nas'; nasHost?: string; nasShareName?: string; nasDomain?: string; nasPath?: string; nasUsername?: string; nasPassword?: string }
  | { provider: 'google-drive'; googleDriveClientId: string; googleDriveClientSecret: string; googleDriveFolderId: string }
  | { provider: 'onedrive'; msTenantId: string; msClientId: string; msClientSecret: string; msDriveId: string; msLibraryFolder?: string }
  | { provider: 'sharepoint'; msTenantId: string; msClientId: string; msClientSecret: string; msSiteId: string; msDriveId: string; msLibraryFolder?: string }
  | { provider: 'dropbox'; dropboxAccessToken: string; dropboxAppKey: string; dropboxAppSecret: string; dropboxFolderPath: string };

export const settingsApi = {
  // ─── User CRUD ───────────────────────────────────────────────────────────────

  /** GET /settings/users — paginated list with filters */
  getUsers: async (params?: GetUsersParams) => {
    const query = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== '') query.set(k, String(v));
      });
    }
    const cacheKey = query.toString();
    const pending = pendingGetUsersRequests.get(cacheKey);
    if (pending) {
      return pending;
    }
    const request = api.get<PaginatedResponse<User>>(`${ENDPOINT}?${query}`)
      .then((response) => ({
        ...response.data,
        data: response.data.data.map(normalizeUserSessionState),
      }))
      .finally(() => {
        pendingGetUsersRequests.delete(cacheKey);
      });
    pendingGetUsersRequests.set(cacheKey, request);
    return request;
  },

  /** GET /settings/users/:id */
  getUserById: async (id: string) => {
    const response = await api.get<User>(`${ENDPOINT}/${id}`);
    return normalizeUserSessionState(response.data);
  },

  /** GET /settings/users/:id/capabilities */
  getUserCapabilities: async (id: string): Promise<UserActionCapabilitiesResponse> => {
    const response = await api.get<UserActionCapabilitiesResponse>(`${ENDPOINT}/${id}/capabilities`);
    return response.data;
  },

  /** POST /settings/users */
  createUser: async (payload: CreateUserPayload) => {
    const response = await api.post<{ user: User; password: string }>(ENDPOINT, payload);
    return response.data;
  },

  /** PUT /settings/users/:id */
  updateUser: async (id: string, payload: Partial<User>) => {
    const response = await api.put<User>(`${ENDPOINT}/${id}`, payload);
    return response.data;
  },

  // ─── User Lifecycle ───────────────────────────────────────────────────────────

  /** POST /settings/users/:id/suspend */
  suspendUser: async (id: string, payload: SuspendUserPayload) => {
    const response = await api.post<User>(`${ENDPOINT}/${id}/suspend`, payload);
    return response.data;
  },

  /** POST /settings/users/:id/terminate */
  terminateUser: async (id: string, payload: TerminateUserPayload) => {
    const response = await api.post<User>(`${ENDPOINT}/${id}/terminate`, payload);
    return response.data;
  },

  /** POST /settings/users/:id/reinstate */
  reinstateUser: async (id: string) => {
    const response = await api.post<User>(`${ENDPOINT}/${id}/reinstate`);
    return response.data;
  },

  /** POST /settings/users/:id/reset-password */
  resetPassword: async (id: string, payload?: ResetPasswordPayload) => {
    const response = await api.post<{ password: string }>(
      `${ENDPOINT}/${id}/reset-password`,
      payload
    );
    return response.data;
  },

  /** POST /settings/users/:id/unlock */
  unlockUser: async (id: string) => {
    const response = await api.post<User>(`${ENDPOINT}/${id}/unlock`);
    return response.data;
  },

  /** POST /settings/users/:id/force-logout */
  forceLogoutUser: async (id: string, payload: ForceLogoutPayload) => {
    await api.post(`${ENDPOINT}/${id}/force-logout`, payload);
  },

  /** GET /settings/users/:id/permissions */
  getUserPermissions: async (id: string) => {
    const response = await api.get<{ userId: string; role: string; permissions: string[] }>(
      `${ENDPOINT}/${id}/permissions`
    );
    return response.data;
  },

  /** GET /settings/users/filters */
  getUserFilters: async () => {
    const response = await api.get<{
      roles: { id: string | null; name: string; code: string; label: string; value: string }[];
      genders: { id: string | null; name: string; code: string; label: string; value: string }[];
      employmentTypes: { id: string | null; name: string; code: string; label: string; value: string }[];
      statuses: { id: string | null; name: string; code: string; label: string; value: string }[];
      departments: { id: string | null; name: string; code: string; label: string; value: string }[];
      businessUnits: { id: string | null; name: string; code: string; label: string; value: string }[];
      positions: { id: string | null; name: string; code: string; label: string; value: string }[];
    }>('/settings/users/filters');
    return response.data;
  },

  // ─── Roles & Permissions ──────────────────────────────────────────────────────

  /** GET /settings/permissions/catalog */
  getPermissionCatalog: async (module?: string, search?: string, audit?: "AUDIT" | "NO_AUDIT") => {
    const query = new URLSearchParams();
    if (module) query.set('module', module);
    if (search) query.set('search', search);
    if (audit) query.set('audit', audit);
    const response = await api.get<PermissionCatalogGroup[]>(
      `/security/permissions/catalog${query.toString() ? `?${query}` : ''}`
    );
    return response.data;
  },

  getPermissionCatalogPaged: async (params: {
    page: number; limit: number; search?: string; module?: string; sortBy?: string; sortDir?: string;
  }) => {
    const response = await api.get<{ data: PermissionCatalogFlatItem[]; pagination: { page: number; limit: number; total: number; totalPages: number } }>(
      '/security/permissions/catalog/paged', { params }
    );
    return response.data;
  },

  /** GET /me/capabilities */
  getMyCapabilities: async () => {
    const response = await api.get<Record<string, boolean>>(`/me/capabilities`);
    return response.data;
  },

  // ─── Departments ──────────────────────────────────────────────────────────────

  /** GET /settings/departments */
  getDepartments: async () => {
    const response = await api.get<{ id: string; name: string; code: string; manager?: string }[]>(
      '/settings/departments'
    );
    return response.data;
  },

  /** GET /settings/business-units */
  getBusinessUnits: async () => {
    const response = await api.get<{ id: string; name: string; code: string; label: string; value: string }[]>(
      '/settings/business-units'
    );
    return response.data;
  },

  /** GET /settings/positions */
  getPositions: async () => {
    const response = await api.get<{ id: string; name: string; code: string; label: string; value: string }[]>(
      '/settings/positions'
    );
    return response.data;
  },

  /** GET /settings/document-administration */
  getDocumentAdministration: async () => {
    const cacheKey = 'default';
    const cachedRequest = pendingGetDocumentAdministrationRequests.get(cacheKey);
    if (cachedRequest) {
      return cachedRequest;
    }

    const request = api.get<DocumentAdministrationSettings>('/settings/document-administration')
      .then((response) => response.data)
      .finally(() => {
        pendingGetDocumentAdministrationRequests.delete(cacheKey);
      });

    pendingGetDocumentAdministrationRequests.set(cacheKey, request);
    return request;
  },

  /** PUT /settings/document-administration */
  updateDocumentAdministration: async (payload: {
    reviewerNoApprove: boolean;
    requireTwoReviewers: boolean;
    requireOneApprover: boolean;
    authorCannotBeReviewerOrApprover: boolean;
    coAuthorCannotBeReviewerOrApprover: boolean;
    sameUserCannotHoldMultipleWorkflowRoles: boolean;
    workflowCoordinatorCannotBeReviewerOrApprover: boolean;
    reviewerAndApproverDifferentDepartments: boolean;
    version: number;
    reason: string;
    signatureToken: string;
  }) => {
    const response = await api.put<DocumentAdministrationSettings>('/settings/document-administration', payload);
    return response.data;
  },

  /** GET /settings/system */
  getSystemConfiguration: async () => {
    const cacheKey = 'default';
    const cachedRequest = pendingGetSystemConfigurationRequests.get(cacheKey);
    if (cachedRequest) {
      return cachedRequest;
    }

    const request = api.get<{
      general: Record<string, any>;
      security: Record<string, any>;
      documents: Record<string, any>;
      notifications: Record<string, any>;
      integrations: Record<string, any>;
      features: Record<string, any>[];
    }>('/settings/system')
      .then((response) => response.data)
      .finally(() => {
        pendingGetSystemConfigurationRequests.delete(cacheKey);
      });

    pendingGetSystemConfigurationRequests.set(cacheKey, request);
    return request;
  },

  inviteExternalUser: async (id: string, reason: string) => {
    const response = await api.post(`${ENDPOINT}/${id}/external-invitation`, { reason });
    return response.data;
  },

  resendExternalInvitation: async (id: string, reason: string) => {
    const response = await api.post(`${ENDPOINT}/${id}/external-invitation/resend`, { reason });
    return response.data;
  },

  retryExternalProvisioning: async (id: string, reason: string) => {
    const response = await api.post(`${ENDPOINT}/${id}/external-invitation/retry`, { reason });
    return response.data;
  },

  getExternalProvisioning: async (id: string) => {
    const response = await api.get<ExternalIdentityProvisioningResponse>(`${ENDPOINT}/${id}/external-provisioning`);
    return response.data;
  },

  disableMicrosoftAccess: async (id: string, reason: string) => {
    const response = await api.post(`${ENDPOINT}/${id}/microsoft-access/disable`, { reason });
    return response.data;
  },

  /** Permanently deletes the guest object from Microsoft Entra. Irreversible. */
  removeExternalUser: async (id: string, reason: string) => {
    const response = await api.post(`${ENDPOINT}/${id}/external-identity/remove`, { reason });
    return response.data;
  },

  /** GET /settings/system/storage-path-preview — generated by backend storage path builders. */
  getStoragePathPreview: async () => {
    const response = await api.get<{
      officeOnlineWorkspace: string;
      documents: string;
      controlledCopies: string;
      templates: string;
      training: string;
      auditEvidence: string;
      temporaryFiles: string;
    }>('/settings/system/storage-path-preview');
    return response.data;
  },

  /** PUT /settings/system */
  updateSystemConfiguration: async (payload: {
    general: Record<string, any>;
    security: Record<string, any>;
    documents: Record<string, any>;
    notifications: Record<string, any>;
    integrations: Record<string, any>;
    features: Record<string, any>[];
  }) => {
    const response = await api.put<{
      general: Record<string, any>;
      security: Record<string, any>;
      documents: Record<string, any>;
      notifications: Record<string, any>;
      integrations: Record<string, any>;
      features: Record<string, any>[];
    }>('/settings/system', payload);
    return response.data;
  },

  testOfficeOnlineConnection: async (payload: {
    enabled: boolean;
    graphBaseUrl: string;
    tenantId: string;
    clientId: string;
    clientSecret: string;
    siteId: string;
    driveId: string;
    libraryFolder: string;
    shareLinkScope?: string;
    reviewLinksEnabled?: boolean;
  }) => {
    const response = await api.post<{
      success: boolean;
      message: string;
      siteId: string;
      driveId: string;
      libraryFolder: string;
    }>('/settings/system/office-online/test-connection', payload);
    return response.data;
  },

  getOfficeOnlineConfiguration: async () => {
    const response = await api.get('/settings/system/office-online');
    return response.data;
  },

  updateOfficeOnlineConfiguration: async (payload: {
    enabled?: boolean;
    graphBaseUrl?: string;
    tenantId?: string;
    clientId?: string;
    clientSecret?: string;
    siteId?: string;
    driveId?: string;
    libraryFolder?: string;
    shareLinkScope?: string;
    reviewLinksEnabled?: boolean;
  }) => {
    const response = await api.put('/settings/system/office-online', payload);
    return response.data;
  },

  getOfficeOnlineHealth: async () => {
    const response = await api.get<{
      status: string;
      message: string;
      configured: boolean;
      graphReachable: boolean;
      sharingCapabilityTested: boolean;
      checkedAt: string;
    }>('/settings/system/office-online/health');
    return response.data;
  },

  testStorageConnection: async (payload: StorageTestPayload) => {
    const response = await api.post<{
      success: boolean;
      message: string;
    }>('/settings/system/storage/test-connection', payload);
    return response.data;
  },

  testSmtpConnection: async (payload: SmtpConnectionTestPayload) => {
    const response = await api.post<{
      success: boolean;
      message: string;
    }>('/settings/system/smtp/test-connection', payload);
    return response.data;
  },

  browseFolders: async (path?: string) => {
    const response = await api.get<Array<{
      id: string;
      name: string;
      path: string;
      webUrl: string;
    }>>('/settings/system/office-online/browse-folders', {
      params: path ? { path } : {},
    });
    return response.data;
  },

  /** GET /configurations/security */
  getSecurityConfiguration: async () => {
    const cacheKey = 'default';
    const cachedRequest = pendingGetSecurityConfigurationRequests.get(cacheKey);
    if (cachedRequest) {
      return cachedRequest;
    }

    const request = api.get<{ sessionTimeoutMinutes: number }>('/configurations/security')
      .then((response) => response.data)
      .finally(() => {
        pendingGetSecurityConfigurationRequests.delete(cacheKey);
      });

    pendingGetSecurityConfigurationRequests.set(cacheKey, request);
    return request;
  },

  /** PUT /configurations/security */
  updateSecurityConfiguration: async (payload: { sessionTimeoutMinutes: number }) => {
    const response = await api.put<{ sessionTimeoutMinutes: number }>('/configurations/security', payload);
    return response.data;
  },

  /** GET /settings/users/:id/education */
  getUserEducation: async (id: string) => {
    const response = await api.get(`${ENDPOINT}/${id}/education`);
    return response.data;
  },

  /** POST /settings/users/:id/education */
  addUserEducation: async (id: string, payload: any) => {
    const response = await api.post(`${ENDPOINT}/${id}/education`, payload);
    return response.data;
  },

  /** PUT /settings/users/:id/education/:educationId */
  updateUserEducation: async (id: string, educationId: string, payload: any) => {
    const response = await api.put(`${ENDPOINT}/${id}/education/${educationId}`, payload);
    return response.data;
  },

  /** DELETE /settings/users/:id/education/:educationId */
  deleteUserEducation: async (id: string, educationId: string) => {
    await api.delete(`${ENDPOINT}/${id}/education/${educationId}`);
  },

  /** GET /settings/users/:id/certifications */
  getUserCertifications: async (id: string) => {
    const response = await api.get(`${ENDPOINT}/${id}/certifications`);
    return response.data;
  },

  /** POST /settings/users/:id/certifications */
  addUserCertification: async (id: string, payload: any) => {
    const response = await api.post(`${ENDPOINT}/${id}/certifications`, payload);
    return response.data;
  },

  /** PUT /settings/users/:id/certifications/:certificationId */
  updateUserCertification: async (id: string, certificationId: string, payload: any) => {
    const response = await api.put(`${ENDPOINT}/${id}/certifications/${certificationId}`, payload);
    return response.data;
  },

  /** DELETE /settings/users/:id/certifications/:certificationId */
  deleteUserCertification: async (id: string, certificationId: string) => {
    await api.delete(`${ENDPOINT}/${id}/certifications/${certificationId}`);
  },

  /** POST /settings/users/:id/certifications/:certificationId/file — multipart upload */
  uploadUserCertificationFile: async (id: string, certificationId: string, file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    const response = await api.post(
      `${ENDPOINT}/${id}/certifications/${certificationId}/file`,
      formData,
      { headers: { "Content-Type": "multipart/form-data" } }
    );
    return response.data;
  },

  /** GET /settings/users/:id/certifications/:certificationId/file — download as blob */
  downloadUserCertificationFile: async (id: string, certificationId: string) => {
    const response = await api.get(`${ENDPOINT}/${id}/certifications/${certificationId}/file`, {
      responseType: "blob",
    });
    return response.data as Blob;
  },

  // ─── Export ───────────────────────────────────────────────────────────────────

  /** GET /settings/users/export — XLSX blob */
  exportUsers: async (params?: GetUsersParams) => {
    const query = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== '') query.set(k, String(v));
      });
    }
    const response = await api.get<Blob>(`${ENDPOINT}/export?${query}`, { responseType: 'blob' });
    return response.data;
  },

  // ─── Permission Sets ──────────────────────────────────────────────────────

  listPermissionSetsPaged: async (params: {
    page?: number; limit?: number; search?: string; status?: string; type?: string;
    module?: string; category?: string;
    createdFrom?: string; createdTo?: string; updatedFrom?: string; updatedTo?: string;
    sortBy?: string; sortDir?: string;
  }): Promise<PaginatedResponse<PermissionSetResponse>> => {
    const r = await api.get<PaginatedResponse<PermissionSetResponse>>('/security/permission-sets/paged', { params });
    return r.data;
  },

  getPermissionSetListOptions: async (): Promise<Record<string, string[]>> => {
    const r = await api.get<Record<string, string[]>>('/security/permission-sets/list-options');
    return r.data;
  },

  listPermissionSets: async (includeManaged = false): Promise<PermissionSetResponse[]> => {
    const r = await api.get<PermissionSetResponse[]>('/security/permission-sets', { params: { includeManaged } });
    return r.data;
  },
  getPermissionSet: async (id: string): Promise<PermissionSetResponse> => {
    const r = await api.get<PermissionSetResponse>(`/security/permission-sets/${id}`);
    return r.data;
  },
  getPermissionSetAssignedAccessProfiles: async (id: string): Promise<PermissionSetAssignedAccessProfile[]> => {
    const r = await api.get<PermissionSetAssignedAccessProfile[]>(`/security/permission-sets/${id}/access-profiles`);
    return r.data;
  },
  getPermissionSetCapabilities: async (id: string): Promise<PermissionSetCapabilitiesResponse> => {
    const r = await api.get<PermissionSetCapabilitiesResponse>(`/security/permission-sets/${id}/capabilities`);
    return r.data;
  },
  createPermissionSet: async (payload: PermissionSetPayload, sig?: SecuritySignaturePayload): Promise<PermissionSetResponse> => {
    const r = await api.post<PermissionSetResponse>('/security/permission-sets', { ...payload, ...sig });
    return r.data;
  },
  updatePermissionSet: async (id: string, payload: PermissionSetPayload, sig?: SecuritySignaturePayload): Promise<PermissionSetResponse> => {
    const r = await api.put<PermissionSetResponse>(`/security/permission-sets/${id}`, { ...payload, ...sig });
    return r.data;
  },
  deletePermissionSet: async (id: string, sig?: SecuritySignaturePayload): Promise<void> => {
    await api.delete(`/security/permission-sets/${id}`, { data: sig });
  },

  // ─── Object Access Rules ──────────────────────────────────────────────────

  getObjectAccessRuleOptions: async (): Promise<ObjectAccessRuleOptionsResponse> => {
    const r = await api.get<ObjectAccessRuleOptionsResponse>('/security/object-access-rules/options');
    return r.data;
  },

  listObjectAccessRulesPaged: async (params: {
    page?: number; limit?: number; search?: string; resourceType?: string;
    effect?: string; status?: string;
    createdFrom?: string; createdTo?: string; updatedFrom?: string; updatedTo?: string;
    sortBy?: string; sortDir?: string;
  }): Promise<PaginatedResponse<ObjectAccessRuleResponse>> => {
    const r = await api.get<PaginatedResponse<ObjectAccessRuleResponse>>('/security/object-access-rules/paged', { params });
    return r.data;
  },

  listObjectAccessRules: async (): Promise<ObjectAccessRuleResponse[]> => {
    const r = await api.get<ObjectAccessRuleResponse[]>('/security/object-access-rules');
    return r.data;
  },
  getObjectAccessRule: async (id: string): Promise<ObjectAccessRuleResponse> => {
    const r = await api.get<ObjectAccessRuleResponse>(`/security/object-access-rules/${id}`);
    return r.data;
  },
  createObjectAccessRule: async (payload: ObjectAccessRulePayload, sig?: SecuritySignaturePayload): Promise<ObjectAccessRuleResponse> => {
    const r = await api.post<ObjectAccessRuleResponse>('/security/object-access-rules', { ...payload, ...sig });
    return r.data;
  },
  updateObjectAccessRule: async (id: string, payload: ObjectAccessRulePayload, sig?: SecuritySignaturePayload): Promise<ObjectAccessRuleResponse> => {
    const r = await api.put<ObjectAccessRuleResponse>(`/security/object-access-rules/${id}`, { ...payload, ...sig });
    return r.data;
  },
  deleteObjectAccessRule: async (id: string, sig?: SecuritySignaturePayload): Promise<void> => {
    await api.delete(`/security/object-access-rules/${id}`, { data: sig });
  },

  // ─── SoD Constraints ─────────────────────────────────────────────────────

  listSodConstraintsPaged: async (params: {
    page?: number; limit?: number; search?: string; severity?: string;
    type?: string; status?: string;
    createdFrom?: string; createdTo?: string; updatedFrom?: string; updatedTo?: string;
    sortBy?: string; sortDir?: string;
  }): Promise<PaginatedResponse<SodConstraintResponse>> => {
    const r = await api.get<PaginatedResponse<SodConstraintResponse>>('/security/sod-constraints/paged', { params });
    return r.data;
  },

  getSodListOptions: async (): Promise<Record<string, string[]>> => {
    const r = await api.get<Record<string, string[]>>('/security/sod-constraints/list-options');
    return r.data;
  },

  listSodConstraints: async (): Promise<SodConstraintResponse[]> => {
    const r = await api.get<SodConstraintResponse[]>('/security/sod-constraints');
    return r.data;
  },

  getSodConstraint: async (id: string): Promise<SodConstraintResponse> => {
    const r = await api.get<SodConstraintResponse>(`/security/sod-constraints/${id}`);
    return r.data;
  },
  getSodViolations: async (): Promise<SodViolationResponse[]> => {
    const r = await api.get<SodViolationResponse[]>('/security/sod-constraints/violations');
    return r.data;
  },
  checkSodPermissions: async (codes: string[]): Promise<SodConstraintResponse[]> => {
    const r = await api.post<SodConstraintResponse[]>('/security/sod-constraints/check', codes);
    return r.data;
  },
  checkSodAccessProfileCombination: async (accessProfileIds: string[]): Promise<SodProfileCombinationViolationResponse[]> => {
    const r = await api.post<SodProfileCombinationViolationResponse[]>('/security/sod-constraints/check-access-profiles', accessProfileIds);
    return r.data;
  },
  createSodConstraint: async (payload: SodConstraintPayload, sig?: SecuritySignaturePayload): Promise<SodConstraintResponse> => {
    const r = await api.post<SodConstraintResponse>('/security/sod-constraints', { ...payload, ...sig });
    return r.data;
  },
  updateSodConstraint: async (id: string, payload: SodConstraintPayload, sig?: SecuritySignaturePayload): Promise<SodConstraintResponse> => {
    const r = await api.put<SodConstraintResponse>(`/security/sod-constraints/${id}`, { ...payload, ...sig });
    return r.data;
  },
  deleteSodConstraint: async (id: string, sig?: SecuritySignaturePayload): Promise<void> => {
    await api.delete(`/security/sod-constraints/${id}`, { data: sig });
  },

  // ─── Access Profiles (new RBAC model) ────────────────────────────────────────

  listAccessProfiles: async (params?: { page?: number; size?: number; search?: string; type?: string; status?: string; createdFrom?: string; createdTo?: string; updatedFrom?: string; updatedTo?: string }) => {
    const r = await api.get<{ content: AccessProfileResponse[]; totalElements: number; totalPages: number; number: number }>('/security/access-profiles', { params });
    return r.data;
  },
  listAllAccessProfiles: async (): Promise<AccessProfileResponse[]> => {
    const r = await api.get<AccessProfileResponse[]>('/security/access-profiles/all');
    return r.data;
  },
  getAccessProfile: async (id: string): Promise<AccessProfileDetailResponse> => {
    const r = await api.get<AccessProfileDetailResponse>(`/security/access-profiles/${id}`);
    return r.data;
  },
  getAccessProfileCapabilities: async (id: string): Promise<AccessProfileCapabilitiesResponse> => {
    const r = await api.get<AccessProfileCapabilitiesResponse>(`/security/access-profiles/${id}/capabilities`);
    return r.data;
  },
  listWorkflowRoleCatalog: async (): Promise<WorkflowRoleCatalogSummary[]> => {
    const r = await api.get<WorkflowRoleCatalogSummary[]>('/security/workflow-roles');
    return r.data;
  },
  createAccessProfile: async (payload: AccessProfilePayload, sig?: SecuritySignaturePayload): Promise<AccessProfileDetailResponse> => {
    const r = await api.post<AccessProfileDetailResponse>('/security/access-profiles', { ...payload, ...sig });
    return r.data;
  },
  /** Atomic "create role in one shot" (profile + picked permissions + shared sets + workflow roles + users) — one e-signature. */
  createAccessProfileFull: async (
    payload: {
      name: string; description?: string; active: boolean;
      businessUnitScope?: string | null; departmentScope?: string | null;
      permissionCodes: string[]; permissionSetIds: string[];
      workflowRoles: string[]; userIds: string[];
    },
    sig?: SecuritySignaturePayload,
  ): Promise<AccessProfileDetailResponse> => {
    const r = await api.post<AccessProfileDetailResponse>('/security/access-profiles/full', { ...payload, ...sig });
    return r.data;
  },
  /** Replace the role's individually-picked permissions (its auto-managed ROLE_<code> set). */
  setAccessProfileManagedPermissions: async (id: string, codes: string[], sig?: SecuritySignaturePayload): Promise<void> => {
    await api.post(`/security/access-profiles/${id}/managed-permissions`, { codes, ...sig });
  },
  /**
   * Aggregate "save role configuration" — one request, one transaction, one e-signature.
   * Omit a section (undefined) to leave it untouched. 409 when expectedUpdatedAt is stale.
   */
  updateAccessProfileConfiguration: async (
    id: string,
    payload: {
      expectedUpdatedAt?: string;
      general?: { name: string; description: string | null; active: boolean; businessUnitScope: string | null; departmentScope: string | null };
      managedPermissionCodes?: string[];
      sharedPermissionSetIds?: string[];
      workflowRoles?: string[];
      userIds?: string[];
    },
    sig?: SecuritySignaturePayload,
  ): Promise<AccessProfileDetailResponse> => {
    const r = await api.put<AccessProfileDetailResponse>(`/security/access-profiles/${id}/configuration`, { ...payload, ...sig });
    return r.data;
  },
  updateAccessProfile: async (id: string, payload: AccessProfilePayload, sig?: SecuritySignaturePayload): Promise<AccessProfileDetailResponse> => {
    const r = await api.put<AccessProfileDetailResponse>(`/security/access-profiles/${id}`, { ...payload, ...sig });
    return r.data;
  },
  deleteAccessProfile: async (id: string, sig?: SecuritySignaturePayload): Promise<void> => {
    await api.delete(`/security/access-profiles/${id}`, { data: sig });
  },
  duplicateAccessProfile: async (id: string, name?: string, sig?: SecuritySignaturePayload): Promise<AccessProfileDetailResponse> => {
    const r = await api.post<AccessProfileDetailResponse>(`/security/access-profiles/${id}/duplicate`, { name, ...sig });
    return r.data;
  },
  toggleAccessProfileStatus: async (id: string, sig?: SecuritySignaturePayload): Promise<AccessProfileDetailResponse> => {
    const r = await api.put<AccessProfileDetailResponse>(`/security/access-profiles/${id}/toggle-status`, sig ?? {});
    return r.data;
  },
  setAccessProfilePermissionSets: async (id: string, permissionSetIds: string[], sig?: SecuritySignaturePayload): Promise<void> => {
    await api.put(`/security/access-profiles/${id}/permission-sets`, { permissionSetIds, ...sig });
  },
  addAccessProfilePermissionSet: async (id: string, psId: string, sig?: SecuritySignaturePayload): Promise<void> => {
    await api.post(`/security/access-profiles/${id}/permission-sets/${psId}`, sig ?? {});
  },
  removeAccessProfilePermissionSet: async (id: string, psId: string, sig?: SecuritySignaturePayload): Promise<void> => {
    await api.delete(`/security/access-profiles/${id}/permission-sets/${psId}`, { data: sig });
  },
  setAccessProfileWorkflowRoles: async (id: string, roles: string[], sig?: SecuritySignaturePayload): Promise<void> => {
    await api.put(`/security/access-profiles/${id}/workflow-roles`, { roles, ...sig });
  },
  addAccessProfileWorkflowRole: async (id: string, role: string, sig?: SecuritySignaturePayload): Promise<void> => {
    await api.post(`/security/access-profiles/${id}/workflow-roles/${role}`, sig ?? {});
  },
  removeAccessProfileWorkflowRole: async (id: string, role: string, sig?: SecuritySignaturePayload): Promise<void> => {
    await api.delete(`/security/access-profiles/${id}/workflow-roles/${role}`, { data: sig });
  },
  getAccessProfileUsers: async (id: string): Promise<AssignedUserSummary[]> => {
    const r = await api.get<AssignedUserSummary[]>(`/security/access-profiles/${id}/users`);
    return r.data;
  },
  assignUserToAccessProfile: async (id: string, userId: string, sig?: SecuritySignaturePayload): Promise<void> => {
    await api.post(`/security/access-profiles/${id}/users/${userId}`, sig ?? {});
  },
  removeUserFromAccessProfile: async (id: string, userId: string, sig?: SecuritySignaturePayload): Promise<void> => {
    await api.delete(`/security/access-profiles/${id}/users/${userId}`, { data: sig });
  },

  // --- Access Reviews ---

  listAccessReviewsPaged: async (params: {
    page?: number; limit?: number; search?: string; status?: string;
    createdFrom?: string; createdTo?: string; updatedFrom?: string; updatedTo?: string;
    sortBy?: string; sortDir?: string;
  }): Promise<PaginatedResponse<AccessReviewCampaignSummary>> => {
    const r = await api.get<PaginatedResponse<AccessReviewCampaignSummary>>('/security/access-reviews/paged', { params });
    return r.data;
  },

  getAccessReviewListOptions: async (): Promise<Record<string, AccessReviewListOption[]>> => {
    const r = await api.get<Record<string, AccessReviewListOption[]>>('/security/access-reviews/list-options');
    return r.data;
  },

  listAccessReviews: async (): Promise<AccessReviewCampaignSummary[]> => {
    const r = await api.get<AccessReviewCampaignSummary[]>('/security/access-reviews');
    return r.data;
  },
  getAccessReview: async (id: string): Promise<AccessReviewCampaignDetail> => {
    const r = await api.get<AccessReviewCampaignDetail>(`/security/access-reviews/${id}`);
    return r.data;
  },
  getAccessReviewSummary: async (id: string): Promise<AccessReviewCampaignSummary> => {
    const r = await api.get<AccessReviewCampaignSummary>(`/security/access-reviews/${id}/summary`);
    return r.data;
  },
  listAccessReviewItemsPaged: async (id: string, params: {
    page?: number; limit?: number; search?: string; userStatus?: string; decision?: string; sortBy?: string; sortDir?: string;
  }): Promise<PaginatedResponse<AccessReviewItem>> => {
    const r = await api.get<PaginatedResponse<AccessReviewItem>>(`/security/access-reviews/${id}/items/paged`, { params });
    return r.data;
  },
  createAccessReview: async (payload: { name: string; description?: string; reviewPeriodStart?: string; reviewPeriodEnd?: string }): Promise<AccessReviewCampaignDetail> => {
    const r = await api.post<AccessReviewCampaignDetail>('/security/access-reviews', payload);
    return r.data;
  },
  decideAccessReviewItem: async (campaignId: string, itemId: string, payload: { decision: string; note?: string }): Promise<AccessReviewItem> => {
    const r = await api.put<AccessReviewItem>(`/security/access-reviews/${campaignId}/items/${itemId}`, payload);
    return r.data;
  },
  completeAccessReview: async (id: string, sig: SecuritySignaturePayload): Promise<AccessReviewCampaignDetail> => {
    const r = await api.post<AccessReviewCampaignDetail>(`/security/access-reviews/${id}/complete`, sig);
    return r.data;
  },
  cancelAccessReview: async (id: string): Promise<AccessReviewCampaignDetail> => {
    const r = await api.post<AccessReviewCampaignDetail>(`/security/access-reviews/${id}/cancel`);
    return r.data;
  },

  getAccessProfileMigrationReport: async (): Promise<AccessProfileMigrationReport> => {
    const r = await api.get<AccessProfileMigrationReport>('/security/access-profiles/migration-report');
    return r.data;
  },
  getUserAuthorizationSummary: async (id: string): Promise<UserAuthorizationSummary> => {
    const r = await api.get<UserAuthorizationSummary>(`/settings/users/${id}/authorization-summary`);
    return r.data;
  },
};

// --- Access Review types ---

export interface AccessReviewCampaignSummary {
  id: string;
  name: string;
  description?: string | null;
  reviewPeriodStart?: string | null;
  reviewPeriodEnd?: string | null;
  status: 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  statusLabel: string;
  reviewerName?: string | null;
  signedAt?: string | null;
  signatureId?: string | null;
  totalItems: number;
  pendingItems: number;
  createdAt: string;
  updatedAt: string;
}

export interface AccessReviewItem {
  id: string;
  userId?: string | null;
  employeeCode?: string | null;
  username: string;
  fullName?: string | null;
  userStatus?: string | null;
  userStatusLabel?: string | null;
  accessProfiles?: string | null;
  permissionCount: number;
  superAdmin: boolean;
  decision: 'PENDING' | 'CONFIRMED' | 'REVOKE_REQUESTED' | 'MODIFY_REQUESTED';
  decisionLabel: string;
  decisionNote?: string | null;
  decidedAt?: string | null;
}

export interface AccessReviewCampaignDetail {
  campaign: AccessReviewCampaignSummary;
  items: AccessReviewItem[];
}

export interface WorkflowRoleCatalogSummary {
  code: string;
  label: string;
  description?: string | null;
}

export interface AccessReviewListOption {
  value: string;
  label: string;
}

export interface AccessProfileMigrationReport {
  totalUsers: number;
  usersWithProfile: number;
  usersWithoutAccessProfile: number;
  usersWithSuperAdmin: number;
  usersWithoutAnyPermission: number;
  accessProfilesEnforced: boolean;
  unassignedUsers: { id: string; username: string; fullName?: string | null; status?: string | null }[];
}
