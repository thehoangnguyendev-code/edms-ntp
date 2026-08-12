import type { ControlledCopy } from "./types";

export type ControlledCopyRouteState = {
  from?: string;
  returnTo?: string;
  workspaceReturnPath?: string;
  type?: "Lost" | "Damaged";
  preloadedControlledCopy?: ControlledCopy | null;
  preloadedControlledCopySnapshot?: boolean;
};

export const buildControlledCopyRouteState = (
  state: ControlledCopyRouteState,
): ControlledCopyRouteState => ({
  ...state,
});

