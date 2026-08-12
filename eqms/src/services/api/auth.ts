import { api as apiClient } from './client';
import { secureStorage } from '@/utils/security';
import { authTokenStore } from '@/services/authTokenStore';

export interface LoginCredentials {
  /** Accepts either a username or an email address */
  username: string;
  password: string;
}

export interface AuthResponse {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export type MfaMethod = 'email' | 'app';
export type PasswordChangeReason = 'FIRST_LOGIN' | 'ADMIN_RESET' | 'PASSWORD_EXPIRED' | 'SECURITY_INCIDENT' | 'LEGACY_REQUIRED';

export interface NotificationChannelPreferences {
  email?: boolean;
  inApp?: boolean;
  push?: boolean;
}

export interface NotificationPreferences {
  channels?: NotificationChannelPreferences;
  modules?: Record<string, boolean>;
}

export interface LoginChallengeResponse {
  mfaRequired: true;
  mfaToken: string;
  availableMethods: MfaMethod[];
  maskedEmail?: string;
  username?: string;
  expiresIn: number;
  rememberDeviceAllowed?: boolean;
}

export interface ResetPasswordValidationResponse {
  valid: boolean;
  expiresAt: string | null;
}

export interface PasswordPolicy {
  passwordMinLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSpecialChars: boolean;
}

export type LoginResult = AuthResponse | LoginChallengeResponse;

const isLoginChallengeResponse = (result: LoginResult): result is LoginChallengeResponse => {
  return 'mfaRequired' in result && result.mfaRequired === true;
};

let pendingCurrentUserRequest: Promise<AuthUser> | null = null;

export interface AuthUser {
  id: string;
  username: string;
  fullName: string;
  email: string;
  role: string;
  department?: string;
  permissions: string[];
  avatar?: string;
  requirePasswordChange?: boolean;
  passwordChangeReason?: PasswordChangeReason | null;
  mfaEnabled?: boolean;
  mfaEmailFallbackEnabled?: boolean;
  mfaRememberDeviceEnabled?: boolean;
  emailNotificationsEnabled?: boolean;
  notificationPreferences?: NotificationPreferences;
  mfaSetupRequired?: boolean;
  maintenanceMode?: boolean;
  phone?: string;
  employeeCode?: string;
  position?: string;
  businessUnit?: string;
  employmentType?: string;
  startDate?: string;
  nationality?: string;
  dateOfBirth?: string;
  gender?: string;
  address?: string;
  managerName?: string;
  language?: string;
  idNumber?: string;
  professionalLevel?: string;
  areaOfExpertise?: string;
  yearsOfExperience?: string;
  previousEmployer?: string;
  status?: string;
  lastLoginAt?: string;
  lastLogin?: string;
  createdAt?: string;
  createdDate?: string;
  updatedAt?: string;
  passwordChangedAt?: string;
  suspendReason?: string;
  suspendedUntil?: string;
  terminationReason?: string;
  terminationDate?: string;
  firstName?: string;
  lastName?: string;
  educationList?: Array<{
    id: string;
    degree: string;
    fieldOfStudy: string;
    institution: string;
    graduationYear: string;
    gpa: string;
  }>;
  certifications?: Array<{
    id: string;
    name: string;
    issuingOrg: string;
    issueDate?: string;
    expiryDate?: string;
    fileName?: string;
    fileSize?: number;
    fileType?: string;
    fileObjectUrl?: string;
  }>;
}

export const authApi = {
  /** POST /auth/login (front-end-first: returns auth success or MFA challenge) */
  loginWithChallenge: async (credentials: LoginCredentials): Promise<LoginResult> => {
    const response = await apiClient.post<LoginResult>('/auth/login', {
      identifier: credentials.username,
      password: credentials.password,
    });
    const data = response.data;

    if (isLoginChallengeResponse(data)) {
      return data;
    }

    return data;
  },

  /** POST /auth/login */
  login: async (credentials: LoginCredentials): Promise<AuthResponse> => {
    const result = await authApi.loginWithChallenge(credentials);
    if (isLoginChallengeResponse(result)) {
      throw new Error('MFA_REQUIRED');
    }
    return result;
  },

  /** POST /auth/logout */
  signOut: async (): Promise<void> => {
    try {
      await apiClient.post('/auth/logout', {});
    } finally {
      authTokenStore.clear();
      secureStorage.removeItem('authToken');
      secureStorage.removeItem('refreshToken');
    }
  },

  /** Backward-compatible alias for sign out */
  logout: async (): Promise<void> => authApi.signOut(),

  /** POST /auth/refresh */
  refreshToken: async (): Promise<{ accessToken: string; refreshToken: string }> => {
    const response = await apiClient.post<{ accessToken: string; refreshToken: string; expiresIn: number }>('/auth/refresh', {});
    return response.data;
  },

  /** GET /auth/me */
  getCurrentUser: async (): Promise<AuthUser> => {
    if (!pendingCurrentUserRequest) {
      pendingCurrentUserRequest = apiClient
        .get<AuthUser>('/auth/me')
        .then((response) => response.data)
        .finally(() => {
          pendingCurrentUserRequest = null;
        });
    }

    return pendingCurrentUserRequest;
  },

  /** PUT /auth/me/profile */
  updateProfile: async (data: { fullName?: string; phone?: string; email?: string; avatar?: string }): Promise<AuthUser> => {
    const response = await apiClient.put<AuthUser>('/auth/me/profile', data);
    return response.data;
  },

  /** POST /auth/me/change-password */
  changePassword: async (data: {
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
  }): Promise<void> => {
    await apiClient.post('/auth/me/change-password', data);
  },

  // ─── E-Signature (21 CFR Part 11) ────────────────────────────────────────────

  /** POST /auth/verify-signature — xác minh e-signature */
  verifyESignature: async (credentials: {
    username?: string;
    password: string;
  }): Promise<{ valid: boolean; userId: string; username: string; fullName: string; position?: string; department?: string; signatureToken: string; timestamp: string }> => {
    const response = await apiClient.post<{
      valid: boolean;
      userId: string;
      username: string;
      fullName: string;
      position?: string;
      department?: string;
      signatureToken: string;
      timestamp: string;
    }>('/auth/verify-signature', credentials);
    return response.data;
  },

  // ─── MFA ──────────────────────────────────────────────────────────────────────

  /** POST /auth/mfa/send-email-otp */
  sendEmailOtp: async (data: { mfaToken: string }): Promise<{ expiresIn: number; cooldownSeconds: number }> => {
    const response = await apiClient.post<{ expiresIn: number; cooldownSeconds: number }>(
      '/auth/mfa/send-email-otp',
      data
    );
    return response.data;
  },

  /** POST /auth/reauthenticate */
  reauthenticate: async (data: { password: string }): Promise<AuthResponse> => {
    const response = await apiClient.post<AuthResponse>('/auth/reauthenticate', data);
    return response.data;
  },

  /** POST /auth/session/heartbeat */
  touchSession: async (): Promise<void> => {
    await apiClient.post('/auth/session/heartbeat');
  },

  /** POST /auth/mfa/verify */
  verifyMFA: async (data: {
    mfaToken: string;
    otp: string;
    method: MfaMethod;
    rememberDevice?: boolean;
  }): Promise<AuthResponse> => {
    const response = await apiClient.post<AuthResponse>('/auth/mfa/verify', data);
    return response.data;
  },

  /** POST /auth/mfa/setup */
  setupMFA: async (method?: MfaMethod): Promise<{ secret: string; qrCodeUrl: string }> => {
    const response = await apiClient.post<{ secret: string; qrCodeUrl: string }>('/auth/mfa/setup', { method });
    return response.data;
  },

  /** POST /auth/mfa/enable */
  enableMFA: async (data: { otp: string; method?: MfaMethod }): Promise<void> => {
    await apiClient.post('/auth/mfa/enable', data);
  },

  /** POST /auth/mfa/disable */
  disableMFA: async (data: { password?: string }): Promise<void> => {
    await apiClient.post('/auth/mfa/disable', data);
  },

  /** PUT /auth/mfa/settings */
  updateMfaSettings: async (data: {
    mfaEmailFallbackEnabled?: boolean;
    mfaRememberDeviceEnabled?: boolean;
  }): Promise<AuthUser> => {
    const response = await apiClient.put<AuthUser>('/auth/mfa/settings', data);
    return response.data;
  },

  // ─── Password Reset ───────────────────────────────────────────────────────────

  /** POST /auth/forgot-password */
  forgotPassword: async (data: { identifier: string; reason?: string }): Promise<void> => {
    await apiClient.post('/auth/forgot-password', data);
  },

  /** POST /auth/reset-password */
  resetPassword: async (data: {
    token: string;
    newPassword: string;
    confirmPassword: string;
  }): Promise<void> => {
    await apiClient.post('/auth/reset-password', data);
  },

  /** GET /auth/reset-password/validate-token */
  validateResetToken: async (token: string): Promise<ResetPasswordValidationResponse> => {
    const response = await apiClient.get<ResetPasswordValidationResponse>('/auth/reset-password/validate-token', {
      params: { token },
    });
    return response.data;
  },

  getPasswordPolicy: async (): Promise<PasswordPolicy> => {
    const response = await apiClient.get<PasswordPolicy>('/auth/password-policy');
    return response.data;
  },

  // ─── Sessions ─────────────────────────────────────────────────────────────────

  /** GET /auth/sessions */
  getSessions: async (): Promise<
    {
      sessionId: string;
      device: string;
      ipAddress: string;
      lastActivity: string;
      current: boolean;
    }[]
  > => {
    const response = await apiClient.get<
      {
        sessionId: string;
        device: string;
        ipAddress: string;
        lastActivity: string;
        current: boolean;
      }[]
    >('/auth/sessions');
    return response.data;
  },

  /** DELETE /auth/sessions — thu hồi tất cả sessions khác */
  revokeOtherSessions: async (): Promise<void> => {
    await apiClient.delete('/auth/sessions');
  },

  /** DELETE /auth/sessions/:sessionId */
  revokeSession: async (sessionId: string): Promise<void> => {
    await apiClient.delete(`/auth/sessions/${sessionId}`);
  },
};
