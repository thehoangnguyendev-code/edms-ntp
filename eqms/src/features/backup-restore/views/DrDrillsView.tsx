import React, { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge/Badge";
import { Button } from "@/components/ui/button/Button";
import { WarningBanner } from "@/components/ui/banner/WarningBanner";
import { TABLE_STYLES, type DataTableColumn } from "@/components/ui/table";
import { FormModal } from "@/components/ui/modal/FormModal";
import { FormField, Input, Textarea } from "@/components/ui/form/ResponsiveForm";
import { Select } from "@/components/ui/select/Select";
import { DateTimePicker } from "@/components/ui/datetime-picker/DateTimePicker";
import { useToast } from "@/components/ui/toast/Toast";
import { useDebounce } from "@/hooks";
import { usePermissions } from "@/hooks/usePermissions";
import { backupRestoreApi, type DrDrillRecord, type DrScenarioRecord } from "@/services/api/backupRestore";
import { getApiErrorMessage } from "@/utils/apiError";
import { BackupRestorePage } from "../components/BackupRestorePage";
import { ServerListPanel } from "../components/ServerListPanel";
import { formatDateTime, pickerToInstant } from "../format";

const ALL = "ALL";
const RESULT_COLOR = { PASSED: "emerald", PASSED_WITH_FINDINGS: "amber", FAILED: "red" } as const;
const RESULT_LABEL = { PASSED: "Passed", PASSED_WITH_FINDINGS: "Passed with findings", FAILED: "Failed" } as const;
const RESULT_OPTIONS = [
  { label: "All", value: ALL },
  { label: RESULT_LABEL.PASSED, value: "PASSED" },
  { label: RESULT_LABEL.PASSED_WITH_FINDINGS, value: "PASSED_WITH_FINDINGS" },
  { label: RESULT_LABEL.FAILED, value: "FAILED" },
];

type SortKey = "performedAt" | "drillCode" | "scenario" | "lead" | "achievedRtoHours" | "result";

type Form = { scenario: string; performedAt: string; lead: string; achieved: string; result: DrDrillRecord["result"]; findings: string };
const EMPTY: Form = { scenario: "", performedAt: "", lead: "", achieved: "", result: "PASSED", findings: "" };

/**
 * Disaster recovery drills (SDS 15.2): the recorded drills, each against the target of its scenario. A drill is recorded after it has
 * been carried out, with its result; the server refuses a PASSED result for a drill that took longer than its target.
 */
export const DrDrillsView: React.FC = () => {
  const { showToast } = useToast();
  const { hasPermission } = usePermissions();
  const canRecord = hasPermission("backup.admin.disaster_recovery.manage");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 400);
  const [scenarioFilter, setScenarioFilter] = useState(ALL);
  const [resultFilter, setResultFilter] = useState(ALL);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sort, setSort] = useState<{ key: SortKey; direction: "asc" | "desc" }>({ key: "performedAt", direction: "desc" });
  const [drills, setDrills] = useState<DrDrillRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [scenarios, setScenarios] = useState<DrScenarioRecord[]>([]);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [form, setForm] = useState<Form>();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    backupRestoreApi
      .drScenarios()
      .then((list) => {
        if (live) setScenarios(list);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    let live = true;
    setLoading(true);
    setError("");
    backupRestoreApi
      .drDrills({
        search: debouncedSearch.trim() || undefined,
        scenario: scenarioFilter === ALL ? undefined : scenarioFilter,
        result: resultFilter === ALL ? undefined : (resultFilter as DrDrillRecord["result"]),
        sortBy: sort.key,
        sortDirection: sort.direction,
        page,
        limit: pageSize,
      })
      .then((data) => {
        if (!live) return;
        setDrills(data.data);
        setTotal(data.pagination.total);
        setTotalPages(data.pagination.totalPages || 1);
        if (data.pagination.page !== page) setPage(data.pagination.page);
      })
      .catch((e) => {
        if (!live) return;
        setDrills([]);
        setTotal(0);
        setError(getApiErrorMessage(e, "The disaster recovery drills could not be loaded."));
      })
      .finally(() => {
        if (!live) return;
        setLoading(false);
        setHasLoaded(true);
      });
    return () => {
      live = false;
    };
  }, [debouncedSearch, scenarioFilter, resultFilter, sort, page, pageSize, reloadKey]);

  useEffect(() => setPage(1), [debouncedSearch, scenarioFilter, resultFilter, pageSize]);

  const sortFor = (key: SortKey) => ({
    direction: sort.key === key ? sort.direction : undefined,
    onSort: () => {
      setSort((prev) => ({ key, direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc" }));
      setPage(1);
    },
  });

  const scenarioOf = (code: string) => scenarios.find((s) => s.code === code);
  const scenarioOptions = [{ label: "All", value: ALL }, ...scenarios.map((s) => ({ label: s.label, value: s.code }))];
  const valid = !!form && form.scenario && form.performedAt && form.lead.trim() && form.achieved.trim() !== "" && !Number.isNaN(Number(form.achieved)) && Number(form.achieved) >= 0
    && (form.result === "PASSED" || form.findings.trim().length > 0);

  const save = async () => {
    if (!form) return;
    setBusy(true);
    try {
      const created = await backupRestoreApi.recordDrDrill({
        scenario: form.scenario,
        performedAt: pickerToInstant(form.performedAt),
        lead: form.lead.trim(),
        achievedRtoHours: Number(form.achieved),
        result: form.result,
        findings: form.findings.trim() || undefined,
      });
      showToast({ type: "success", title: "Drill recorded", message: created.drillCode });
      setForm(undefined);
      setReloadKey((k) => k + 1);
    } catch (e) {
      showToast({ type: "error", title: "The drill was not recorded", message: getApiErrorMessage(e, "The request was refused.") });
    } finally {
      setBusy(false);
    }
  };

  const columns: DataTableColumn<DrDrillRecord>[] = [
    { id: "no", header: "No.", label: "No.", locked: true, headerClassName: TABLE_STYLES.headerCell35, cellClassName: TABLE_STYLES.cell30, cell: (_d, i) => (page - 1) * pageSize + i + 1 },
    { id: "drillCode", header: "Drill", label: "Drill", headerClassName: TABLE_STYLES.headerCell35, sort: sortFor("drillCode"), cell: (d) => (
      <div>
        <span className="font-medium text-slate-900">{d.drillCode}</span>
        <span className="block text-xs text-slate-500">{scenarioOf(d.scenario)?.label ?? d.scenario}</span>
      </div>
    ) },
    { id: "performedAt", header: "Performed", label: "Performed", sort: sortFor("performedAt"), cell: (d) => formatDateTime(d.performedAt) },
    { id: "lead", header: "Led by", label: "Led by", sort: sortFor("lead"), cell: (d) => d.lead },
    { id: "achievedRtoHours", header: "Recovery time", label: "Recovery time", sort: sortFor("achievedRtoHours"), cell: (d) => (
      <span className={d.achievedRtoHours > d.rtoTargetHours ? "font-medium text-red-700" : undefined}>
        {d.achievedRtoHours} h <span className="text-xs text-slate-500">/ target {d.rtoTargetHours} h</span>
      </span>
    ) },
    { id: "result", header: "Result", label: "Result", sort: sortFor("result"), cell: (d) => <Badge color={RESULT_COLOR[d.result]}>{RESULT_LABEL[d.result]}</Badge> },
    { id: "findings", header: "Findings", label: "Findings", cell: (d) => <span className="block max-w-96 whitespace-normal">{d.findings ?? "—"}</span> },
  ];

  return (
    <BackupRestorePage
      title="Disaster Recovery Drills"
      group="Restore"
      preview={false}
      actions={
        canRecord ? (
          <Button size="sm" className="gap-2 whitespace-nowrap" onClick={() => setForm({ ...EMPTY })}>
            <Plus className="h-4 w-4" />
            Record Disaster Recovery Drill
          </Button>
        ) : undefined
      }
    >
      <WarningBanner
        variant="info"
        title="What a disaster recovery drill proves"
        description="The system is rebuilt on empty hardware from the off-site copy and the rebuild kit, and the time taken is compared with the recovery time target of its scenario."
      />
      <ServerListPanel
        tableKey="backup-restore.dr-drills.v1"
        columns={columns}
        rows={drills}
        getRowKey={(d) => d.drillCode}
        loading={loading}
        hasLoaded={hasLoaded}
        error={error}
        emptyTitle="No Disaster Recovery Drills"
        emptyDescription="Recorded drills appear here. Try changing your search or filters."
        search={search}
        onSearch={setSearch}
        searchLabel="Search disaster recovery drills"
        searchPlaceholder="Drill, scenario or person…"
        filters={[
          { id: "scenario", label: "Scenario", value: scenarioFilter, options: scenarioOptions, defaultValue: ALL, placeholder: "All", onChange: setScenarioFilter },
          { id: "result", label: "Result", value: resultFilter, options: RESULT_OPTIONS, defaultValue: ALL, placeholder: "All", onChange: setResultFilter },
        ]}
        onClear={() => {
          setSearch("");
          setScenarioFilter(ALL);
          setResultFilter(ALL);
          setPage(1);
        }}
        page={page}
        totalPages={totalPages}
        totalItems={total}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
      />

      <FormModal
        isOpen={!!form}
        onClose={() => setForm(undefined)}
        title="Record a Disaster Recovery Drill"
        description="Record a drill that has been carried out. Its targets are taken from the scenario."
        confirmText="Record drill"
        confirmDisabled={!valid || busy}
        onConfirm={save}
      >
        <div className="space-y-4">
          <FormField label="Scenario" required hint="The recovery time target is taken from the scenario.">
            <Select
              value={form?.scenario ?? ""}
              onChange={(value) => form && setForm({ ...form, scenario: String(value) })}
              options={scenarios.map((s) => ({ label: `${s.label} (target ${s.rtoHours} h)`, value: s.code }))}
              placeholder="Choose a scenario"
            />
          </FormField>
          <DateTimePicker
            label={
              <>
                Date and time <span className="text-red-500">*</span>
              </>
            }
            value={form?.performedAt ?? ""}
            onChange={(value) => form && setForm({ ...form, performedAt: value })}
            showTime
            placeholder="Select date and time"
          />
          <FormField label="Led by" required>
            <Input maxLength={120} value={form?.lead ?? ""} onChange={(e) => form && setForm({ ...form, lead: e.target.value })} />
          </FormField>
          <FormField label="Time achieved (hours)" required hint="Measured from the start of the restore to the service being back.">
            <Input type="number" min={0} step="0.5" value={form?.achieved ?? ""} onChange={(e) => form && setForm({ ...form, achieved: e.target.value })} />
          </FormField>
          <FormField label="Result" required hint="A drill that took longer than its target cannot be recorded as passed.">
            <Select
              value={form?.result ?? "PASSED"}
              onChange={(value) => form && setForm({ ...form, result: value as DrDrillRecord["result"] })}
              options={[
                { label: "Passed", value: "PASSED" },
                { label: "Passed with findings", value: "PASSED_WITH_FINDINGS" },
                { label: "Failed", value: "FAILED" },
              ]}
            />
          </FormField>
          <FormField label="Findings" required={form?.result !== "PASSED"} hint={form?.result === "PASSED" ? "Optional." : "Required when the drill did not pass cleanly."}>
            <Textarea rows={3} maxLength={4000} value={form?.findings ?? ""} onChange={(e) => form && setForm({ ...form, findings: e.target.value })} />
          </FormField>
        </div>
      </FormModal>
    </BackupRestorePage>
  );
};
