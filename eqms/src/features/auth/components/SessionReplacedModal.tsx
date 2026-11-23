import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertModal } from "@/components/ui/modal/AlertModal";
import { ROUTES } from "@/app/routes.constants";
import { dispatchSessionEnded, dispatchSessionReplaced, SESSION_REPLACED_EVENT } from "@/app/navigation/routeRedirect";
import { subscribeNotificationRealtime } from "@/features/notifications/notificationRealtime";
import { authTokenStore } from "@/services/authTokenStore";
import { secureStorage } from "@/utils/security";
import { tr } from "@/i18n";

const SESSION_REVOKED_STREAM_EVENT = "session-revoked";
const SESSION_UNLOCKED_EVENT = "eqms:session-unlocked";

export const SESSION_REPLACED_MESSAGE = "This session has ended because the account was signed in on another device.";

/** The id of this browser's session, read from the access token's `sid` claim (not a secret: the server never trusts it). */
export const currentSessionId = (): string | null => {
  const token = authTokenStore.get() ?? secureStorage.getItem("authToken");
  const payload = token?.split(".")[1];
  if (!payload) return null;
  try {
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(payload.length / 4) * 4, "="));
    const sid = (JSON.parse(json) as { sid?: unknown }).sid;
    return typeof sid === "string" ? sid : null;
  } catch {
    return null;
  }
};

interface SessionReplacedModalProps {
  isAuthenticated: boolean;
}

/**
 * Tells a person that the account signed in somewhere else and this session is over, then signs this browser out.
 * Three things can raise it: the server pushes the ended session id (fastest), a request is refused with the code
 * SESSION_REVOKED_CONCURRENT_LIMIT, or the background check finds the same refusal. The modal has one button; it cannot be
 * dismissed any other way, and nothing behind it can be used.
 */
export const SessionReplacedModal: React.FC<SessionReplacedModalProps> = ({ isAuthenticated }) => {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const open = () => setIsOpen(true);
    window.addEventListener(SESSION_REPLACED_EVENT, open);
    return () => window.removeEventListener(SESSION_REPLACED_EVENT, open);
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return undefined;
    return subscribeNotificationRealtime((event) => {
      if (event.type !== SESSION_REVOKED_STREAM_EVENT) return;
      try {
        const payload = JSON.parse(event.data) as { sessionIds?: unknown };
        const mine = currentSessionId();
        if (mine && Array.isArray(payload.sessionIds) && payload.sessionIds.includes(mine)) {
          dispatchSessionReplaced();
        }
      } catch {
        // malformed event: the next request or the background check still finds out
      }
    });
  }, [isAuthenticated]);

  // The page behind the modal cannot be used or scrolled while it is open.
  useEffect(() => {
    if (!isOpen) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const signOut = () => {
    authTokenStore.clear();
    ["authToken", "refreshToken", "user", "mfaToken", "trustedDeviceToken"].forEach((key) => secureStorage.removeItem(key));
    window.dispatchEvent(new Event(SESSION_UNLOCKED_EVENT));
    dispatchSessionEnded();
    setIsOpen(false);
    navigate(ROUTES.LOGIN, { replace: true });
  };

  // Every way of closing the dialog (OK, the X, Escape, the backdrop) ends the session in this browser: there is nothing else to do.
  return (
    <AlertModal
      isOpen={isOpen}
      type="info"
      title={tr("Signed Out")}
      description={SESSION_REPLACED_MESSAGE}
      confirmText="OK"
      showCancel={false}
      onConfirm={signOut}
      onClose={signOut}
    />
  );
};
