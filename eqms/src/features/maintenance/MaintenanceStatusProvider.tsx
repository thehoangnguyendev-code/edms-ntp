import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  announcementFor,
  fetchMaintenanceStatus,
  MaintenanceStatus,
  pollIntervalMs,
  remainingSeconds,
} from "./maintenanceStatus";

interface MaintenanceContextValue {
  status: MaintenanceStatus | null;
  /** Whole seconds left in the notice, or null when there is no notice. */
  remaining: number | null;
  noticeOpen: boolean;
  openNotice: () => void;
  closeNotice: () => void;
  /** Text for the screen reader at the 5-minute and 1-minute marks. */
  announcement: string | null;
}

const MaintenanceContext = createContext<MaintenanceContextValue | null>(null);

/** Reads the maintenance window once for the whole signed-in area and shares it with the header chip and the notice dialog. */
export const MaintenanceStatusProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [status, setStatus] = useState<MaintenanceStatus | null>(null);
  const [offsetMs, setOffsetMs] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [noticeOpen, setNoticeOpen] = useState(false);
  const [announcement, setAnnouncement] = useState<string | null>(null);
  const latest = useRef<{ state: MaintenanceStatus["state"] | null; remaining: number | null }>({ state: null, remaining: null });

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const poll = async () => {
      try {
        const next = await fetchMaintenanceStatus();
        if (!alive) return;
        setOffsetMs(Date.parse(next.serverNow) - Date.now());
        setStatus(next);
        latest.current = { state: next.state, remaining: remainingSeconds(next.endsAt, Date.parse(next.serverNow) - Date.now(), Date.now()) };
      } catch {
        // keep the last known state; a failed read is not a reason to show or hide the notice
      }
      if (alive) timer = setTimeout(poll, pollIntervalMs(latest.current.state ?? "NORMAL", latest.current.remaining));
    };
    void poll();
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const remaining = status ? remainingSeconds(status.endsAt, offsetMs, now) : null;
  const state = status?.state ?? "NORMAL";

  // The notice opens by itself when it starts, and once more in its last minute if the person had closed it.
  const openedFor = useRef<string | null>(null);
  const lastMinuteOpened = useRef(false);
  useEffect(() => {
    if (state !== "NOTICE") {
      openedFor.current = null;
      lastMinuteOpened.current = false;
      setNoticeOpen(false);
      return;
    }
    const requestKey = status?.endsAt ?? "notice";
    if (openedFor.current !== requestKey) {
      openedFor.current = requestKey;
      setNoticeOpen(true);
    }
    if (remaining !== null && remaining <= 60 && !lastMinuteOpened.current) {
      lastMinuteOpened.current = true;
      setNoticeOpen(true);
    }
  }, [state, status?.endsAt, remaining]);

  useEffect(() => {
    setAnnouncement(announcementFor(remaining, state));
  }, [remaining, state]);

  const openNotice = useCallback(() => setNoticeOpen(true), []);
  const closeNotice = useCallback(() => setNoticeOpen(false), []);

  const value = useMemo<MaintenanceContextValue>(
    () => ({ status, remaining, noticeOpen, openNotice, closeNotice, announcement }),
    [status, remaining, noticeOpen, openNotice, closeNotice, announcement],
  );
  return <MaintenanceContext.Provider value={value}>{children}</MaintenanceContext.Provider>;
};

/** Null outside the provider, so a component that is shown elsewhere (tests, the login page) simply shows nothing. */
export const useMaintenance = (): MaintenanceContextValue | null => useContext(MaintenanceContext);
