import { useCallback } from "react";

export interface BackNavigationLocationState {
  from?: string;
  returnTo?: string;
  workspaceReturnPath?: string;
  workspaceState?: {
    from?: string;
    returnTo?: string;
    workspaceReturnPath?: string;
  } | null;
}

export type BackNavigationHandler = (to: any, options?: any) => void;

const pickBackTarget = (state?: BackNavigationLocationState | null) => {
  const workspaceState = state?.workspaceState ?? null;
  const target =
    workspaceState?.workspaceReturnPath ||
    workspaceState?.returnTo ||
    workspaceState?.from ||
    state?.workspaceReturnPath ||
    state?.returnTo ||
    state?.from;

  return target && target.trim() ? target : null;
};

export const navigateBack = (
  navigate: BackNavigationHandler,
  state: BackNavigationLocationState | null | undefined,
  fallbackRoute: string,
) => {
  const target = pickBackTarget(state);

  if (target) {
    navigate(target);
    return;
  }

  if (typeof window !== "undefined" && window.history.length > 1) {
    navigate(-1);
    return;
  }

  navigate(fallbackRoute, { replace: true });
};

export const useBackNavigation = (
  navigate: BackNavigationHandler,
  state: BackNavigationLocationState | null | undefined,
  fallbackRoute: string,
) =>
  useCallback(() => {
    navigateBack(navigate, state, fallbackRoute);
  }, [navigate, state, fallbackRoute]);
