import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge/Badge";
import { Button } from "@/components/ui/button/Button";
import { DataTable, type DataTableColumn } from "@/components/ui/table/DataTable";
import type { TrainingDocumentSource } from "@/services/api/trainingActivities";
import { tr } from "@/i18n";

const ROLE_LABEL: Record<TrainingDocumentSource["role"], string> = {
  MAIN: "Document",
  GROUP: "Same Training Number",
  RELATED: "Related Document",
};

/**
 * The documents the training is about, taken from Document Control: the document, the ones that share its Training Number, and every document it lists as related.
 * They are the material (SOP.0003 5.3.5: for a SOP, use the approved procedure), so they are read there and not copied; the organizer adds the trainer's own slides or
 * files in the list below. Shown as a table (the same table as the rest of the screen).
 */
export function TrainingDocumentSources({ documents }: { documents: TrainingDocumentSource[] }) {
  const navigate = useNavigate();
  if (documents.length === 0) return null;
  const columns: DataTableColumn<TrainingDocumentSource>[] = [
    { id: "rowNo", header: "No.", locked: true, cell: (_d, i) => i + 1 },
    { id: "document", header: tr("Document"), cell: (d) => <div className="max-w-md whitespace-normal font-medium text-slate-900">{`${d.documentNumber}${d.documentName ? ` ${d.documentName}` : ""}`}</div> },
    { id: "revision", header: tr("Revision"), cell: (d) => (d.revisionNumber ? d.revisionNumber : <span className="text-slate-500">{tr("No revision yet")}</span>) },
    { id: "role", header: tr("Role"), cell: (d) => <Badge semantic={d.role === "MAIN" ? "success" : "neutral"}>{tr(ROLE_LABEL[d.role])}</Badge> },
    {
      id: "status",
      header: tr("Status"),
      cell: (d) => {
        const unapproved = Boolean(d.revisionId) && d.approved === false;
        // a related document is read with the document that is trained: the trainer needs to know which of them changed in this version
        const changed = d.role === "RELATED" && Boolean(d.revisionId) && !d.unchanged;
        if (!d.unchanged && !unapproved && !changed && !d.frozen) return "—";
        return (
          <div className="flex max-w-[280px] flex-wrap gap-1.5 whitespace-normal">
            {d.unchanged && <Badge semantic="info">{tr("Not changed in this version")}</Badge>}
            {changed && <Badge semantic="success">{tr("Changed in this version")}</Badge>}
            {unapproved && <Badge semantic="warning">{tr("Not approved yet")}</Badge>}
            {d.frozen && <Badge color="violet">{tr("Read in this training")}</Badge>}
          </div>
        );
      },
    },
  ];
  return (
    <section aria-label={tr("Documents from Document Control")} className="mb-4">
      <h4 className="text-sm font-semibold text-slate-900">{tr("Documents from Document Control")}</h4>
      <p className="mb-3 mt-0.5 text-xs text-slate-500">{tr("These documents are the material of this training. They are read in Document Control, so the trainees always see the approved version. Add your own slides or files below.")}</p>
      <DataTable
        rows={documents}
        columns={columns}
        getRowKey={(d) => `${d.role}-${d.documentId}`}
        action={{
          header: tr("Action"),
          cell: (d) => (d.revisionId && d.approved !== false ? <Button size="sm" onClick={() => navigate(`/documents/revisions/${d.revisionId}`)}>{tr("Open")}</Button> : null),
        }}
      />
    </section>
  );
}
