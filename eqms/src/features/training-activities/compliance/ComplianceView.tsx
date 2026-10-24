import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { TabNav, type TabItem } from "@/components/ui/tabs/TabNav";
import type { ReportSelectFilter } from "@/features/report/shared/ReportListToolbar";
import { dictionaryApi } from "@/services/api/dictionary";
import { trainingBreadcrumbs, TRAINING_PAGES } from "@/features/training-activities/shared/trainingLabels";
import { ComplianceSummaryTab } from "./tabs/ComplianceSummaryTab";
import { ComplianceCompletionTab } from "./tabs/ComplianceCompletionTab";
import { ComplianceGapsTab } from "./tabs/ComplianceGapsTab";
import { ComplianceSuspensionsTab } from "./tabs/ComplianceSuspensionsTab";
import { ComplianceRetentionTab } from "./tabs/ComplianceRetentionTab";

const TABS: TabItem[] = [
  { id: "summary", label: "Summary" },
  { id: "completion", label: "Matrix completion" },
  { id: "gaps", label: "Gap list" },
  { id: "suspensions", label: "Work suspensions" },
  { id: "retention", label: "Record retention" },
];

/** Who is trained on what the effective matrix requires, for one department. The department chosen is shared by the three tabs. */
export function TrainingComplianceView() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get("tab");
  const [tab, setTab] = useState(TABS.some((t) => t.id === initialTab) ? String(initialTab) : "summary");
  const [departments, setDepartments] = useState<{ label: string; value: string }[]>([]);
  const [departmentId, setDepartmentId] = useState("");

  useEffect(() => {
    dictionaryApi.getDepartments().then((l) => setDepartments(l.map((d) => ({ label: d.name, value: d.id })))).catch(() => setDepartments([]));
  }, []);

  const changeTab = (id: string) => {
    if (id === tab) return;
    // Each tab has its own server query; never carry one tab's query into another.
    setSearchParams(id === "summary" ? {} : { tab: id }, { replace: true });
    setTab(id);
  };
  const departmentFilter: ReportSelectFilter = {
    id: "department",
    label: "Department",
    value: departmentId,
    options: [{ label: "My department", value: "" }, ...departments],
    onChange: setDepartmentId,
  };

  return (
    <div className="flex min-w-0 flex-col gap-4 md:gap-6">
      <PageHeader title={TRAINING_PAGES.compliance.title} breadcrumbItems={trainingBreadcrumbs(navigate, "compliance")} />
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <TabNav tabs={TABS} activeTab={tab} onChange={changeTab} variant="underline" ariaLabel="Training compliance" tabIdPrefix="compliance-tab" panelIdPrefix="compliance-panel" />
        <div className="p-4 md:p-5">
          <div id={`compliance-panel-${tab}`} role="tabpanel" aria-labelledby={`compliance-tab-${tab}`} className="min-w-0">
            {tab === "summary" && <ComplianceSummaryTab departmentId={departmentId} departments={departments} onDepartment={setDepartmentId} />}
            {tab === "completion" && <ComplianceCompletionTab departmentId={departmentId} departmentFilter={departmentFilter} />}
            {tab === "gaps" && <ComplianceGapsTab departmentId={departmentId} departmentFilter={departmentFilter} />}
            {tab === "suspensions" && <ComplianceSuspensionsTab departmentId={departmentId} departmentFilter={departmentFilter} />}
            {tab === "retention" && <ComplianceRetentionTab departmentId={departmentId} departmentFilter={departmentFilter} />}
          </div>
        </div>
      </div>
    </div>
  );
}
