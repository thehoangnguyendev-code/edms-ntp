import React, { Suspense, lazy, useEffect, useState } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';

// Layout
import { MainLayout } from '@/components/layout/main-layout';

// Auth Guard
import { ProtectedRoute } from '@/middleware/ProtectedRoute';

// Auth Context
import { useAuth } from '@/contexts/AuthContext';
import { authApi } from '@/services/api';
import type { AuthUser, LoginChallengeResponse } from '@/services/api/auth';
import { canBypassMaintenance } from '@/utils/maintenance';

// Route Constants
import { ROUTES } from './routes.constants';

// Features - Auth (eager load for login page)
import { LoginView, ForgotPasswordView, ResetPasswordView, TwoFactorView, ForcePasswordChangeView, MfaSetupView, MaintenanceModeView } from '@/features/auth';
import { UnderConstruction } from './UnderConstruction';

// Loading & Domain Routes
import { LoadingFallback } from './routes/LoadingFallback';
import { documentRoutes } from './routes/DocumentRoutes';
import { trainingRoutes } from './routes/TrainingRoutes';
import { settingsRoutes } from './routes/SettingsRoutes';
import { qualityRoutes } from './routes/QualityRoutes';
import { securityRoutes } from './routes/SecurityRoutes';
import { getApiErrorMessage } from '@/utils/apiError';
import { navigateBack } from '@/app/navigation/backNavigation';
import { ROUTE_REDIRECT_EVENT, type RouteRedirectDetail } from '@/app/navigation/routeRedirect';
import { SessionTimeoutGuard } from '@/features/auth/components';

// ==================== CORE VIEWS ====================
const DashboardView = lazy(() => import('@/features/self-service/dashboard').then(m => ({ default: m.DashboardView })));
const ControlledCopyPreviewView = lazy(() => import('@/features/documents/controlled-copies').then(m => ({ default: m.ControlledCopyPreviewView })));
const KnowledgeExplorerPage = lazy(() => import('@/features/self-service/knowledge/explorer/KnowledgeExplorerPage').then(m => ({ default: m.KnowledgeExplorerPage })));
const KnowledgeDocumentPreviewPage = lazy(() => import('@/features/self-service/knowledge/KnowledgeDocumentPreviewPage').then(m => ({ default: m.KnowledgeDocumentPreviewPage })));
const OnlyOfficeEditorPage = lazy(() => import('@/features/documents/shared/pages/OnlyOfficeEditorPage').then(m => ({ default: m.OnlyOfficeEditorPage })));
const KnowledgeView = lazy(() => import('@/features/self-service/knowledge').then(m => ({ default: m.KnowledgeView })));
const NotificationsView = lazy(() => import('@/features/notifications').then(m => ({ default: m.NotificationsView })));

// ==================== MAIN ROUTES ====================

