import React, { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { AlertModal } from "@/components/ui/modal/AlertModal";
import { ROUTES } from "@/app/routes.constants";
import { useAuth } from "@/contexts/AuthContext";
import { canBypassMaintenance } from "@/utils/maintenance";
import { formatCountdown, mustSignOut } from "./maintenanceStatus";
import { useMaintenance } from "./MaintenanceStatusProvider";

/**
 * The notice to people who are signed in (SDS 11.5.2 M1-M3). It shows the time left and asks them to save their work and sign out.
 * Closing it only hides the dialog; the countdown stays in the header. When the notice runs out, this signs everyone out and sends
 * the browser to the maintenance page: the server refuses their requests from then on, so the local sign-out is what the person sees.
 */
export const MaintenanceNoticeHost: React.FC = () => {
  const maintenance = useMaintenance();
  const { logout, user } = useAuth();
  const navigate = useNavigate();
  const signingOut = useRef(false);
  const state = maintenance?.status?.state ?? "NORMAL";
  const remaining = maintenance?.remaining ?? null;
  // The administrator exception (SDS 11.5.3): a person with the maintenance bypass keeps working while the system is drained or locked.
  const exempt = canBypassMaintenance(user?.permissions);

  useEffect(() => {
    if (exempt || !mustSignOut(state) || signingOut.current) return;
    signingOut.current = true;
    // The server refuses the sign-out call while the system is locked; logout still clears this browser's session.
    void logout().finally(() => navigate(ROUTES.MAINTENANCE, { replace: true }));
  }, [state, logout, navigate, exempt]);

  if (!maintenance) return null;

  return (
    <AlertModal
      isOpen={maintenance.noticeOpen && state === "NOTICE"}
      onClose={maintenance.closeNotice}
      onConfirm={() => void logout()}
      type="warning"
      title="System maintenance"
      confirmText="Sign out now"
      cancelText="Close"
      showCancel
      description={
        <span>
          The system will be locked for maintenance in{" "}
          <strong className="tabular-nums">{remaining === null ? "—" : formatCountdown(remaining)}</strong>. Save your work and sign out
          now. When the time runs out you will be signed out automatically, and you will not be able to sign in again until the work is
          finished.
        </span>
      }
    />
  );
};
