import { tr } from "@/i18n";
import React from "react";
import { TabNav } from "@/components/ui/tabs/TabNav";

export type LegacyImportTabId = "document" | "training" | "revisions";

interface LegacyImportTabNavigationProps {
  activeTab: LegacyImportTabId;
  isTemplate: boolean;
  revisionCount: number;
  onChange: (tab: LegacyImportTabId) => void;
}

export const LegacyImportTabNavigation: React.FC<LegacyImportTabNavigationProps> = ({
  activeTab,
  isTemplate,
  revisionCount,
  onChange,
}) => (
  <TabNav
    tabs={[
      { id: "document", label: tr("Document Information") },
      ...(isTemplate ? [] : [{ id: "training", label: tr("Training Requirement") }]),
      { id: "revisions", label: tr("Revision History"), count: revisionCount || undefined },
    ]}
    activeTab={activeTab}
    onChange={(id) => onChange(id as LegacyImportTabId)}
  />
);