export const AppRoutes: React.FC = () => {
  const MFA_CHALLENGE_STORAGE_KEY = 'pending_mfa_challenge';

  // Admin-set per-user preference (Settings > Users > create/edit > Account & Access Control).
  // Unrecognized/missing values fall back to Dashboard -- same as before this setting existed.
  const HOME_PAGE_ROUTES: Record<string, string> = {
    DASHBOARD: ROUTES.DASHBOARD,
    NOTIFICATIONS: ROUTES.NOTIFICATIONS,
    KNOWLEDGE: ROUTES.SELF_SERVICE.KNOWLEDGE,
  };

  const resolvePostAuthRoute = (permissions?: string[], maintenanceMode?: boolean, homePage?: string) => {
    if (maintenanceMode && !canBypassMaintenance(permissions)) {
      return ROUTES.MAINTENANCE;
    }
    return HOME_PAGE_ROUTES[homePage ?? ""] ?? ROUTES.DASHBOARD;
  };

  const resolveAuthenticatedLandingRouteForUser = (
    candidateUser?: {
      requirePasswordChange?: boolean;
      mfaSetupRequired?: boolean;
      permissions?: string[];
      maintenanceMode?: boolean;
      homePage?: string;
    } | null,
  ) => {
    if (candidateUser?.requirePasswordChange) {
      return ROUTES.FORCE_PASSWORD_CHANGE;
    }
    if (candidateUser?.mfaSetupRequired) {
      return ROUTES.MFA_SETUP;
    }
    return resolvePostAuthRoute(candidateUser?.permissions, candidateUser?.maintenanceMode, candidateUser?.homePage);
  };

  const resolveAuthenticatedLandingRoute = () => resolveAuthenticatedLandingRouteForUser(user);

  const persistChallenge = (challenge: LoginChallengeResponse) => {
    sessionStorage.setItem(
      MFA_CHALLENGE_STORAGE_KEY,
      JSON.stringify({
        challenge,
        persistedAt: Date.now(),
      })
    );
  };

  const clearPersistedChallenge = () => {
    sessionStorage.removeItem(MFA_CHALLENGE_STORAGE_KEY);
  };

  const navigate = useNavigate();
  const { initiateLogin, verifyMFA, updateUser, logout, user, isAuthenticated } = useAuth();
  const [pendingChallenge, setPendingChallenge] = useState<LoginChallengeResponse | null>(null);
  const [isChallengeHydrated, setIsChallengeHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(MFA_CHALLENGE_STORAGE_KEY);
      if (!raw) {
        setIsChallengeHydrated(true);
        return;
      }
      clearPersistedChallenge();
    } catch {
      clearPersistedChallenge();
    } finally {
      setIsChallengeHydrated(true);
    }
  }, []);

  const handleLogin = async (
    username: string,
    password: string
  ): Promise<{ success: boolean; error?: string }> => {
    const result = await initiateLogin({ username, password });

    if (!result.success) {
      return {
        success: false,
        error: result.error?.message || 'Unable to sign in. Please try again.',
      };
    }

    if (result.mfaRequired && result.challenge) {
      setPendingChallenge(result.challenge);
      persistChallenge(result.challenge);
      navigate(ROUTES.TWO_FACTOR);
      return { success: true };
    }

    setPendingChallenge(null);
    clearPersistedChallenge();

    await navigateAfterLogin(resolveAuthenticatedLandingRouteForUser(result.user));
    return { success: true };
  };

  const handleVerify2FA = async ({
    code,
    method,
    rememberDevice,
  }: {
    code: string;
    method: 'email' | 'app';
    rememberDevice: boolean;
  }): Promise<{ success: boolean; error?: string }> => {
    if (!pendingChallenge?.mfaToken) {
      return {
        success: false,
        error: 'Login session has expired. Please sign in again.',
      };
    }

    const result = await verifyMFA({
      mfaToken: pendingChallenge.mfaToken,
      otp: code,
      method,
      rememberDevice,
    });

    if (result.success) {
      setPendingChallenge(null);
      clearPersistedChallenge();
      await navigateAfterLogin(resolveAuthenticatedLandingRouteForUser(result.user));
      return { success: true };
    }

    return {
      success: false,
      error: result.error?.message || 'Verification failed. Please try again.',
    };
  };

  const handleResend2FA = async (): Promise<{ success: boolean; error?: string; cooldownSeconds?: number }> => {
    if (!pendingChallenge?.mfaToken) {
      return {
        success: false,
        error: 'Login session has expired. Please sign in again.',
      };
    }

    try {
      const response = await authApi.sendEmailOtp({ mfaToken: pendingChallenge.mfaToken });
      return { success: true, cooldownSeconds: response.cooldownSeconds };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unable to resend code right now.',
      };
    }
  };

  const handleForgotPassword = () => {
    navigate(ROUTES.FORGOT_PASSWORD);
  };

  const handleBackToLogin = () => {
    setPendingChallenge(null);
    clearPersistedChallenge();
    navigateBack(navigate, null, ROUTES.LOGIN);
  };

  const handleMfaSetupBackToLogin = async () => {
    // MFA enrollment is performed with an authenticated, restricted session.
    // Logging out first prevents the login route from immediately redirecting the
    // person back to setup and allows them to choose a different account.
    setPendingChallenge(null);
    clearPersistedChallenge();
    await logout();
    navigate(ROUTES.LOGIN, { replace: true });
  };

  const navigateAfterStateFlush = async (path: string) => {
    navigate(path);
  };

  const navigateAfterLogin = async (path: string) => {
    await navigateAfterStateFlush(path);
  };

  useEffect(() => {
    const handleRedirect = (event: Event) => {
      const detail = (event as CustomEvent<RouteRedirectDetail>).detail;
      if (!detail?.path) return;
      navigate(detail.path, { replace: detail.replace ?? true });
    };

    window.addEventListener(ROUTE_REDIRECT_EVENT, handleRedirect as EventListener);
    return () => {
      window.removeEventListener(ROUTE_REDIRECT_EVENT, handleRedirect as EventListener);
    };
  }, [navigate]);

  const handlePasswordResetRequest = async (identifier: string, reason: string) => {
    await authApi.forgotPassword({ identifier, reason });
  };

  return (
    <Routes>
      {/* ==================== PUBLIC ROUTES ==================== */}
      <Route path="/" element={<Navigate to={ROUTES.LOGIN} replace />} />
      <Route
        path={ROUTES.LOGIN}
        element={
          isAuthenticated ? (
            <Navigate to={resolveAuthenticatedLandingRoute()} replace />
          ) : (
            <LoginView onLogin={handleLogin} onForgotPassword={handleForgotPassword} />
          )
        }
      />
      <Route path={ROUTES.MAINTENANCE} element={<MaintenanceModeView />} />
      {/* Public, token-secured controlled-copy preview link (distribution emails) — intentionally
          outside ProtectedRoute/MainLayout: recipients open a PDF preview only, no system login. */}
      <Route
        path="/controlled-copy-preview/:id"
        element={
          <Suspense fallback={<LoadingFallback />}>
            <ControlledCopyPreviewView />
          </Suspense>
        }
      />
      {/* Authenticated but layout-less standalone preview page, opened in a new browser tab from
          the Knowledge Base — intentionally outside MainLayout: no sidebar/header/footer. Since
          MainLayout is what normally sends the real-interaction heartbeat and shows the idle-lock
          modal (see SessionTimeoutGuard), these routes mount that guard themselves so Session
          Timeout still applies exactly like everywhere else in the app. */}
      <Route
        path={ROUTES.DOCUMENTS.KNOWLEDGE_EXPLORER}
        element={
          <ProtectedRoute requiredPermissions={["documents.module.view"]}>
            <SessionTimeoutGuard />
            <Suspense fallback={<LoadingFallback />}>
              <KnowledgeExplorerPage />
            </Suspense>
          </ProtectedRoute>
        }
      />
      <Route
        path="/documents/knowledge/preview/:documentId"
        element={
          <ProtectedRoute>
            <SessionTimeoutGuard />
            <Suspense fallback={<LoadingFallback />}>
              <KnowledgeDocumentPreviewPage />
            </Suspense>
          </ProtectedRoute>
        }
      />
      {/* Authenticated but layout-less standalone page hosting the OnlyOffice editor, opened in a
          new browser tab by "Edit File Online"/"Open File to Comment" when OnlyOffice is the
          active provider — mirrors how Microsoft Graph's own Word Online flow opens a new tab. */}
      <Route
        path="/documents/revisions/:revisionId/onlyoffice-editor"
        element={
          <ProtectedRoute>
            <SessionTimeoutGuard />
            <Suspense fallback={<LoadingFallback />}>
              <OnlyOfficeEditorPage />
            </Suspense>
          </ProtectedRoute>
        }
      />
      {/* Authenticated but layout-less standalone preview page, opened in a new browser tab from
          the Edit History panel — intentionally outside MainLayout: no sidebar/header/footer. */}
      <Route
        path={ROUTES.TWO_FACTOR}
        element={
          !isChallengeHydrated ? (
            <LoadingFallback />
          ) : isAuthenticated ? (
            <Navigate to={resolvePostAuthRoute(user?.permissions, user?.maintenanceMode, user?.homePage)} replace />
          ) : pendingChallenge ? (
            <TwoFactorView
              onVerify={handleVerify2FA}
              onResend={handleResend2FA}
              onBackToLogin={handleBackToLogin}
              username={pendingChallenge.username}
              email={pendingChallenge.maskedEmail}
              availableMethods={pendingChallenge.availableMethods}
              rememberDeviceAllowed={pendingChallenge.rememberDeviceAllowed !== false}
            />
          ) : (
            <Navigate to={ROUTES.LOGIN} replace />
          )
        }
      />
      <Route
        path={ROUTES.FORGOT_PASSWORD}
        element={
          isAuthenticated ? (
            <Navigate to={resolveAuthenticatedLandingRoute()} replace />
          ) : (
            <ForgotPasswordView onBackToLogin={handleBackToLogin} onRequestSubmit={handlePasswordResetRequest} />
          )
        }
      />
      <Route
        path={ROUTES.RESET_PASSWORD}
        element={
          isAuthenticated ? (
            <Navigate to={resolveAuthenticatedLandingRoute()} replace />
          ) : (
            <ResetPasswordView onBackToLogin={handleBackToLogin} />
          )
        }
      />
      <Route
        path={ROUTES.FORCE_PASSWORD_CHANGE}
        element={
          <ForcePasswordChangeView
            username={user?.fullName || user?.username || "User"}
            passwordChangeReason={user?.passwordChangeReason}
            onBackToLogin={handleBackToLogin}
            onSubmit={async (data) => {
              try {
                await authApi.changePassword({
                  currentPassword: data.currentPassword,
                  newPassword: data.newPassword,
                  confirmPassword: data.confirmPassword,
                });
                const refreshedUser = await authApi.getCurrentUser();
                updateUser(refreshedUser);
                await navigateAfterStateFlush(resolveAuthenticatedLandingRouteForUser(refreshedUser));
                return { success: true };
              } catch (error) {
                const message = getApiErrorMessage(error, 'Unable to update password.');
                return {
                  success: false,
                  error: message,
                };
              }
            }}
          />
        }
      />
      <Route
        path={ROUTES.MFA_SETUP}
        element={
          isAuthenticated ? (
          <MfaSetupView
              email={user?.email || 'user@example.com'}
              onBackToLogin={handleMfaSetupBackToLogin}
              onComplete={() => navigateAfterStateFlush(resolvePostAuthRoute(user?.permissions, user?.maintenanceMode, user?.homePage))}
            />
          ) : (
            <Navigate to={ROUTES.LOGIN} replace />
          )
        }
      />

      {/* ==================== PROTECTED ROUTES (WITH LAYOUT) ==================== */}
      <Route path="/" element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>

        {/* ===== CORE ===== */}
        {/* Dashboard & Notifications are baseline surfaces for every authenticated user — auth-only guard, no permission gate (same policy as Work Management) */}
        <Route path="dashboard" element={<ProtectedRoute requiredPermissions={["dashboard.module.view"]}><Suspense fallback={<LoadingFallback />}><DashboardView /></Suspense></ProtectedRoute>} />
        <Route path="notifications" element={<ProtectedRoute requiredPermissions={["notifications.module.view"]}><Suspense fallback={<LoadingFallback />}><NotificationsView /></Suspense></ProtectedRoute>} />
        {/* Self-Service > Knowledge -- moved out of the Documents module; Dashboard above is also
            a Self-Service child but keeps its long-standing top-level /dashboard path. */}
        <Route path="self-service/knowledge" element={<ProtectedRoute requiredPermissions={["self_service.knowledge.view"]}><Suspense fallback={<LoadingFallback />}><KnowledgeView /></Suspense></ProtectedRoute>} />

        {/* ===== DOMAIN MODULES ===== */}
        {documentRoutes(navigate)}
        {trainingRoutes()}
        {settingsRoutes(navigate)}
        {qualityRoutes()}
        {securityRoutes()}

        {/* ===== FALLBACK ===== */}
        <Route path="*" element={<UnderConstruction />} />
      </Route>
    </Routes>
  );
};

