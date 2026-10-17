import { useCallback, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { TabNav, type TabItem } from "@/components/ui/tabs/TabNav";
import { trainingBreadcrumbs, TRAINING_PAGES } from "./trainingLabels";
import { MyTrainingTodoTab } from "./my-training-tabs/MyTrainingTodoTab";
import { MyTrainingSignaturesTab } from "./my-training-tabs/MyTrainingSignaturesTab";
import { MyTrainingRecordsTab } from "./my-training-tabs/MyTrainingRecordsTab";

export function MyTrainingView() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get("tab");
  const [tab, setTab] = useState(initialTab === "sign" || initialTab === "records" ? initialTab : "todo");
  const [totals, setTotals] = useState<Record<string, number>>({});
  const updateTodoTotal = useCallback((total: number) => setTotals((current) => current.todo === total ? current : { ...current, todo: total }), []);
  const updateSignTotal = useCallback((total: number) => setTotals((current) => current.sign === total ? current : { ...current, sign: total }), []);
  const tabs: TabItem[] = [
    { id: "todo", label: "To do", count: totals.todo },
    { id: "sign", label: "Waiting for my signature", count: totals.sign },
    { id: "records", label: "My records" },
  ];
  const changeTab = (id: string) => {
    if (id === tab) return;
    // Each tab has different server sort fields; never carry one table's query into another.
    setSearchParams(id === "todo" ? {} : { tab: id }, { replace: true });
    setTab(id);
  };

  return (
    <div className="flex min-w-0 flex-col gap-4 md:gap-6">
      <PageHeader title={TRAINING_PAGES.myTraining.title} breadcrumbItems={trainingBreadcrumbs(navigate, "myTraining")} />
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <TabNav tabs={tabs} activeTab={tab} onChange={changeTab} variant="underline" ariaLabel="My training" tabIdPrefix="my-training-tab" panelIdPrefix="my-training-panel" />
        <div className="p-4 md:p-5">
          <div id={`my-training-panel-${tab}`} role="tabpanel" aria-labelledby={`my-training-tab-${tab}`} className="min-w-0">
            {tab === "todo" && <MyTrainingTodoTab onTotal={updateTodoTotal} />}
            {tab === "sign" && <MyTrainingSignaturesTab onTotal={updateSignTotal} />}
            {tab === "records" && <MyTrainingRecordsTab />}
          </div>
        </div>
      </div>
    </div>
  );
}
