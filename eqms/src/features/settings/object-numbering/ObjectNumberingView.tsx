import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { MoreVertical } from "lucide-react";
import { IconPencilMinus } from "@tabler/icons-react";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { PortalDropdownMenu } from "@/components/ui/dropdown";
import { FormModal } from "@/components/ui/modal/FormModal";
import { Switch } from "@/components/ui/switch";
import { DataTable, type DataTableAction, type DataTableColumn } from "@/components/ui/table/DataTable";
import { TableEmptyState } from "@/components/ui/table/TableEmptyState";
import { TABLE_STYLES } from "@/components/ui/table/TablePrimitives";
import { useToast } from "@/components/ui/toast";
import { usePortalDropdown } from "@/hooks";
import { usePermissions } from "@/hooks/usePermissions";
import { objectNumbering } from "@/components/ui/breadcrumb/breadcrumbs/settings";
import { ROUTES } from "@/app/routes.constants";
import { reportError } from "@/services/api/reportTemplates";
import { objectNumberingApi, type ObjectNumberFormat } from "@/services/api/objectNumbering";
import { moduleDisplayName } from "@/utils/moduleDisplay";
import { tr } from "@/i18n";

const labelClass = "text-xs sm:text-sm font-medium text-slate-700 mb-1.5 block";
const inputClass =
  "w-full h-9 px-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-colors placeholder:text-slate-400";
