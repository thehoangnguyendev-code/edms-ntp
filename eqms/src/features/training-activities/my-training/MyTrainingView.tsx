import { useCallback, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { Button } from "@/components/ui/button/Button";
import { TabNav, type TabItem } from "@/components/ui/tabs/TabNav";
import { trainingBreadcrumbs, TRAINING_PAGES } from "../shared/trainingLabels";
import { MyTrainingTodoTab } from "./tabs/MyTrainingTodoTab";
import { MyTrainingSignaturesTab } from "./tabs/MyTrainingSignaturesTab";
import { MyTrainingCopiesTab } from "./tabs/MyTrainingCopiesTab";
import { MyTrainingRecordsTab } from "./tabs/MyTrainingRecordsTab";
import { CheckInDialog } from "./components/CheckInDialog";
import { TabletSmartphone } from "lucide-react";

/**
 * The training of the person. Check in opens a dialog (type the code or scan the QR code with the camera); the address /check-in?code=123456, which the QR code holds, opens the same dialog filled in,
 * so a scan with the camera app of a phone arrives here too.
 */
export function MyTrainingView({
  openCheckIn = false,
}: {
  openCheckIn?: boolean;
}) {
  const navigate = useNavigate();
  const [checkIn, setCheckIn] = useState(openCheckIn);
  const scannedCode = openCheckIn
    ? (new URLSearchParams(window.location.search).get("code") ?? "")
    : "";
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get("tab");
  const [tab, setTab] = useState(
    initialTab === "sign" || initialTab === "records" || initialTab === "copies"
      ? initialTab
      : "todo",
  );
  const [totals, setTotals] = useState<Record<string, number>>({});
  const updateTodoTotal = useCallback(
    (total: number) =>
      setTotals((current) =>
        current.todo === total ? current : { ...current, todo: total },
      ),
    [],
  );
  const updateSignTotal = useCallback(
    (total: number) =>
      setTotals((current) =>
        current.sign === total ? current : { ...current, sign: total },
      ),
    [],
  );
  const tabs: TabItem[] = [
    { id: "todo", label: "To Do", count: totals.todo },
    { id: "sign", label: "Waiting for My Signature", count: totals.sign },
    { id: "copies", label: "Copies Received" },
    { id: "records", label: "My Records" },
  ];
  const changeTab = (id: string) => {
    if (id === tab) return;
    // Each tab has different server sort fields; never carry one table's query into another.
    setSearchParams(id === "todo" ? {} : { tab: id }, { replace: true });
    setTab(id);
  };

  return (
    <div className="flex min-w-0 flex-col gap-4 md:gap-6">
      <PageHeader
        title={TRAINING_PAGES.myTraining.title}
        breadcrumbItems={trainingBreadcrumbs(navigate, "myTraining")}
        actions={
          <Button
            size="sm"
            variant="default"
            onClick={() => setCheckIn(true)}
            className="whitespace-nowrap gap-2"
          >
            <TabletSmartphone className="h-4 w-4" />
            Check in
          </Button>
        }
      />
      <CheckInDialog
        isOpen={checkIn}
        initialCode={scannedCode}
        onClose={() => {
          setCheckIn(false);
          if (openCheckIn)
            navigate("/training-management/my-training", { replace: true });
        }}
        onDone={() => {
          setCheckIn(false);
          if (openCheckIn)
            navigate("/training-management/my-training", { replace: true });
        }}
      />
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <TabNav
          tabs={tabs}
          activeTab={tab}
          onChange={changeTab}
          variant="underline"
          ariaLabel="My training"
          tabIdPrefix="my-training-tab"
          panelIdPrefix="my-training-panel"
        />
        <div className="p-4 md:p-5">
          <div
            id={`my-training-panel-${tab}`}
            role="tabpanel"
            aria-labelledby={`my-training-tab-${tab}`}
            className="min-w-0"
          >
            {tab === "todo" && <MyTrainingTodoTab onTotal={updateTodoTotal} />}
            {tab === "sign" && (
              <MyTrainingSignaturesTab onTotal={updateSignTotal} />
            )}
            {tab === "copies" && <MyTrainingCopiesTab />}
            {tab === "records" && <MyTrainingRecordsTab />}
          </div>
        </div>
      </div>
    </div>
  );
}
