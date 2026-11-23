import React, { useMemo, useRef, useState } from "react";
import { ChevronRight, Lock, Pencil, ScanEye } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge/Badge";
import { FormSection } from "@/components/ui/form/FormSection";
import { cn } from "@/components/ui/utils";
import { gsap, prefersReducedMotion, useGSAP } from "@/lib/gsap";
import { moduleDisplayName, sortModulesLikeMenu } from "@/utils/moduleDisplay";
import { tr, trFormat } from "@/i18n";

export interface ReviewPermissionSet { id: string; name: string; count: number }
export interface ReviewVisibility { module: string; level: string }
export interface ReviewRole { code: string; label: string; module: string }
export interface ReviewUser { id: string; fullName: string; employeeCode?: string | null; department?: string | null; avatar?: string | null }

interface ModuleRow { module: string; permissions: number; records: string | null; roles: string[] }

const editClass =
  "inline-flex items-center gap-1 rounded text-xs font-medium normal-case tracking-normal text-emerald-700 transition-colors hover:text-emerald-800 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500";

/** The columns of the matrix on a laptop (module | permissions | records | roles) and of the user list. */
const MATRIX_GRID = "md:grid-cols-[minmax(0,1.2fr)_6.5rem_minmax(0,1.6fr)_minmax(0,2fr)]";
const USERS_GRID = "md:grid-cols-[8rem_minmax(0,1.3fr)_minmax(0,1fr)]";

const Caption: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className="text-2xs font-semibold uppercase tracking-wider text-slate-500">{children}</span>
);

const EditButton: React.FC<{ onClick: () => void; label?: string }> = ({ onClick, label = "Edit" }) => (
  <button type="button" onClick={onClick} className={editClass} aria-label={label || "Edit"}>
    <Pencil className="h-3 w-3" /> {label}
  </button>
);

const Dash: React.FC = () => <span className="text-slate-300">—</span>;

const RoleChip: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className="rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">{children}</span>
);

