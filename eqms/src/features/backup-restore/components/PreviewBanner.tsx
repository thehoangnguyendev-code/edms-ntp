import React from "react";
import { WarningBanner } from "@/components/ui/banner/WarningBanner";
import { tr } from "@/i18n";

/** Shown on every Backup & Restore screen while the data is sample data and no action reaches a server. */
export const PreviewBanner: React.FC<{ className?: string }> = ({ className }) => (
  <WarningBanner
    variant="info"
    className={className}
    title={tr("Design preview")}
    description={tr("The figures on this page are sample data and the buttons do not run a backup or a restore. Nothing here is a record of your system.")}
  />
);
