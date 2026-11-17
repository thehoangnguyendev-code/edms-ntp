import { useBranding } from "@/components/branding/BrandLogo";
import { AUTH_UI, SPLIT_AUTH_UI } from "./auth-ui";

/** True when the administrator chose the Split sign-in design (Configuration > General). */
export const useIsSplitAuth = (): boolean => useBranding().loginLayout === "SPLIT";

/** The class strings of the sign-in design the administrator chose, the same for every authentication screen. */
export const useAuthUi = (): Record<keyof typeof AUTH_UI, string> => (useIsSplitAuth() ? SPLIT_AUTH_UI : AUTH_UI);
