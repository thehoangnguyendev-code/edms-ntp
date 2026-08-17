import React, { useCallback, useRef, useState } from "react";
import { ESignatureModal } from "@/components/ui/esign-modal/ESignatureModal";

export interface SecuritySignature {
  signatureToken: string;
  reason?: string;
}

interface PendingRequest {
  actionTitle: string;
  meaningDisplayName?: string;
  meaningCode?: string;
  resolve: (sig: SecuritySignature | null) => void;
}

// Callers pass one of these fixed category labels as `meaningDisplayName`; map each to the
// matching backend-seeded meaning code (SecurityChangeSignatureService constants) so the
// signing modal fetches and reflects the admin-configured display name for that category.
const MEANING_CODE_BY_DISPLAY_NAME: Record<string, string> = {
  "Security Configuration Change": "SECURITY_CONFIGURATION_CHANGE",
  "User Access Change": "USER_ACCESS_CHANGE",
  "Access Profile Change": "ACCESS_PROFILE_CHANGE",
  "Permission Set Change": "PERMISSION_SET_CHANGE",
  "Workflow Authorization Change": "WORKFLOW_AUTHORIZATION_CHANGE",
  "SoD Rule Change": "SOD_RULE_CHANGE",
  "Audit Trail Review": "AUDIT_TRAIL_REVIEW",
};

/**
 * Reusable e-signature gate for critical security administration changes
 * (RBAC master plan section 16). Usage:
 *
 *   const { requestSignature, signatureModal } = useSecurityESign();
 *   const sig = await requestSignature("Update Access Profile");
 *   if (!sig) return; // user cancelled
 *   await settingsApi.updateAccessProfile(id, payload, sig);
 *   ...render {signatureModal} once in the component tree.
 */
export function useSecurityESign() {
  const [pending, setPending] = useState<PendingRequest | null>(null);
  const pendingRef = useRef<PendingRequest | null>(null);

  const requestSignature = useCallback(
    (actionTitle: string, meaningDisplayName?: string): Promise<SecuritySignature | null> =>
      new Promise((resolve) => {
        const meaningCode = meaningDisplayName ? MEANING_CODE_BY_DISPLAY_NAME[meaningDisplayName] : undefined;
        const req: PendingRequest = { actionTitle, meaningDisplayName, meaningCode, resolve };
        pendingRef.current = req;
        setPending(req);
      }),
    [],
  );

  const settle = useCallback((sig: SecuritySignature | null) => {
    pendingRef.current?.resolve(sig);
    pendingRef.current = null;
    setPending(null);
  }, []);

  const signatureModal = pending ? (
    <ESignatureModal
      isOpen
      onClose={() => settle(null)}
      onConfirm={(data: any) =>
        settle({ signatureToken: data.signatureToken, reason: data.reason || undefined })
      }
      actionTitle={pending.actionTitle}
      meaningDisplayName={pending.meaningDisplayName ?? "Security Configuration Change"}
      meaningCode={pending.meaningCode ?? "SECURITY_CONFIGURATION_CHANGE"}
    />
  ) : null;

  return { requestSignature, signatureModal };
}
