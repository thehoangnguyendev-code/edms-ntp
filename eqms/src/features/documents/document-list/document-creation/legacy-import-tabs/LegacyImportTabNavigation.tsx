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
      { id: "document", label: "Document Information" },
      ...(isTemplate ? [] : [{ id: "training", label: "Training Requirement" }]),
      { id: "revisions", label: "Revision History", count: revisionCount || undefined },
    ]}
    activeTab={activeTab}
    onChange={(id) => onChange(id as LegacyImportTabId)}
  />
);