/** Phone: a module is one line (name, permissions) that opens to show the records and the roles; one is open at a time, the open and the close slide. */
const PhoneModule: React.FC<{ row: ModuleRow; open: boolean; onToggle: () => void; onEdit: (step: number) => void }> = ({ row, open, onToggle, onEdit }) => (
  <li className="border-b border-slate-100 last:border-b-0">
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      className="flex w-full items-center gap-2 px-4 py-3 text-left transition-colors hover:bg-slate-50 focus:outline-none focus-visible:bg-slate-50"
    >
      <ChevronRight className={cn("h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200", open && "rotate-90")} />
      <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-900">{row.module}</span>
      <span className="shrink-0 text-sm tabular-nums text-slate-600">{row.permissions}</span>
    </button>
    <div className={cn("grid transition-[grid-template-rows] duration-200 ease-out", open ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
      <div className="overflow-hidden">
        <dl className="space-y-3 px-4 pb-3 pl-10 text-sm">
          <div>
            <dt className="flex items-center gap-2 text-2xs font-semibold uppercase tracking-wider text-slate-400">{tr("Records they can see")} <EditButton onClick={() => onEdit(1)} label="" /></dt>
            <dd className="mt-0.5 text-slate-800">{row.records ?? <Dash />}</dd>
          </div>
          <div>
            <dt className="flex items-center gap-2 text-2xs font-semibold uppercase tracking-wider text-slate-400">{tr("Workflow roles")} <EditButton onClick={() => onEdit(2)} label="" /></dt>
            <dd className="mt-1 flex flex-wrap gap-1.5">{row.roles.length === 0 ? <Dash /> : row.roles.map((role) => <RoleChip key={role}>{role}</RoleChip>)}</dd>
          </div>
        </dl>
      </div>
    </div>
  </li>
);

/**
 * Last step of the Access Profile wizard: the record that will be created, read once before the signature. One card, two parts.
 *  1. "What people with this profile can do": one row for each module the profile touches (a permission, a workflow role or a record-visibility choice): how many permissions it
 *     grants there, which records the person sees, which workflow roles they are eligible for; a Total row says where the permissions come from. On a laptop it is a table whose
 *     column captions carry the Edit link of the step that decides the column. On a phone it is a short list of one line per module that opens on a tap.
 *  2. "Who receives it now": the first users. A table on a laptop (Employee ID, name with photo, department); on a phone a name with the Employee ID, nothing else.
 * The numbers count distinct permissions, so a permission that two sets both grant is counted once.
 */
export const WizardReviewStep: React.FC<{
  name: string;
  description: string;
  /** "existing": the sets that were picked (plus direct permissions); "custom": one new set made from the ticked permissions. */
  permissionMode: "existing" | "custom";
  sets: readonly ReviewPermissionSet[];
  /** Distinct permissions the profile will hold. */
  permissionTotal: number;
  /** Distinct permissions by module display name. */
  permissionsByModule: Readonly<Record<string, number>>;
  visibility: readonly ReviewVisibility[];
  roles: readonly ReviewRole[];
  users: readonly ReviewUser[];
  /** Jumps to a step (0 Basic Info, 1 Permissions, 2 Workflow Eligibility, 3 Users). */
  onEdit: (step: number) => void;
}> = ({ name, description, permissionMode, sets, permissionTotal, permissionsByModule, visibility, roles, users, onEdit }) => {
  const sheet = useRef<HTMLDivElement>(null);
  const [openModule, setOpenModule] = useState<string | null>(null);

  // the parts fade in one after the other once, when the step opens; nothing moves for a person who asked for reduced motion
  useGSAP(
    () => {
      if (prefersReducedMotion()) return;
      gsap.from("[data-review-part]", { opacity: 0, y: 6, duration: 0.26, ease: "power2.out", stagger: 0.05, clearProps: "opacity,transform" });
    },
    { scope: sheet },
  );

  const rows = useMemo<ModuleRow[]>(() => {
    const visibilityOf = new Map(visibility.map((row) => [row.module, row.level]));
    const rolesOf = new Map<string, string[]>();
    for (const role of roles) {
      const module = moduleDisplayName(role.module);
      rolesOf.set(module, [...(rolesOf.get(module) ?? []), role.label]);
    }
    const modules = new Set<string>([...Object.keys(permissionsByModule), ...visibilityOf.keys(), ...rolesOf.keys()]);
    const sorted = sortModulesLikeMenu([...modules], (module) => module).map((module) => ({
      module,
      permissions: permissionsByModule[module] ?? 0,
      records: visibilityOf.get(module) ?? null,
      roles: rolesOf.get(module) ?? [],
    }));
    // a permission the catalogue does not know by module is still granted: it is counted in the total and shown on its own line
    const other = permissionTotal - Object.values(permissionsByModule).reduce((sum, count) => sum + count, 0);
    return other > 0 ? [...sorted, { module: "Other", permissions: other, records: null, roles: [] }] : sorted;
  }, [permissionsByModule, permissionTotal, visibility, roles]);

  const origin =
    permissionMode === "custom"
      ? "the permissions ticked in this wizard (they become one new permission set of this profile)"
      : sets.length === 0
        ? "no permission set"
        : `${sets.length} permission set${sets.length === 1 ? "" : "s"}: ${sets.map((set) => `${set.name} (${set.count})`).join(", ")}`;

  const nothing = rows.length === 0;

  return (
    <FormSection
      title={tr("Review & Create")}
      icon={<ScanEye className="h-4 w-4" />}
      description={tr("Nothing has been saved yet — everything below is created in one batch after you sign.")}
      contentClassName="p-4 md:p-5"
    >
      <div ref={sheet} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div data-review-part className="px-4 py-4 md:px-5">
          <div className="flex items-start justify-between gap-3">
            <h3 className="min-w-0 break-words text-base font-semibold leading-tight text-slate-900 md:text-lg">{name}</h3>
            <div className="flex shrink-0 items-center gap-2">
              <span className="hidden md:inline-flex"><Badge color="teal" size="sm">{tr("Custom")}</Badge></span>
              <span className="hidden md:inline-flex"><Badge color="emerald" size="sm">{tr("Active")}</Badge></span>
              <EditButton onClick={() => onEdit(0)} />
            </div>
          </div>
          {description && <p className="mt-1 line-clamp-2 break-words text-sm text-slate-600 md:line-clamp-none">{description}</p>}
          <div className="mt-2 flex items-center gap-2 md:hidden">
            <Badge color="teal" size="sm">{tr("Custom")}</Badge>
            <Badge color="emerald" size="sm">{tr("Active")}</Badge>
          </div>
        </div>

        <div data-review-part>
          <div className="flex items-center gap-2 px-4 pb-2 md:px-5">
            <Caption>{tr("What people with this profile can do")}</Caption>
          </div>

          {nothing ? (
            <p className="border-t border-slate-200 px-4 py-3 text-sm text-slate-500 md:px-5">{tr("This profile grants nothing yet — go back and choose permissions.")}</p>
          ) : (
            <>
              {/* laptop: one table */}
              <div className="hidden md:block">
                <div className={`grid gap-x-4 border-y border-slate-200 bg-slate-50 px-5 py-2 text-2xs font-semibold uppercase tracking-wider text-slate-500 ${MATRIX_GRID}`}>
                  <span>{tr("Module")}</span>
                  <span className="text-right">{tr("Permissions")}</span>
                  <span className="flex items-center gap-2">{tr("Records they can see")} <EditButton onClick={() => onEdit(1)} label="" /></span>
                  <span className="flex items-center gap-2">{tr("Workflow roles")} <EditButton onClick={() => onEdit(2)} label="" /></span>
                </div>
                {rows.map((row) => (
                  <div key={row.module} className={`grid items-center gap-x-4 border-b border-slate-100 px-5 py-2.5 text-sm text-slate-800 ${MATRIX_GRID}`}>
                    <span className="font-medium text-slate-900">{row.module}</span>
                    <span className="text-right tabular-nums">{row.permissions > 0 ? row.permissions : <Dash />}</span>
                    <span>{row.records ?? <Dash />}</span>
                    <span className="flex flex-wrap items-center gap-1.5">{row.roles.length === 0 ? <Dash /> : row.roles.map((role) => <RoleChip key={role}>{role}</RoleChip>)}</span>
                  </div>
                ))}
                <div className={`grid items-baseline gap-x-4 bg-slate-50 px-5 py-2.5 text-sm ${MATRIX_GRID}`}>
                  <span className="font-semibold text-slate-900">{tr("Total")}</span>
                  <span className="text-right font-semibold tabular-nums text-slate-900">{permissionTotal}</span>
                  <span className="col-span-2 text-xs text-slate-500">{trFormat("from {origin}; a permission granted twice is counted once", { origin })}</span>
                </div>
              </div>

              {/* phone: one line for each module, opens on a tap */}
              <div className="md:hidden">
                <ul className="border-t border-slate-200">
                  {rows.map((row) => (
                    <PhoneModule key={row.module} row={row} open={openModule === row.module} onToggle={() => setOpenModule((current) => (current === row.module ? null : row.module))} onEdit={onEdit} />
                  ))}
                </ul>
                <div className="flex items-baseline justify-between border-t border-slate-200 bg-slate-50 px-4 py-2.5 text-sm">
                  <span className="font-semibold text-slate-900">{tr("Total permissions")}</span>
                  <span className="font-semibold tabular-nums text-slate-900">{permissionTotal}</span>
                </div>
              </div>
            </>
          )}
        </div>

        <div data-review-part>
          <div className="flex items-center gap-2 border-t border-slate-200 px-4 pb-2 pt-4 md:px-5">
            <Caption>{tr("Who receives it now")}</Caption>
            <span className="text-xs text-slate-500">{users.length}</span>
            <span className="ml-auto"><EditButton onClick={() => onEdit(3)} /></span>
          </div>
          {users.length === 0 ? (
            <p className="border-t border-slate-200 px-4 py-3 text-sm text-slate-500 md:px-5">{tr("None — assign users later from the profile's Assigned Users tab.")}</p>
          ) : (
            <div>
              <div className={`hidden grid-cols-1 gap-x-4 border-y border-slate-200 bg-slate-50 px-5 py-2 text-2xs font-semibold uppercase tracking-wider text-slate-500 md:grid ${USERS_GRID}`}>
                <span>{tr("Employee ID")}</span>
                <span>{tr("Full name")}</span>
                <span>{tr("Department")}</span>
              </div>
              <ul className="max-h-72 overflow-y-auto border-t border-slate-200 md:max-h-60 md:border-t-0">
                {users.map((user) => (
                  <li key={user.id} className={`flex items-center gap-3 border-b border-slate-100 px-4 py-2.5 text-sm last:border-b-0 md:grid md:gap-x-4 md:px-5 ${USERS_GRID}`}>
                    <span className="order-2 ml-auto shrink-0 text-xs font-medium text-emerald-700 md:order-none md:ml-0 md:text-sm">{user.employeeCode || "—"}</span>
                    <span className="flex min-w-0 flex-1 items-center gap-2.5 md:flex-none">
                      <Avatar name={user.fullName || "User"} src={user.avatar ?? undefined} tone="brand" className="h-7 w-7 shrink-0" />
                      <span className="truncate font-medium text-slate-900">{user.fullName}</span>
                    </span>
                    <span className="hidden truncate text-slate-700 md:block">{user.department || "—"}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div data-review-part className="flex items-start gap-2 border-t border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600 md:px-5">
          <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
          <span>
            {tr("Created in")} <strong className="font-semibold text-slate-800">{tr("one atomic operation")}</strong> {tr("under a single electronic signature")}<span className="hidden md:inline"> {tr("— if any step fails (e.g. a Segregation-of-Duties conflict), nothing is created")}</span>.
          </span>
        </div>
      </div>
    </FormSection>
  );
};
