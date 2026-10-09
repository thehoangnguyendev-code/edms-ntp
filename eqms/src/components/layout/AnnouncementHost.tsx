import React, { useCallback, useEffect, useRef, useState } from "react";
import { AnnouncementModal } from "@/components/ui/announcement-modal";
import { useAuth } from "@/contexts/AuthContext";
import { announcementApi } from "@/services/api/announcements";
import type { ActiveAnnouncement } from "@/features/settings/announcements/types";
import { dismissAnnouncement, getDismissedAnnouncementIds } from "./announcementDismissal";

/** How often the list is refreshed while the user stays signed in, so a new or ended announcement is picked up. */
const REFRESH_MS = 5 * 60 * 1000;

/**
 * Shows the announcements that are active right now, one at a time, in a modal in the centre of the screen after a user
 * signs in. Closing one shows the next; a closed announcement stays closed until the next sign-in. A failure to load
 * announcements is silent: it must never get in the way of working in the system.
 */
export const AnnouncementHost: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const [announcements, setAnnouncements] = useState<ActiveAnnouncement[]>([]);
  const [dismissed, setDismissed] = useState<string[]>(() => getDismissedAnnouncementIds());
  const [closedHere, setClosedHere] = useState(0);
  const lastShown = useRef<ActiveAnnouncement | undefined>(undefined);

  useEffect(() => {
    if (!isAuthenticated) {
      setAnnouncements([]);
      return undefined;
    }
    let cancelled = false;
    const load = () => {
      announcementApi
        .getActive()
        .then((items) => {
          if (!cancelled) setAnnouncements(Array.isArray(items) ? items : []);
        })
        .catch(() => {
          /* keep what is known; announcements are never critical to the page */
        });
    };
    setDismissed(getDismissedAnnouncementIds());
    setClosedHere(0);
    load();
    const timer = window.setInterval(load, REFRESH_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [isAuthenticated]);

  const pending = announcements.filter((item) => !dismissed.includes(item.id));
  const current = pending[0];
  if (current) lastShown.current = current;
  // While the dialog fades out the last announcement is kept, so it does not go blank before it disappears.
  const shown = current ?? lastShown.current;

  const close = useCallback((id: string) => {
    dismissAnnouncement(id);
    setDismissed((previous) => (previous.includes(id) ? previous : [...previous, id]));
    setClosedHere((count) => count + 1);
  }, []);

  if (!shown) return null;
  return (
    <AnnouncementModal
      open={Boolean(current)}
      title={shown.title}
      message={shown.message}
      severity={shown.severity}
      position={closedHere + 1}
      total={pending.length + closedHere}
      onClose={() => close(shown.id)}
    />
  );
};
