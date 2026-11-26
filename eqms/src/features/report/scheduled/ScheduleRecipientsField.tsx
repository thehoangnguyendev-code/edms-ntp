import { useState } from "react";
import { MoreVertical } from "lucide-react";
import { IconTrash, IconUserEdit, IconUserPlus } from "@tabler/icons-react";
import { Button } from "@/components/ui/button/Button";
import { FormModal } from "@/components/ui/modal/FormModal";
import { DataTable, type DataTableColumn } from "@/components/ui/table/DataTable";
import { TableEmptyState } from "@/components/ui/table/TableEmptyState";
import { TablePagination } from "@/components/ui/table/TablePagination";
import { PortalDropdownMenu, DropdownMenuItem } from "@/components/ui/dropdown";
import { usePortalDropdown } from "@/hooks/usePortalDropdown";
import { TrainingPersonName } from "@/features/training-activities/shared/TrainingPersonName";
import { ProposedParticipantsPicker, type PeopleSource } from "@/features/training-activities/shared/ProposedParticipantsPicker";
import { reportsApi, type ReportRecipientPerson } from "@/services/api/reports";
import { tr } from "@/i18n";

/** The people of the picker of a Training are looked for in the people who may receive a report. */
const recipientSource: PeopleSource = {
  groups: (by) => reportsApi.recipientGroups(by),
  query: (params) => reportsApi.recipientPeople(params),
};

/**
 * "Recipients" of a scheduled report, built like the list of the participants of a Training: the title with the number of people, the button Add/Edit Recipients, the table of
 * the people (employee ID, name with the avatar, user name, e-mail, department, position) with Remove in the menu of the row, and one window to choose the people (search, Business
 * Unit, Department, "Select all shown"), which the server pages. The list belongs to the form: the people are sent when the schedule is saved.
 */
export function ScheduleRecipientsField({
  people,
  onChange,
  disabled = false,
}: {
  people: ReportRecipientPerson[];
  onChange: (people: ReportRecipientPerson[]) => void;
  disabled?: boolean;
}) {
  const [adding, setAdding] = useState(false);
  const [openNo, setOpenNo] = useState(0);
  const [selection, setSelection] = useState<ReportRecipientPerson[]>(people);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const menu = usePortalDropdown();
  const totalPages = Math.max(1, Math.ceil(people.length / limit));
  const current = Math.min(page, totalPages);
  const shown = people.slice((current - 1) * limit, current * limit);
  const hasPeople = people.length > 0;

  const columns: DataTableColumn<ReportRecipientPerson>[] = [
    { id: "rowNo", header: "No.", locked: true, cell: (_p, i) => (current - 1) * limit + i + 1 },
    { id: "code", header: tr("Employee ID"), cell: (p) => <span className="font-semibold text-emerald-600">{p.employeeCode ?? "—"}</span> },
    { id: "name", header: "Full Name", cell: (p) => <TrainingPersonName fullName={p.fullName} avatar={p.avatar} /> },
    { id: "username", header: "Username", cell: (p) => p.username ?? "—" },
    { id: "email", header: "Email", cell: (p) => p.email ?? "—" },
    { id: "department", header: "Department", cell: (p) => p.department ?? "—" },
    { id: "position", header: "Position", cell: (p) => p.position ?? "—" },
  ];
  const action = disabled
    ? undefined
    : {
        cell: (p: ReportRecipientPerson) => (
          <button
            type="button"
            ref={menu.getRef(p.id)}
            aria-label={tr("More actions")}
            className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-slate-200 md:h-8 md:w-8"
            onClick={(event) => menu.toggle(p.id, event)}
          >
            <MoreVertical className="h-4 w-4" />
          </button>
        ),
      };
  const actionRow = people.find((p) => p.id === menu.openId);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">
            {tr("List of recipients")}{hasPeople ? ` (${people.length})` : ""}
          </h3>
          <p className="text-xs text-slate-500">{tr("These people are told when a run of the schedule is ready. Each must be active and allowed to download report files.")}</p>
        </div>
        {!disabled && (
          <Button
            size="sm"
            variant="default"
            onClick={() => {
              setSelection(people);
              setOpenNo((n) => n + 1);
              setAdding(true);
            }}
          >
            {hasPeople ? <IconUserEdit className="mr-1.5 h-4 w-4" /> : <IconUserPlus className="mr-1.5 h-4 w-4" />}
            {hasPeople ? tr("Edit Recipients") : tr("Add Recipients")}
          </Button>
        )}
      </div>
      <DataTable
        rows={shown}
        getRowKey={(p) => p.id}
        columns={columns}
        action={action}
        pagination={
          people.length > 0 ? (
            <TablePagination
              currentPage={current}
              totalPages={totalPages}
              totalItems={people.length}
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
            title={tr("No recipient selected")}
            description={disabled ? tr("Nobody receives this schedule.") : tr("Use Add Recipients to choose the people who receive the report.")}
          />
        }
      />
      <PortalDropdownMenu isOpen={!!actionRow} onClose={menu.close} position={menu.position} minWidth={200}>
        {actionRow && (
          <div className="py-1">
            <DropdownMenuItem
              icon={<IconTrash className="h-4 w-4" />}
              onClick={() => {
                menu.close();
                onChange(people.filter((p) => p.id !== actionRow.id));
              }}
            >
              {tr("Remove")}
            </DropdownMenuItem>
          </div>
        )}
      </PortalDropdownMenu>
      <FormModal
        isOpen={adding}
        onClose={() => setAdding(false)}
        title={tr("Recipients of the Scheduled Report")}
        confirmText={`${tr("Save")} (${selection.length})`}
        size="2xl"
        className="max-w-5xl"
        confirmDisabled={selection.length === people.length && selection.every((s) => people.some((p) => p.id === s.id))}
        onConfirm={() => {
          onChange(selection);
          setAdding(false);
        }}
      >
        <ProposedParticipantsPicker
          key={openNo}
          source={recipientSource}
          initialIds={people.map((p) => p.id)}
          initialPeople={people}
          onChange={(_ids, chosen) => setSelection(chosen)}
        />
      </FormModal>
    </div>
  );
}
