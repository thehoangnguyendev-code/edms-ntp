import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { TabNav, type TabItem } from "@/components/ui/tabs/TabNav";
import { trainingBreadcrumbs, TRAINING_PAGES } from "../shared/trainingLabels";
import { ExportsPersonalTab } from "./tabs/ExportsPersonalTab";
import { ExportsBatchesTab } from "./tabs/ExportsBatchesTab";

const TABS: TabItem[] = [
  { id: "personal", label: "One person" },
  { id: "batches", label: "Department and year" },
];

/** Exports of personal training records (APD.0014): one person at a time, or a whole department for a year. Both are prepared and approved with signatures by two people. */
export function TrainingRecordExportsView() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [tab, setTab] = useState(searchParams.get("tab") === "batches" ? "batches" : "personal");
  const changeTab = (id: string) => {
    if (id === tab) return;
    setSearchParams(id === "personal" ? {} : { tab: id }, { replace: true });
    setTab(id);
  };
  return (
    <div className="flex min-w-0 flex-col gap-4 md:gap-6">
      <PageHeader title={TRAINING_PAGES.exports.title} breadcrumbItems={trainingBreadcrumbs(navigate, "exports")} />
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <TabNav tabs={TABS} activeTab={tab} onChange={changeTab} variant="underline" ariaLabel="Record exports" tabIdPrefix="exports-tab" panelIdPrefix="exports-panel" />
        <div className="p-4 md:p-5">
          <div id={`exports-panel-${tab}`} role="tabpanel" aria-labelledby={`exports-tab-${tab}`} className="min-w-0">
            {tab === "personal" && <ExportsPersonalTab />}
            {tab === "batches" && <ExportsBatchesTab />}
          </div>
        </div>
      </div>
    </div>
  );
}
