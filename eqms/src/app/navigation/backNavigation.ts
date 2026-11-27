import { useCallback } from "react";
import { rememberedBackNavigation } from "./viewNavigation";

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
  const remembered = rememberedBackNavigation(pickBackTarget(state) ?? undefined);
  const target = remembered?.href;

  if (target) {
    if (remembered?.state) navigate(target, { state: remembered.state });
    else navigate(target);
    return;
  }

  if (typeof window !== "undefined" && window.history.length > 1) {
    navigate(-1);
    return;
  }

  const fallback = rememberedBackNavigation(fallbackRoute);
  navigate(fallback?.href ?? fallbackRoute, { replace: true, ...(fallback?.state ? { state: fallback.state } : {}) });
};

export const useBackNavigation = (
  navigate: BackNavigationHandler,
  state: BackNavigationLocationState | null | undefined,
  fallbackRoute: string,
) =>
  useCallback(() => {
    navigateBack(navigate, state, fallbackRoute);
  }, [navigate, state, fallbackRoute]);
