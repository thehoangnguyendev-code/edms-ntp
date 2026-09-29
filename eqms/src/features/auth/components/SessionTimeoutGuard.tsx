import React, { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { authApi } from "@/services/api/auth";
import { settingsApi } from "@/services/api/settings";
import { SECURITY_CONFIG_STORAGE_KEY } from "@/config/security";
import { subscribeNotificationRealtime } from "@/features/notifications/notificationRealtime";
import { SessionTimeoutModal } from "./SessionTimeoutModal";

const HEARTBEAT_THROTTLE_MS = 30_000;

/**
 * Real-interaction heartbeat + idle-lock tracking, shared by every screen the user can be
 * authenticated on -- including routes rendered outside MainLayout (no sidebar/header/footer),
 * which would otherwise never call authApi.touchSession() and so would silently accumulate
 * server-side idle time while the user is genuinely active (see AuthTokenFilter.java: the server
 * only trusts this heartbeat, deliberately not background polling, as "the user is active").
 * Mount this once per standalone page; MainLayout already mounts it for every route under it.
 */
export const SessionTimeoutGuard: React.FC = () => {
  const { user, logout, isAuthenticated } = useAuth();
  const heartbeatInFlightRef = useRef<Promise<void> | null>(null);
  const lastHeartbeatAtRef = useRef(0);
  const sessionLockedRef = useRef(false);
  const lastActivityAtRef = useRef(Date.now());

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }
    let isActive = true;
    const hydrateSecurityConfig = async () => {
      try {
        const config = await settingsApi.getSystemConfiguration();
        if (!isActive) return;
        window.localStorage.setItem(SECURITY_CONFIG_STORAGE_KEY, JSON.stringify(config));
        window.dispatchEvent(new Event("eqms:security-config-updated"));
      } catch {
        // Keep using any previously cached configuration if the request fails.
      }
    };
    void hydrateSecurityConfig();
    // A Security tab save (Save Changes) commits, then broadcasts this event to every open
    // browser -- re-hydrate immediately instead of waiting for this tab's next reload.
    const unsubscribeRealtime = subscribeNotificationRealtime((event) => {
      if (event.type === "security-config-updated") {
        void hydrateSecurityConfig();
      }
    });
    return () => {
      isActive = false;
      unsubscribeRealtime();
    };
  }, [isAuthenticated]);

  const sendHeartbeat = useCallback(async (force = false) => {
    if (!isAuthenticated || sessionLockedRef.current) {
      return;
    }
    const now = Date.now();
    if (!force && now - lastHeartbeatAtRef.current < HEARTBEAT_THROTTLE_MS) {
      return;
    }
    if (heartbeatInFlightRef.current) {
      return heartbeatInFlightRef.current;
    }
    const heartbeatPromise = authApi
      .touchSession()
      .catch((error) => {
        if (import.meta.env.DEV) {
          console.error("Heartbeat failed:", error);
        }
      })
      .finally(() => {
        heartbeatInFlightRef.current = null;
        lastHeartbeatAtRef.current = Date.now();
      });
    heartbeatInFlightRef.current = heartbeatPromise;
    return heartbeatPromise;
  }, [isAuthenticated]);

  const [sessionTimeoutMinutes, setSessionTimeoutMinutes] = useState(() => {
    try {
      const raw = localStorage.getItem(SECURITY_CONFIG_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        const val = Number(parsed?.security?.sessionTimeoutMinutes);
        if (Number.isFinite(val) && val >= 1 && val <= 1440) {
          return val;
        }
      }
    } catch {
      // ignore
    }
    return 30;
  });

  useEffect(() => {
    const handleConfigUpdated = () => {
      try {
        const raw = localStorage.getItem(SECURITY_CONFIG_STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          const val = Number(parsed?.security?.sessionTimeoutMinutes);
          if (Number.isFinite(val) && val >= 1 && val <= 1440) {
            setSessionTimeoutMinutes(val);
          }
        }
      } catch {
        // ignore
      }
    };
    window.addEventListener("eqms:security-config-updated", handleConfigUpdated);
    return () => window.removeEventListener("eqms:security-config-updated", handleConfigUpdated);
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }
    const checkInactivity = setInterval(() => {
      if (sessionLockedRef.current) {
        return;
      }
      const elapsedMinutes = (Date.now() - lastActivityAtRef.current) / (1000 * 60);
      if (elapsedMinutes >= sessionTimeoutMinutes) {
        sessionLockedRef.current = true;
        window.dispatchEvent(new Event("eqms:session-locked"));
      }
    }, 5000);
    return () => clearInterval(checkInactivity);
  }, [isAuthenticated, sessionTimeoutMinutes]);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }
    sessionLockedRef.current = false;
    lastActivityAtRef.current = Date.now();
    lastHeartbeatAtRef.current = Date.now();
    void sendHeartbeat(true);

    const activityEvents = ["mousedown", "keydown", "scroll", "touchstart", "pointerdown", "input", "click"];
    const handleActivity = () => {
      lastActivityAtRef.current = Date.now();
      void sendHeartbeat();
    };
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        lastActivityAtRef.current = Date.now();
        void sendHeartbeat(true);
      }
    };
    const handleSessionLocked = () => {
      sessionLockedRef.current = true;
    };
    const handleSessionUnlocked = () => {
      sessionLockedRef.current = false;
      lastActivityAtRef.current = Date.now();
      lastHeartbeatAtRef.current = Date.now();
    };

    window.addEventListener("eqms:session-locked", handleSessionLocked as EventListener);
    window.addEventListener("eqms:session-unlocked", handleSessionUnlocked as EventListener);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    activityEvents.forEach((event) => {
      document.addEventListener(event, handleActivity, { passive: true });
    });

    return () => {
      window.removeEventListener("eqms:session-locked", handleSessionLocked as EventListener);
      window.removeEventListener("eqms:session-unlocked", handleSessionUnlocked as EventListener);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      activityEvents.forEach((event) => {
        document.removeEventListener(event, handleActivity);
      });
    };
  }, [isAuthenticated, sendHeartbeat]);

  return (
    <SessionTimeoutModal
      isAuthenticated={isAuthenticated}
      username={user?.username}
      logout={logout}
    />
  );
};
