import React, { useState, useRef, useEffect } from "react";
import {
  Plus,
} from "lucide-react";
import { TabNav } from "@/components/ui/tabs/TabNav";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { Button } from "@/components/ui/button/Button";
import { FullPageLoading } from "@/components/ui/loading/Loading";
import { dictionaries } from "@/components/ui/breadcrumb/breadcrumbs.config";
import { usePermissions } from "@/hooks/usePermissions";
import type { DictionaryType, Dictionary } from "./types";
import { DocumentTypesTab } from "./tabs/DocumentTypesTab";
import { SubTypesTab } from "./tabs/SubTypesTab";
import { BusinessUnitsTab } from "./tabs/BusinessUnitsTab";
import { DepartmentsTab } from "./tabs/DepartmentsTab";
import { PositionsTab } from "./tabs/PositionsTab";
import { StorageLocationsTab } from "./tabs/StorageLocationsTab";
import { RetentionPoliciesTab } from "./tabs/RetentionPoliciesTab";

// --- Tab Configuration ---
const DICTIONARIES: Dictionary[] = [
  {
    id: "document-types",
    label: "Document Types",
  },
  {
    id: "sub-types",
    label: "Sub-Types",
  },
  {
    id: "business-units",
    label: "Business Units",
  },
  {
    id: "departments",
    label: "Departments",
  },
  {
    id: "positions",
    label: "Positions",
  },
  {
    id: "storage-locations",
    label: "Storage Locations",
  },
  {
    id: "retention-policies",
    label: "Retention Policies",
  },
];

export const DictionariesView: React.FC = () => {
  const navigate = useNavigate();
  const { hasPermissionAlias } = usePermissions();
  const canManage = hasPermissionAlias("settings.dictionary.manage");
  const [selectedDictionary, setSelectedDictionary] = useState<DictionaryType>("document-types");
  const tabRef = useRef<{ openAddModal: () => void }>(null);
  const [isMountLoading, setIsMountLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsMountLoading(false);
    }, 800);
    return () => clearTimeout(timer);
  }, []);

  const activeDictionaryLabel = DICTIONARIES.find(d => d.id === selectedDictionary)?.label || "";

  // Render active tab content
  const renderTabContent = () => {
    switch (selectedDictionary) {
      case "document-types":
        return <DocumentTypesTab ref={tabRef} />;
      case "sub-types":
        return <SubTypesTab ref={tabRef} />;
      case "business-units":
        return <BusinessUnitsTab ref={tabRef} />;
      case "departments":
        return <DepartmentsTab ref={tabRef} />;
      case "positions":
        return <PositionsTab ref={tabRef} />;
      case "storage-locations":
        return <StorageLocationsTab ref={tabRef} />;
      case "retention-policies":
        return <RetentionPoliciesTab ref={tabRef} />;
      default:
        return null;
    }
  };

  const handleAddNew = () => {
    tabRef.current?.openAddModal();
  };

  if (isMountLoading) {
    return <FullPageLoading text="Loading Dictionaries..." />;
  }

  return (
    <div className="h-full flex flex-col gap-6">
      <PageHeader
        title="Dictionaries"
        breadcrumbItems={dictionaries(navigate, DICTIONARIES.find(d => d.id === selectedDictionary)?.label)}
        actions={
          canManage ? (
            <Button
              size="sm"
              onClick={handleAddNew}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700"
            >
              <Plus className="h-4 w-4" />
              Add New {activeDictionaryLabel}
            </Button>
          ) : undefined
        }
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* Tabs & Content Combined */}
        <div className="flex-1 flex flex-col bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Tab Navigation */}
          <TabNav tabs={DICTIONARIES} activeTab={selectedDictionary} onChange={(id) => setSelectedDictionary(id as DictionaryType)} />

          {/* Tab Content */}
          <div className="flex-1 overflow-auto p-4 md:p-5">
            {renderTabContent()}
          </div>
        </div>
      </div>
    </div>
  );
};