const PREFIX_PATTERN = /^[A-Z][A-Z0-9]{1,9}$/;
/** Typed by hand: up to 3 characters, no space and nothing that could break a code. */
const SEPARATOR_PATTERN = /^[^\s\p{Cc}<>"'\\%]{0,3}$/u;

/** The numbers kept by the screens of their own module; shown here so an administrator knows where each one is set. */
const SET_ELSEWHERE: { label: string; where: string; path: string; permissions: string[] }[] = [
  {
    label: tr("Document numbers"),
    where: "Document Administration > Document Name Formats",
    path: ROUTES.DOCUMENTS.ADMIN.NAME_FORMATS,
    permissions: ["documents.admin.name_formats.view", "documents.admin.name_formats.manage"],
  },
  {
    label: tr("Training numbers"),
    where: "Training Administration > Training Code Rules",
    path: ROUTES.SETTINGS.TRAINING_ADMINISTRATION.CODE_RULES,
    permissions: ["training.admin.properties.view", "training.settings.view"],
  },
  {
    label: tr("Report template names"),
    where: "Report Administration > Report Name Formats",
    path: ROUTES.SETTINGS.REPORT_ADMINISTRATION.NAME_FORMATS,
    permissions: ["reports.definition.view", "reports.name_format.manage"],
  },
];

/**
 * System Administration > Object Numbering (AUDIT-OBJECT-REGISTRY-2026-11-17): the format of the numbers given to the records that had only a name
 * (scheduled reports, campaigns, object access rules, backup alerts, announcements). A number already given never changes; a new format applies to the
 * records made after it. The list is the fixed catalogue of the system (a handful of kinds), so it is shown whole, in the shared table with the
 * three-dot action menu of the other screens.
 */
export const ObjectNumberingView: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { hasAnyPermission } = usePermissions();
  const canManage = hasAnyPermission(["settings.object_numbering.manage"]);
  const { openId: openDropdownId, position: dropdownPosition, getRef: getButtonRef, toggle: handleDropdownToggle, close: closeDropdown } = usePortalDropdown();

  const [rows, setRows] = useState<ObjectNumberFormat[] | null>(null);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<ObjectNumberFormat | null>(null);
  const [prefix, setPrefix] = useState("");
  const [separator, setSeparator] = useState("-");
  const [includeYear, setIncludeYear] = useState(true);
  const [digits, setDigits] = useState(4);
  const [reason, setReason] = useState("");
  const [formError, setFormError] = useState("");
  const [example, setExample] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setRows(await objectNumberingApi.list());
      setError("");
    } catch (e) {
      setError(reportError(e));
      setRows([]);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const open = (row: ObjectNumberFormat) => {
    setEditing(row);
    setPrefix(row.prefix);
    setSeparator(row.separator);
    setIncludeYear(row.includeYear);
    setDigits(row.digits);
    setReason("");
    setFormError("");
    setExample(row.example);
  };

  const validation = useMemo(() => {
    if (!PREFIX_PATTERN.test(prefix.trim().toUpperCase())) return "The prefix is 2 to 10 capital letters or digits and starts with a letter.";
    if (!SEPARATOR_PATTERN.test(separator)) return "The separator is up to 3 characters, without spaces.";
    if (digits < 3 || digits > 10) return "The number has 3 to 10 digits.";
    return "";
  }, [prefix, separator, digits]);

  // The example comes from the server so that the screen and the real number can never differ.
  useEffect(() => {
    if (!editing || validation) return;
    let current = true;
    const timer = window.setTimeout(() => {
      objectNumberingApi
        .preview(editing.kind, { prefix: prefix.trim().toUpperCase(), separator, includeYear, digits })
        .then((p) => current && setExample(p.next))
        .catch(() => undefined);
    }, 250);
    return () => {
      current = false;
      window.clearTimeout(timer);
    };
  }, [editing, prefix, separator, includeYear, digits, validation]);

  const save = async () => {
    if (!editing) return;
    if (validation) return setFormError(validation);
    if (!reason.trim()) return setFormError("Enter the reason for the change.");
    setSaving(true);
    try {
      await objectNumberingApi.update(editing.kind, {
        prefix: prefix.trim().toUpperCase(),
        separator,
        includeYear,
        digits,
        version: editing.version,
        reason: reason.trim(),
      });
      setEditing(null);
      await load();
      showToast({ type: "success", title: tr("Numbering Updated"), message: `"${editing.label}" now makes numbers like ${example}.` });
    } catch (e) {
      setFormError(reportError(e));
    } finally {
      setSaving(false);
    }
  };

  const columns: DataTableColumn<ObjectNumberFormat>[] = [
    { id: "no", header: "No.", label: "No.", locked: true, headerClassName: TABLE_STYLES.headerCell35, cellClassName: TABLE_STYLES.cell30, cell: (_row, index) => index + 1 },
    { id: "label", header: tr("Number"), label: tr("Number"), cell: (row) => <span className="font-medium text-slate-900">{tr(row.label)}</span> },
    { id: "module", header: tr("Module"), label: tr("Module"), cellClassName: "text-slate-600", cell: (row) => tr(moduleDisplayName(row.module)) },
    {
      id: "format",
      header: tr("Format"),
      label: tr("Format"),
      cellClassName: "text-slate-600",
      cell: (row) => `${row.prefix} ${row.separator} ${row.includeYear ? `year ${row.separator} ` : ""}${row.digits} digits`,
    },
    { id: "next", header: tr("Next Number"), label: tr("Next Number"), cellClassName: "text-xs sm:text-sm font-medium text-emerald-600 whitespace-nowrap", cell: (row) => row.example },
    { id: "last", header: tr("Last Given"), label: tr("Last Given"), cellClassName: "text-slate-600", cell: (row) => (row.lastValue > 0 ? row.lastValue : "-") },
  ];

  const action: DataTableAction<ObjectNumberFormat> | undefined = canManage
    ? {
        header: "Action",
        cell: (row) => (
          <button
            ref={getButtonRef(row.kind)}
            onClick={(e) => handleDropdownToggle(row.kind, e)}
            className="inline-flex items-center justify-center h-7 w-7 sm:h-8 sm:w-8 rounded-lg hover:bg-slate-100 transition-colors"
            aria-label={tr("More actions")}
          >
            <MoreVertical className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-slate-600" />
          </button>
        ),
      }
    : undefined;

  const openRow = rows?.find((row) => row.kind === openDropdownId);
  // A person sees a link only to a screen they may open: the same permissions as the menu entry and the route of that screen.
  const links = SET_ELSEWHERE.filter((item) => hasAnyPermission(item.permissions));

  return (
    <div className="h-full flex flex-col gap-4 md:gap-6">
      <PageHeader title={tr("Object Numbering")} breadcrumbItems={objectNumbering(navigate)} />
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}

      <div className="flex-1 min-h-0 overflow-hidden border border-slate-200 rounded-xl bg-white shadow-sm flex flex-col">
        <DataTable
          rows={rows ?? []}
          getRowKey={(row) => row.kind}
          isLoading={rows === null}
          columns={columns}
          action={action}
          emptyState={<TableEmptyState title={tr("No numbering is set up")} description={tr("The numbers of the system appear here.")} />}
        />
      </div>

      {links.length > 0 && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 md:p-5">
          <h3 className="text-sm font-semibold text-emerald-900 mb-3 flex items-center gap-2">{tr("Set on the screen of their own module")}</h3>
          <ul className="space-y-2 text-xs sm:text-sm text-emerald-800 list-disc pl-5 marker:text-emerald-600">
            {links.map((item) => (
              <li key={item.label}>
                <span>
                  {item.label}:{" "}
                  <Link to={item.path} className="font-semibold text-emerald-700 hover:underline">
                    {item.where}
                  </Link>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <PortalDropdownMenu isOpen={!!openDropdownId} onClose={closeDropdown} position={dropdownPosition}>
        <div className="py-1.5">
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (openRow) open(openRow);
              closeDropdown();
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-xs text-slate-500 hover:bg-slate-50 transition-colors"
          >
            <IconPencilMinus className="h-3.5 w-3.5" />
            <span>{tr("Edit Numbering Format")}</span>
          </button>
        </div>
      </PortalDropdownMenu>

      <FormModal
        isOpen={editing !== null}
        onClose={() => setEditing(null)}
        onConfirm={save}
        title={editing ? `Edit ${editing.label}` : ""}
        description={tr("The change applies to the numbers given after you save. Each change is recorded in the Audit Trail.")}
        confirmText="Save"
        isLoading={saving}
        size="lg"
        dirty={
          editing !== null &&
          (prefix !== editing.prefix || separator !== editing.separator || includeYear !== editing.includeYear || digits !== editing.digits || reason.trim() !== "")
        }
      >
        <div className="grid grid-cols-1 gap-4">
          <div>
            <label className={labelClass} htmlFor="on-prefix">{tr("Prefix")}</label>
            <input id="on-prefix" className={inputClass} value={prefix} maxLength={10} onChange={(e) => { setPrefix(e.target.value.toUpperCase()); setFormError(""); }} />
          </div>
          <div>
            <label className={labelClass} htmlFor="on-separator">{tr("Separator")}</label>
            <input id="on-separator" className={inputClass} value={separator} maxLength={3} onChange={(e) => { setSeparator(e.target.value); setFormError(""); }} placeholder={tr("e.g. -   or   /   (can be empty)")} />
          </div>
          <div>
            <label className={labelClass} htmlFor="on-digits">{tr("Digits of the sequence")}</label>
            <input id="on-digits" type="number" min={3} max={10} className={inputClass} value={digits} onChange={(e) => { setDigits(Number(e.target.value)); setFormError(""); }} />
          </div>
          <div className="flex items-end gap-3 pb-1.5">
            <Switch checked={includeYear} onChange={setIncludeYear} aria-label={tr("Include the year")} />
            <span className="text-sm text-slate-700">{tr("Include the year (the sequence starts again each year)")}</span>
          </div>
          <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-sm">
              {tr("Next number:")} <span className="font-mono font-medium text-slate-900">{validation ? "-" : example}</span>
          </div>
          <div>
            <label className={labelClass} htmlFor="on-reason">{tr("Reason for the change")}</label>
            <textarea id="on-reason" rows={2} maxLength={1000} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 resize-none" value={reason} onChange={(e) => { setReason(e.target.value); setFormError(""); }} placeholder={tr("Recorded with your name and the time")} />
          </div>
          {(formError || validation) && <p role="alert" className="text-xs text-red-600">{formError || validation}</p>}
        </div>
      </FormModal>
    </div>
  );
};

export default ObjectNumberingView;
