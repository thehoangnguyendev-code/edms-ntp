import { useCallback, useEffect, useState } from "react";
import { MoreVertical } from "lucide-react";
import { IconTrash, IconUserPlus } from "@tabler/icons-react";
import { Button } from "@/components/ui/button/Button";
import { FormModal } from "@/components/ui/modal/FormModal";
import { DataTable, type DataTableColumn } from "@/components/ui/table/DataTable";
import { TableEmptyState } from "@/components/ui/table/TableEmptyState";
import { TablePagination } from "@/components/ui/table/TablePagination";
import { PortalDropdownMenu, DropdownMenuItem } from "@/components/ui/dropdown";
import { usePortalDropdown } from "@/hooks/usePortalDropdown";
import { useEntityChanged } from "@/features/realtime/useEntityChanged";
import { trainingError, trainingProposalApi, type TrainingProposal } from "@/services/api/trainingActivities";
import { ProposedParticipantsPicker } from "./ProposedParticipantsPicker";
import { TrainingPersonName } from "./TrainingPersonName";

type Person = TrainingProposal["people"][number];

/**
 * "List of participants in the Training", on the Training tab of a document. The people are a proposal made while the document is prepared: when the training of the
 * document opens and its first session is added, they are put on the list as a draft, and the organizer confirms the list with a signature (SOP.0003 5.3.4).
 * It saves by itself (each change is recorded in the Audit Trail of the training activity), so the document does not have to be saved again; the Training Number, and
 * so the activity, exists once the document is saved with a training period.
 */
export function ProposedParticipantsField({ documentId }: { documentId?: string | null }) {
  const [proposal, setProposal] = useState<TrainingProposal>();
  const [error, setError] = useState("");
  const [adding, setAdding] = useState(false);
  const [selection, setSelection] = useState<string[]>([]);
  const [openNo, setOpenNo] = useState(0);
  const [busy, setBusy] = useState(false);
  const menu = usePortalDropdown();
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  const load = useCallback(() => {
    if (!documentId) { setProposal(undefined); return; }
    trainingProposalApi.get(documentId).then((p) => { setProposal(p); setError(""); }).catch((e) => setError(trainingError(e)));
  }, [documentId]);
  useEffect(load, [load]);
  useEntityChanged(["TRAINING"], load);

  const save = async (ids: string[]) => {
    if (!documentId) return;
    setBusy(true);
    try {
      setProposal(await trainingProposalApi.replace(documentId, ids));
      setError("");
      setAdding(false);
    } catch (e) {
      setError(trainingError(e));
    } finally {
      setBusy(false);
    }
  };

  const people = proposal?.people ?? [];
  // The whole proposal is loaded (it is short); it is shown ten at a time, and the page is pulled back when people are removed.
  const totalPages = Math.max(1, Math.ceil(people.length / limit));
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);
  const shown = people.slice((page - 1) * limit, page * limit);
  const columns: DataTableColumn<Person>[] = [
    { id: "rowNo", header: "No.", locked: true, cell: (_p, i) => (page - 1) * limit + i + 1 },
    { id: "code", header: "Employee ID", cell: (p) => <span className="font-semibold text-emerald-600">{p.employeeCode ?? "\u2014"}</span> },
    { id: "name", header: "Full Name", cell: (p) => <TrainingPersonName fullName={p.fullName} avatar={p.avatar} /> },
    { id: "username", header: "Username", cell: (p) => p.username ?? "—" },
    { id: "email", header: "Email", cell: (p) => p.email ?? "—" },
    { id: "department", header: "Department", cell: (p) => p.department ?? "\u2014" },
    { id: "position", header: "Position", cell: (p) => p.position ?? "\u2014" },
  ];
  const action = proposal?.editable ? {
    cell: (p: Person) => (
      <button type="button" ref={menu.getRef(p.personId)} aria-label="More actions" className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-slate-200 md:h-8 md:w-8" onClick={(event) => menu.toggle(p.personId, event)}>
        <MoreVertical className="h-4 w-4" />
      </button>
    ),
  } : undefined;
  const actionRow = people.find((p) => p.personId === menu.openId);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">List of participants in the Training{people.length ? ` (${people.length})` : ""}</h3>
          <p className="text-xs text-slate-500">A proposal. When the training opens and its first session is added, these people are put on the list; the organizer confirms the list with a signature.</p>
        </div>
        {proposal?.editable && <Button size="sm" variant="default" onClick={() => { setSelection(people.map((p) => p.personId)); setOpenNo((n) => n + 1); setAdding(true); }}><IconUserPlus className="mr-1.5 h-4 w-4" />Edit participants</Button>}
      </div>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      {!documentId && <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">Save the document first. The Training Number is issued when it is saved with a training period, and the participants are chosen after that.</p>}
      {documentId && proposal && !proposal.available && <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">There is no training activity for this document yet. Set the training period and save the document.</p>}
      {proposal?.available && (
        <DataTable
          rows={shown} getRowKey={(p) => p.personId} columns={columns} action={action}
          pagination={people.length > 0 ? <TablePagination currentPage={page} totalPages={totalPages} totalItems={people.length} itemsPerPage={limit} onPageChange={setPage} onItemsPerPageChange={(value) => { setLimit(value); setPage(1); }} /> : undefined}
          emptyState={<TableEmptyState title="No participant proposed" description={proposal.editable ? "Use Edit participants to propose the people to be trained." : "Nobody has been proposed."} />}
        />
      )}
      <PortalDropdownMenu isOpen={!!actionRow} onClose={menu.close} position={menu.position} minWidth={200}>
        {actionRow && (
          <div className="py-1">
            <DropdownMenuItem icon={<IconTrash className="h-4 w-4" />} onClick={() => { menu.close(); void save(people.filter((p) => p.personId !== actionRow.personId).map((p) => p.personId)); }}>Remove</DropdownMenuItem>
          </div>
        )}
      </PortalDropdownMenu>
      <FormModal
        isOpen={adding} onClose={() => setAdding(false)} title="Participants in the Training" confirmText={`Save (${selection.length})`} size="xl" isLoading={busy}
        confirmDisabled={selection.length === people.length && selection.every((id) => people.some((p) => p.personId === id))}
        onConfirm={() => void save(selection)}
      >
        <ProposedParticipantsPicker key={openNo} initialIds={people.map((p) => p.personId)} onChange={setSelection} />
      </FormModal>
    </div>
  );
}
