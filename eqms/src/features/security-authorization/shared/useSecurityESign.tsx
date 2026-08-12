import React, { useCallback, useRef, useState } from "react";
import { ESignatureModal } from "@/components/ui/esign-modal/ESignatureModal";

export interface SecuritySignature {
  signatureToken: string;
  reason?: string;
}

interface PendingRequest {
  actionTitle: string;
  meaningDisplayName?: string;
  resolve: (sig: SecuritySignature | null) => void;
}

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
        const req: PendingRequest = { actionTitle, meaningDisplayName, resolve };
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
      requiresReason
    />
  ) : null;

  return { requestSignature, signatureModal };
}
