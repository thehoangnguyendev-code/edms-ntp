/**
 * Authentication Context - Enhanced with Security Features
 * Provides authentication state and methods throughout the app
 * Includes secure token storage, session monitoring, and audit logging
 */

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { authApi } from '@/services/api';
import type { User, LoginCredentials, UserStatus } from '@/types';
import { secureStorage, tokenUtils, auditLog, csrfToken } from '@/utils/security';
import { authTokenStore } from '@/services/authTokenStore';
import { setActiveUserId, clearActiveUserId } from '@/services/activeUser';
import type { AuthResponse, LoginChallengeResponse, MfaMethod, AuthUser } from '@/services/api/auth';
import { getApiErrorMessage } from '@/utils/apiError';
import { t, useTranslation } from '@/i18n';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  initiateLogin: (
    credentials: LoginCredentials
  ) => Promise<{
    success: boolean;
    mfaRequired?: boolean;
    challenge?: LoginChallengeResponse;
    passwordChangeRequired?: boolean;
    user?: User;
    error?: Error;
  }>;
  verifyMFA: (data: {
    mfaToken: string;
    otp: string;
    method: MfaMethod;
    rememberDevice?: boolean;
  }) => Promise<{ success: boolean; passwordChangeRequired?: boolean; user?: User; error?: Error }>;
  login: (credentials: LoginCredentials) => Promise<{ success: boolean; error?: Error }>;
  logout: () => Promise<void>;
  updateUser: (user: User | AuthUser) => void;
  refreshToken: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const createSafeAuthFallback = (): AuthContextType => ({
  user: null,
  loading: false,
  isAuthenticated: false,
  initiateLogin: async () => ({ success: false, error: new Error(t('auth.errors.signInUnavailable')) }),
  verifyMFA: async () => ({ success: false, error: new Error(t('auth.errors.signInUnavailable')) }),
  login: async () => ({ success: false, error: new Error(t('auth.errors.signInUnavailable')) }),
  logout: async () => undefined,
  updateUser: () => undefined,
  refreshToken: async () => false,
});

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const { t } = useTranslation();
  const MAX_PERSISTED_AVATAR_LENGTH = 4096;
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Keep a plain (non-React) pointer to the logged-in user's id in sync, so utilities like
  // src/utils/format.ts can read the current user's Regional Formats preference synchronously.
  useEffect(() => {
    if (user?.id) {
      setActiveUserId(user.id);
    } else {
      clearActiveUserId();
    }
  }, [user?.id]);

  const mapAuthUserToUser = (authUser: AuthResponse['user']): User => {
    const nameParts = authUser.fullName?.trim().split(' ') ?? [];
    return {
      id: authUser.id,
      username: authUser.username,
      employeeCode: authUser.employeeCode || '',
      email: authUser.email,
      firstName: nameParts[0] || '',
      lastName: nameParts.slice(1).join(' ') || '',
      fullName: authUser.fullName || '',
      role: authUser.role as User['role'],
      position: authUser.position || '',
      department: authUser.department || '',
      businessUnit: authUser.businessUnit || '',
      phone: authUser.phone || '',
      avatar: authUser.avatar,
      permissions: authUser.permissions ?? [],
      requirePasswordChange: authUser.requirePasswordChange,
      passwordChangeReason: authUser.passwordChangeReason,
      mfaEnabled: authUser.mfaEnabled,
      mfaEmailFallbackEnabled: authUser.mfaEmailFallbackEnabled,
      mfaRememberDeviceEnabled: authUser.mfaRememberDeviceEnabled,
      emailNotificationsEnabled: authUser.emailNotificationsEnabled,
      notificationPreferences: authUser.notificationPreferences,
      mfaSetupRequired: authUser.mfaSetupRequired,
      maintenanceMode: authUser.maintenanceMode,
      status: (authUser.status || "Active") as UserStatus,
      lastLogin: authUser.lastLoginAt || authUser.lastLogin || new Date().toISOString(),
      createdDate: authUser.createdAt || authUser.createdDate || new Date().toISOString(),
      lastUpdated: authUser.updatedAt || authUser.createdAt || authUser.createdDate || new Date().toISOString(),
    };
  };

  const buildPersistedUserSnapshot = (appUser: User): User => {
    const shouldTrimAvatar =
      typeof appUser.avatar === 'string' &&
      appUser.avatar.startsWith('data:') &&
      appUser.avatar.length > MAX_PERSISTED_AVATAR_LENGTH;

    if (!shouldTrimAvatar) {
      return appUser;
    }

    return {
      ...appUser,
      avatar: undefined,
    };
  };

  const persistAuthenticatedSession = (response: AuthResponse, appUser: User) => {
    authTokenStore.set(response.accessToken);
    secureStorage.setItem('user', JSON.stringify(buildPersistedUserSnapshot(appUser)), true);

    try {
      const csrf = csrfToken.generate();
      csrfToken.store(csrf);
    } catch (error) {
      if (import.meta.env.DEV) {
        console.warn('Unable to store CSRF token after login:', error);
      }
      auditLog.log('csrf_store_failed', { error: String(error) });
    }
  };

  const applyAuthenticatedSession = (response: AuthResponse) => {
    const appUser = mapAuthUserToUser(response.user);
    setUser(appUser);
    setIsAuthenticated(true);
    persistAuthenticatedSession(response, appUser);

    // Refresh user with full permissions (login response may not include them)
    authApi.getCurrentUser()
      .then((currentUser) => {
        const refreshedUser = mapAuthUserToUser(currentUser);
        setUser(refreshedUser);
        secureStorage.setItem('user', JSON.stringify(buildPersistedUserSnapshot(refreshedUser)), true);
      })
      .catch(() => {/* keep login-response user if refresh fails */});

    return appUser;
  };

  // Check authentication status on mount with security checks
  useEffect(() => {
    const checkAuth = async () => {
    try {
      const storedUser = secureStorage.getItem('user', true);

        if (storedUser) {
          try {
            // Parse user first to ensure it's valid JSON
            const parsedUser = JSON.parse(storedUser);

            // Set authenticated state
            setUser(parsedUser);
            setIsAuthenticated(true);

            // Generate CSRF token
            const csrf = csrfToken.generate();
            csrfToken.store(csrf);

            auditLog.log('session_restored', { userId: parsedUser.id });

            try {
              if (!authTokenStore.get()) {
                const refreshedTokens = await authApi.refreshToken();
                authTokenStore.set(refreshedTokens.accessToken);
              }
              const currentUser = await authApi.getCurrentUser();
              const appUser = mapAuthUserToUser(currentUser);
              setUser(appUser);
              secureStorage.setItem('user', JSON.stringify(appUser), true);
            } catch (refreshError) {
              if (import.meta.env.DEV) console.warn('Unable to refresh current user from backend:', refreshError);
              secureStorage.removeItem('authToken');
              secureStorage.removeItem('refreshToken');
              secureStorage.removeItem('user');
              authTokenStore.clear();
              setUser(null);
              setIsAuthenticated(false);
            }
          } catch (parseError) {
            // JSON parse error - clear corrupted data
            if (import.meta.env.DEV) console.error('Error parsing stored user:', parseError);
            auditLog.log('auth_parse_error', { error: String(parseError) });
            secureStorage.removeItem('user');
          }
        } else if (authTokenStore.get()) {
          try {
            const currentUser = await authApi.getCurrentUser();
            const appUser = mapAuthUserToUser(currentUser);
            setUser(appUser);
            setIsAuthenticated(true);
            secureStorage.setItem('user', JSON.stringify(buildPersistedUserSnapshot(appUser)), true);
          } catch (bootstrapError) {
            if (import.meta.env.DEV) console.warn('Unable to bootstrap user from active access token:', bootstrapError);
            authTokenStore.clear();
            secureStorage.removeItem('authToken');
            secureStorage.removeItem('refreshToken');
            secureStorage.removeItem('user');
            setUser(null);
            setIsAuthenticated(false);
          }
        }
      } catch (decryptError) {
        // Decryption error - clear potentially corrupted storage
        if (import.meta.env.DEV) console.error('Decryption error:', decryptError);
        auditLog.log('auth_decrypt_error', { error: String(decryptError) });
        secureStorage.removeItem('user');
        authTokenStore.clear();
      } finally {
        // Always set loading to false
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  const initiateLogin: AuthContextType['initiateLogin'] = async (credentials) => {
    try {
      const result = await authApi.loginWithChallenge(credentials);

      if ('mfaRequired' in result && result.mfaRequired) {
        auditLog.log('login_challenge_created', {
          username: credentials.username,
          methods: result.availableMethods,
        });

      return {
        success: true,
        mfaRequired: true,
        challenge: result,
      };
      }

      const appUser = applyAuthenticatedSession(result as AuthResponse);

      auditLog.log('login_success', {
        userId: appUser.id,
        role: appUser.role,
      });

      return { success: true, mfaRequired: false, passwordChangeRequired: Boolean(appUser.requirePasswordChange), user: appUser };
    } catch (error) {
      auditLog.log('login_failed', { 
        username: credentials.username,
        error: String(error) 
      });
      return { success: false, error: new Error(getApiErrorMessage(error, t('auth.errors.signInUnavailable'))) };
    }
  };

  const verifyMFA: AuthContextType['verifyMFA'] = async ({ mfaToken, otp, method, rememberDevice }) => {
    try {
      const response = await authApi.verifyMFA({
        mfaToken,
        otp,
        method,
        rememberDevice,
      });
      const appUser = applyAuthenticatedSession(response);

      auditLog.log('mfa_verify_success', {
        userId: appUser.id,
        method,
        rememberDevice: Boolean(rememberDevice),
      });

      return {
        success: true,
        passwordChangeRequired: Boolean(response.user.requirePasswordChange),
        user: appUser,
      };
    } catch (error) {
      auditLog.log('mfa_verify_failed', {
        mfaToken,
        method,
        error: String(error),
      });
      return { success: false, error: new Error(getApiErrorMessage(error, t('auth.errors.signInUnavailable'))) };
    }
  };

  const login = async (credentials: LoginCredentials) => {
    const result = await initiateLogin(credentials);

    if (!result.success) {
      return { success: false, error: result.error };
    }

    if (result.mfaRequired) {
      return { success: false, error: new Error('MFA_REQUIRED') };
    }

    return { success: true };
  };

  const logout = async () => {
    try {
      await authApi.signOut();
      auditLog.log('logout_success', { userId: user?.id });
    } catch (error) {
      if (import.meta.env.DEV) console.error('Logout error:', error);
      auditLog.log('logout_error', { error: String(error) });
    } finally {
      // Clear all secure storage
    secureStorage.removeItem('authToken');
    secureStorage.removeItem('refreshToken');
    secureStorage.removeItem('user');
    authTokenStore.clear();
    csrfToken.store(''); // Clear CSRF
      
      setUser(null);
      setIsAuthenticated(false);
    }
  };

  const updateUser = (updatedUser: User | AuthUser) => {
    const isFullUser = 'createdDate' in updatedUser && 'employeeCode' in updatedUser && updatedUser.employeeCode !== undefined;
    const appUser = isFullUser ? (updatedUser as User) : mapAuthUserToUser(updatedUser as AuthUser);
    setUser(appUser);
    secureStorage.setItem('user', JSON.stringify(buildPersistedUserSnapshot(appUser)), true);
    auditLog.log('user_updated', { userId: appUser.id });
  };

  const refreshToken = async (): Promise<boolean> => {
    try {
      const response = await authApi.refreshToken();
      authTokenStore.set(response.accessToken);
      
      auditLog.log('token_refreshed', { userId: user?.id });
      return true;
    } catch (error) {
      auditLog.log('token_refresh_failed', { error: String(error) });
      return false;
    }
  };

  const value: AuthContextType = {
    user,
    loading,
    isAuthenticated,
    initiateLogin,
    verifyMFA,
    login,
    logout,
    updateUser,
    refreshToken,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// Custom hook to use auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    if (import.meta.env.DEV) {
      console.error('useAuth must be used within an AuthProvider. Falling back to a safe no-op auth context.');
    }
    return createSafeAuthFallback();
  }
  return context;
};
