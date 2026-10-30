import { useCallback, useEffect, useRef, useState } from "react";
import { MoreVertical } from "lucide-react";
import { IconTrash, IconUserEdit, IconUserPlus } from "@tabler/icons-react";
import { Button } from "@/components/ui/button/Button";
import { WarningBanner } from "@/components/ui/banner/WarningBanner";
import { FormModal } from "@/components/ui/modal/FormModal";
import {
  DataTable,
  type DataTableColumn,
} from "@/components/ui/table/DataTable";
import { TableEmptyState } from "@/components/ui/table/TableEmptyState";
import { TablePagination } from "@/components/ui/table/TablePagination";
import { PortalDropdownMenu, DropdownMenuItem } from "@/components/ui/dropdown";
import { usePortalDropdown } from "@/hooks/usePortalDropdown";
import { useEntityChanged } from "@/features/realtime/useEntityChanged";
import {
  trainingError,
  trainingProposalApi,
  type TrainingPerson,
  type TrainingProposal,
} from "@/services/api/trainingActivities";
import { ProposedParticipantsPicker } from "./ProposedParticipantsPicker";
import { TrainingPersonName } from "./TrainingPersonName";

export type ProposedPerson = TrainingProposal["people"][number];
type Person = ProposedPerson;
const asProposed = (p: TrainingPerson): ProposedPerson => ({
  personId: p.id,
  fullName: p.fullName,
  username: p.username,
  email: p.email,
  employeeCode: p.employeeCode,
  department: p.department,
  position: p.position,
  avatar: p.avatar,
});
const asPerson = (p: ProposedPerson): TrainingPerson => ({
  id: p.personId,
  fullName: p.fullName,
  username: p.username,
  email: p.email,
  employeeCode: p.employeeCode,
  department: p.department,
  position: p.position,
  avatar: p.avatar,
});

/**
 * "List of participants in the Training", on the Training tab of a document. The people are a proposal made while the document is prepared: when the training of the
 * document opens and its first session is added, they are put on the list as a draft, and the organizer confirms the list with a signature (SOP.0003 5.3.4).
 * Once the training activity of the document exists, a change saves by itself (each change is recorded in the Audit Trail of the training activity). Before that (a
 * document that is being created) the people are chosen at once and kept by the form (`pending`, `onPendingChange`); the form sends them when the document is saved.
 */
