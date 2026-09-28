import React, { useRef } from "react";
import { Plus } from "lucide-react";
import { useNavigate, useLocation, Navigate } from "react-router-dom";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { Button } from "@/components/ui/button/Button";
import { dictionaries } from "@/components/ui/breadcrumb/breadcrumbs.config";
import { usePermissions } from "@/hooks/usePermissions";
import { ROUTES } from "@/app/routes.constants";
import type { DictionaryType, Dictionary } from "./types";
import { BusinessUnitsTab } from "./tabs/BusinessUnitsTab";
import { DepartmentsTab } from "./tabs/DepartmentsTab";
import { PositionsTab } from "./tabs/PositionsTab";
import { StorageLocationsTab } from "./tabs/StorageLocationsTab";
import { RetentionPoliciesTab } from "./tabs/RetentionPoliciesTab";

// Order here is the left-to-right order of the old tab strip, now the top-to-bottom order of
// the "Dictionaries" nav group's child menu items (NavigationService.java is authoritative;
// navigation.ts mirrors it) -- each dictionary is its own page/menu entry instead of a tab.
const DICTIONARIES: Dictionary[] = [
  { id: "business-units", label: "Business Units" },
  { id: "departments", label: "Departments" },
  { id: "positions", label: "Positions" },
  { id: "storage-locations", label: "Storage Locations" },
  { id: "retention-policies", label: "Retention Policies" },
];

/** One page per dictionary category. The Dictionaries sub-routes are separate literal paths
 *  (`dictionaries/business-units`, `dictionaries/departments`, ...) rather than a single
 *  `:category` dynamic route, so the active category is derived from the URL's last path
 *  segment -- replaces the old single-page TabNav-switched view now that each dictionary has
 *  its own menu entry. */
export const DictionariesView: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const category = location.pathname.split("/").filter(Boolean).pop();
  const { hasPermissionAlias } = usePermissions();
  const tabRef = useRef<{ openAddModal: () => void }>(null);

  const activeDictionary = DICTIONARIES.find((d) => d.id === category);
  if (!activeDictionary) {
    return <Navigate to={ROUTES.SETTINGS.DICTIONARIES_BUSINESS_UNITS} replace />;
  }

  const managePermissionByCategory: Record<DictionaryType, string> = {
    "business-units": "settings.business_unit.manage",
    departments: "settings.department.manage",
    positions: "settings.position.manage",
    "storage-locations": "settings.storage_location.manage",
    "retention-policies": "settings.retention_policy.manage",
  };
  const canManage = hasPermissionAlias(managePermissionByCategory[activeDictionary.id as DictionaryType]);

  const renderContent = () => {
    switch (activeDictionary.id as DictionaryType) {
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

  return (
    <div className="h-full flex flex-col gap-6">
      <PageHeader
        title={activeDictionary.label}
        breadcrumbItems={dictionaries(navigate, activeDictionary.label)}
        actions={
          canManage ? (
            <Button
              size="sm"
              onClick={handleAddNew}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700"
            >
              <Plus className="h-4 w-4" />
              Add New {activeDictionary.label}
            </Button>
          ) : undefined
        }
      />

      <div className="flex-1 flex flex-col min-h-0">
        <div className="flex-1 flex flex-col bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="flex-1 overflow-auto p-4 md:p-5">
            {renderContent()}
          </div>
        </div>
      </div>
    </div>
  );
};
