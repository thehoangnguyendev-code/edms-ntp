import { useEffect, useState } from "react";
import { IconDownload, IconEye } from "@tabler/icons-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge, type BadgeColor } from "@/components/ui/badge/Badge";
import { TabNav, type TabItem } from "@/components/ui/tabs/TabNav";
import { type DataTableColumn } from "@/components/ui/table/DataTable";
import { useToast } from "@/components/ui/toast/Toast";
import {
  trainingError,
  trainingFilesApi,
  type TrainingActivityDetail,
  type TrainingActivityFiles,
  type TrainingPaperEvidence,
  type TrainingParticipant,
} from "@/services/api/trainingActivities";
import { saveBlob } from "../../shared/trainingLabels";
import { scanFileName } from "../../shared/scanFileName";
import { TrainingParticipantTable } from "./TrainingParticipantTable";
import { TrainingScanReviewModal } from "./TrainingScanReviewModal";
import { RowActionsMenu, type RowAction } from "./workspace/RowActionsMenu";
import { tr } from "@/i18n";

const TABS: TabItem[] = [{ id: "results", label: "Results" }];

const resultOf = (p: TrainingParticipant): { label: string; color: BadgeColor } =>
  p.state === "ABSENT" ? { label: "Absent", color: "slate" }
    : p.result === "PASSED" ? { label: tr("Qualified"), color: "emerald" }
      : p.result === "FAILED" ? { label: tr("Not qualified"), color: "red" }
        : { label: tr("Not scored yet"), color: "amber" };

/**
 * Under the command buttons of Training Activity Details: the results of everyone in the activity with the scan of each paper test (read only). The people are paged, searched and sorted by the server
 * like the Participants tab; the scans of the activity come once. A scan is shown and saved as Training Number_employee code_name; opening it shows the specimen signature of the person beside it.
 */
export function TrainingActivityResultsCard({ activity, sessionId }: { activity: TrainingActivityDetail; sessionId?: string }) {
  const { showToast } = useToast();
  const [tab, setTab] = useState("results");
  const [files, setFiles] = useState<TrainingActivityFiles>();
  const [viewing, setViewing] = useState<{ person: TrainingParticipant; evidence: TrainingPaperEvidence; fileName: string }>();

  useEffect(() => {
    let live = true;
    trainingFilesApi.list(activity.id).then((result) => { if (live) setFiles(result); }).catch(() => { if (live) setFiles(undefined); });
    return () => { live = false; };
  }, [activity]);

  const scansOf = (p: TrainingParticipant) =>
    (files?.evidence ?? []).filter((e) => e.kind === "ASSESSMENT" && e.participantId === p.id).sort((a, b) => a.uploadedAt.localeCompare(b.uploadedAt));
  const nameOf = (p: TrainingParticipant, e: TrainingPaperEvidence, index: number, count: number) => scanFileName(activity.trainingNumber, p, e.originalName, index, count);

  const download = async (p: TrainingParticipant, e: TrainingPaperEvidence, fileName: string) => {
    try {
      saveBlob(await trainingFilesApi.personEvidenceFile(p.personUserId as string, activity.id, e.id, false), fileName);
    } catch (error) {
      showToast({ type: "error", title: tr("The file could not be downloaded"), message: trainingError(error) });
    }
  };

  const actionsOf = (p: TrainingParticipant): RowAction[] => {
    // A person from outside has no record to ask the server for: the scans of a person are opened through the account of that person.
    if (!p.personUserId) return [];
    const scans = scansOf(p);
    return scans.flatMap((e, i) => {
      const fileName = nameOf(p, e, i, scans.length);
      const suffix = scans.length > 1 ? ` (${i + 1})` : "";
      return [
        { key: `view-${e.id}`, label: `${tr("View Scan")}${suffix}`, icon: <IconEye className="h-4 w-4" />, run: () => setViewing({ person: p, evidence: e, fileName }) },
        { key: `download-${e.id}`, label: `${tr("Download Scan")}${suffix}`, icon: <IconDownload className="h-4 w-4" />, run: () => void download(p, e, fileName) },
      ];
    });
  };

  // the Session column is shown only when the activity has more than one session (as in the Participants table)
  const severalSessions = activity.sessions.filter((x) => x.status !== "CANCELLED").length > 1;
  const columns: DataTableColumn<TrainingParticipant>[] = [
    { id: "rowNo", header: "No.", cell: () => null },
    ...(severalSessions ? [{ id: "session", header: tr("Session"), cell: (p: TrainingParticipant) => { const no = activity.sessions.find((x) => x.id === p.sessionId)?.sessionNo; return no ? `${tr("Session")} ${no}` : "—"; } }] : []),
    {
      id: "name",
      header: tr("Participant"),
      cell: (p) => (
        <div className="flex items-center gap-2.5">
          <Avatar name={p.fullName || "User"} src={p.avatar} tone="brand" className="h-8 w-8 shrink-0" />
          <div className="min-w-0">
            <div className="font-medium text-slate-900">{p.fullName}</div>
          </div>
        </div>
      ),
    },
    { id: "employeeCode", header: tr("Employee Code"), cell: (p) => p.employeeCode ?? p.externalOrg ?? "—" },
    { id: "department", header: tr("Department"), cell: (p) => p.department ?? "—" },
    {
      id: "score",
      header: "Score",
      cell: (p) => (p.lastScore != null && p.lastMax != null ? <span className="whitespace-nowrap">{`${p.lastScore} / ${p.lastMax}${p.lastPercent != null ? ` (${p.lastPercent}%)` : ""}`}</span> : "—"),
    },
    {
      id: "result",
      header: "Result",
      cell: (p) => { const r = resultOf(p); return <Badge color={r.color}>{tr(r.label)}</Badge>; },
    },
    {
      id: "scan",
      header: "Scan File",
      cell: (p) => {
        const scans = scansOf(p);
        if (scans.length === 0) return <span className="text-slate-400">—</span>;
        return (
          <div className="max-w-80 space-y-1 whitespace-normal wrap-break-word">
            {scans.map((e, i) => <div key={e.id}>{nameOf(p, e, i, scans.length)}</div>)}
          </div>
        );
      },
    },
    { id: "actions", header: "Action", cell: (p) => <RowActionsMenu id={`scan-${p.id}`} label={`Actions for the scan of ${p.fullName}`} actions={actionsOf(p)} /> },
  ];

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <TabNav tabs={TABS} activeTab={tab} onChange={setTab} layoutId="training-activity-result-tab" />
      <div className="p-4 md:p-5">
        {tab === "results" && (
          <TrainingParticipantTable activityId={activity.id} sessionId={sessionId} group="ALL" title={tr("Results and scanned tests")} hideHeading columns={columns} refreshToken={activity} />
        )}
      </div>
      {viewing?.person.personUserId && (
        <TrainingScanReviewModal activityId={activity.id} personId={viewing.person.personUserId} personName={viewing.person.fullName} evidence={viewing.evidence} fileName={viewing.fileName} onClose={() => setViewing(undefined)} />
      )}
    </div>
  );
}