export function ProposedParticipantsField({
  documentId,
  pending,
  onPendingChange,
}: {
  documentId?: string | null;
  pending?: ProposedPerson[];
  onPendingChange?: (people: ProposedPerson[]) => void;
}) {
  const [proposal, setProposal] = useState<TrainingProposal>();
  const [error, setError] = useState("");
  const [adding, setAdding] = useState(false);
  const [selection, setSelection] = useState<string[]>([]);
  const [selectionPeople, setSelectionPeople] = useState<TrainingPerson[]>([]);
  const [openNo, setOpenNo] = useState(0);
  const [busy, setBusy] = useState(false);
  const menu = usePortalDropdown();
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const generation = useRef(0);
  const query = useRef({ documentId, page, limit });
  query.current = { documentId, page, limit };

  const load = useCallback(async () => {
    const request = ++generation.current;
    const current = query.current;
    if (!current.documentId) {
      setProposal(undefined);
      return;
    }
    try {
      const result = await trainingProposalApi.getPage(
        current.documentId,
        current.page,
        current.limit,
      );
      if (request === generation.current) {
        setProposal(result);
        setError("");
      }
    } catch (e) {
      if (request === generation.current) setError(trainingError(e));
    }
  }, []);
  useEffect(() => {
    void load();
    return () => {
      generation.current++;
    };
  }, [load, documentId, page, limit]);
  useEntityChanged(["TRAINING"], load);

  const save = async (ids: string[], chosen: TrainingPerson[] = []) => {
    if (local) {
      const byId = new Map([
        ...people.map((p) => [p.personId, p] as const),
        ...chosen.map((p) => [p.id, asProposed(p)] as const),
      ]);
      onPendingChange?.(
        ids.map((id) => byId.get(id)).filter((p): p is ProposedPerson => !!p),
      );
      setAdding(false);
      return;
    }
    if (!documentId) return;
    setBusy(true);
    try {
      await trainingProposalApi.replace(documentId, ids);
      await load();
      setAdding(false);
    } catch (e) {
      setError(trainingError(e));
    } finally {
      setBusy(false);
    }
  };

  // Before the document has its training activity the list is the one the form keeps; afterwards it is the one of the server.
  // Whatever the form still holds stays on the screen until the server has it: if sending it failed, the people are not hidden behind an empty list of the server.
  const local =
    !!onPendingChange &&
    (!documentId ||
      (pending?.length ?? 0) > 0 ||
      (!!proposal && !proposal.available));
  const people = local ? (pending ?? []) : (proposal?.people ?? []);
  const editable = local || !!proposal?.editable;
  // Saved proposals are paged by the server; only unsaved form selections are paged locally.
  const totalItems = local ? people.length : (proposal?.pagination?.total ?? 0);
  // "Add" while nobody is on the list, "Edit" once there is somebody
  const hasPeople = totalItems > 0 || people.length > 0;
  const allPersonIds = local
    ? people.map((p) => p.personId)
    : (proposal?.personIds ?? []);
  const totalPages = Math.max(
    1,
    local
      ? Math.ceil(people.length / limit)
      : (proposal?.pagination?.totalPages ?? 1),
  );
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);
  const shown = local ? people.slice((page - 1) * limit, page * limit) : people;
  const columns: DataTableColumn<Person>[] = [
    {
      id: "rowNo",
      header: "No.",
      locked: true,
      cell: (_p, i) => (page - 1) * limit + i + 1,
    },
    {
      id: "code",
      header: "Employee ID",
      cell: (p) => (
        <span className="font-semibold text-emerald-600">
          {p.employeeCode ?? "\u2014"}
        </span>
      ),
    },
    {
      id: "name",
      header: "Full Name",
      cell: (p) => (
        <TrainingPersonName fullName={p.fullName} avatar={p.avatar} />
      ),
    },
    { id: "username", header: "Username", cell: (p) => p.username ?? "—" },
    { id: "email", header: "Email", cell: (p) => p.email ?? "—" },
    {
      id: "department",
      header: "Department",
      cell: (p) => p.department ?? "\u2014",
    },
    { id: "position", header: "Position", cell: (p) => p.position ?? "\u2014" },
  ];
  const action = editable
    ? {
        cell: (p: Person) => (
          <button
            type="button"
            ref={menu.getRef(p.personId)}
            aria-label="More actions"
            className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-slate-200 md:h-8 md:w-8"
            onClick={(event) => menu.toggle(p.personId, event)}
          >
            <MoreVertical className="h-4 w-4" />
          </button>
        ),
      }
    : undefined;
  const actionRow = people.find((p) => p.personId === menu.openId);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">
            List of participants in the Training
            {totalItems ? ` (${totalItems})` : ""}
          </h3>
          <p className="text-xs text-slate-500">
            A proposal. When the training opens and its first session is added,
            these people are put on the list; the organizer confirms the list
            with a signature.
          </p>
        </div>
        {editable && (
          <Button
            size="sm"
            variant="default"
            onClick={() => {
              setSelection(allPersonIds);
              setSelectionPeople(people.map(asPerson));
              setOpenNo((n) => n + 1);
              setAdding(true);
            }}
          >
            {hasPeople ? <IconUserEdit className="mr-1.5 h-4 w-4" /> : <IconUserPlus className="mr-1.5 h-4 w-4" />}
            {hasPeople ? "Edit Participants" : "Add Participants"}
          </Button>
        )}
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      {local && (
        <WarningBanner
          variant="info"
          description="The people chosen here are saved with the document. The Training Number is issued, and the list is sent to the training, when the document is saved with a training period."
        />
      )}
      {!local && documentId && proposal && !proposal.available && (
        <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
          There is no training activity for this document yet. Set the training
          period and save the document.
        </p>
      )}
      {(local || proposal?.available) && (
        <DataTable
          rows={shown}
          getRowKey={(p) => p.personId}
          columns={columns}
          action={action}
          pagination={
            totalItems > 0 ? (
              <TablePagination
                currentPage={page}
                totalPages={totalPages}
                totalItems={totalItems}
                itemsPerPage={limit}
                onPageChange={setPage}
                onItemsPerPageChange={(value) => {
                  setLimit(value);
                  setPage(1);
                }}
              />
            ) : undefined
          }
          emptyState={
            <TableEmptyState
              title="No participant proposed"
              description={
                editable
                  ? "Use Add Participants to propose the people to be trained."
                  : "Nobody has been proposed."
              }
            />
          }
        />
      )}
      <PortalDropdownMenu
        isOpen={!!actionRow}
        onClose={menu.close}
        position={menu.position}
        minWidth={200}
      >
        {actionRow && (
          <div className="py-1">
            <DropdownMenuItem
              icon={<IconTrash className="h-4 w-4" />}
              onClick={() => {
                menu.close();
                void save(
                  allPersonIds.filter((id) => id !== actionRow.personId),
                );
              }}
            >
              Remove
            </DropdownMenuItem>
          </div>
        )}
      </PortalDropdownMenu>
      <FormModal
        isOpen={adding}
        onClose={() => setAdding(false)}
        title="Participants in the Training"
        confirmText={`Save (${selection.length})`}
        size="2xl"
        className="max-w-5xl"
        isLoading={busy}
        confirmDisabled={
          selection.length === allPersonIds.length &&
          selection.every((id) => allPersonIds.includes(id))
        }
        onConfirm={() => void save(selection, selectionPeople)}
      >
        <ProposedParticipantsPicker
          key={openNo}
          initialIds={allPersonIds}
          initialPeople={people.map(asPerson)}
          onChange={(ids, chosen) => {
            setSelection(ids);
            setSelectionPeople(chosen);
          }}
        />
      </FormModal>
    </div>
  );
}
