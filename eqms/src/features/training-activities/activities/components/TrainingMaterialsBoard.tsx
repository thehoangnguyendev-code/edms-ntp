import { useState, type ReactNode } from "react";
import { CloudUpload, Download, ExternalLink, Eye, Link2, Lock, MoreVertical, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge/Badge";
import { Button } from "@/components/ui/button/Button";
import { FormField } from "@/components/ui/form/ResponsiveForm";
import { FormModal } from "@/components/ui/modal/FormModal";
import { TabNav } from "@/components/ui/tabs/TabNav";
import { DataTable, type DataTableAction, type DataTableColumn, type DataTableColumnLayout } from "@/components/ui/table";
import { DropdownMenuItem, PortalDropdownMenu } from "@/components/ui/dropdown";
import { usePortalDropdown } from "@/hooks/usePortalDropdown";
import { getFileIconSrc } from "@/utils/fileIcons";
import { Input } from "../../shared/TrainingFields";
import { TrainingFileDropzone } from "../../shared/TrainingFileDropzone";

export type TrainingMaterialsLayout = "TABLE" | "TILES";

/** One material as the board shows it, whether it is already on record or only waits for the activity to be saved. */
export interface MaterialItem {
  id: string;
  title: string;
  /** A link has an address and no file. */
  linkUrl?: string | null;
  fileName?: string | null;
  sizeBytes?: number | null;
  sha256?: string | null;
  /** Who added it and when, as text; empty for a material that is not saved yet. */
  addedBy?: string;
  /** The material waits on the New screen and is saved with the activity. */
  staged?: boolean;
  removedAt?: string | null;
  removeReason?: string | null;
}

const ACCEPT = ".pdf,.png,.jpg,.jpeg,.docx,.xlsx,.pptx,.mp4";
const size = (bytes: number) => (bytes > 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);
const host = (url: string) => {
  try {
    const u = new URL(url);
    return `${u.host}${u.pathname === "/" ? "" : u.pathname}`;
  } catch {
    return url;
  }
};

/** "Nguyen The Hoang (27/10/2026)" gives "TH". */
const initials = (text?: string) =>
  (text ?? "").split(" (")[0].split(/\s+/).filter(Boolean).map((w) => w[0]).slice(-2).join("").toUpperCase();

interface Props {
  layout: TrainingMaterialsLayout;
  items: MaterialItem[];
  /** Adding is allowed on this screen at this time. */
  canAdd: boolean;
  /** Removing is allowed (the New screen removes at once; the planning screen asks for a reason first, in the parent). */
  canRemove: boolean;
  /** Said under the add area (or instead of it) when materials can no longer be changed here. */
  lockedNote?: string;
  /** Said when the list is empty. */
  emptyText: ReactNode;
  busy?: boolean;
  /** An upload in progress: its file and the share sent so far. */
  sending?: { file: File; percent: number };
  onAddFile: (file: File, title: string) => Promise<boolean> | boolean;
  onAddLink: (title: string, url: string) => Promise<boolean> | boolean;
  onRemove: (item: MaterialItem) => void;
  /** Only for a file that is on record. */
  onPreview?: (item: MaterialItem) => void;
  onDownload?: (item: MaterialItem) => void;
}

/**
 * The materials of a training, the same on every screen that shows them (New, planning, conduct): the same add area on top, the same facts for each material, the same actions.
 * The administrator chooses how the list is drawn (Configuration, General, User Interface): a table, or tiles with a drop zone.
 */
export function TrainingMaterialsBoard(props: Props) {
  const { layout, items, canAdd, canRemove, lockedNote, emptyText, busy = false, sending } = props;
  const [form, setForm] = useState<{ mode: "file" | "link"; file: File | null; title: string; url: string }>({ mode: "file", file: null, title: "", url: "" });
  const [dialog, setDialog] = useState(false);
  const menu = usePortalDropdown();
  const ready = form.mode === "link" ? /^https:\/\/\S+$/i.test(form.url.trim()) : !!form.file;
  const reset = () => setForm({ mode: form.mode, file: null, title: "", url: "" });
  const add = async () => {
    const ok = form.mode === "link" ? await props.onAddLink(form.title.trim(), form.url.trim()) : await props.onAddFile(form.file as File, form.title.trim());
    if (ok) {
      reset();
      setDialog(false);
    }
  };

  const fields = (
    <div className="space-y-3">
      <TabNav
        tabs={[
          { id: "file", label: "Upload file", icon: CloudUpload },
          { id: "link", label: "Link (for example YouTube)", icon: Link2 },
        ]}
        activeTab={form.mode}
        onChange={(id) => setForm({ ...form, mode: id as "file" | "link" })}
        variant="pill"
        layoutId={`training-material-mode-${layout}`}
      />
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4">
        <div className="md:col-span-2">
          {form.mode === "file" ? (
            <TrainingFileDropzone
              label="File"
              required
              accept={ACCEPT}
              maxMb={form.file?.name.toLowerCase().endsWith(".mp4") ? 100 : 20}
              hint="PDF, picture, Office file (max 20 MB) or MP4 video (max 100 MB)"
              file={sending?.file ?? form.file}
              uploading={sending ? { percent: sending.percent } : undefined}
              onChange={(f) => setForm({ ...form, file: f })}
            />
          ) : (
            <div className="space-y-1">
              <FormField label="Address" required>
                <Input value={form.url} placeholder="https://www.youtube.com/watch?v=…" onChange={(e) => setForm({ ...form, url: e.target.value })} />
              </FormField>
              <p className="text-xs text-amber-700">A link is not stored or fingerprinted. The page it points to can change after the content is approved.</p>
            </div>
          )}
        </div>
        <div className="md:col-span-2">
          <FormField label="Title">
            <Input value={form.title} maxLength={255} placeholder="Shown in the list of materials" onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </FormField>
        </div>
      </div>
    </div>
  );

  const canPreview = (m: MaterialItem) => !!props.onPreview && !m.staged && !m.linkUrl && /\.(pdf|docx)$/i.test(m.fileName ?? "");
  const canDownload = (m: MaterialItem) => !!props.onDownload && !m.staged && !m.linkUrl;
  const openLink = (m: MaterialItem) => window.open(m.linkUrl as string, "_blank", "noopener,noreferrer");
  /** The button that says what a person will most likely do with the material (tiles only; a table row has the menu alone). */
  const primary = (m: MaterialItem): { key: "open" | "preview" | "download"; label: string; icon: ReactNode; run: () => void } | null =>
    m.linkUrl
      ? { key: "open", label: "Open", icon: <ExternalLink className="h-4 w-4" aria-hidden="true" />, run: () => openLink(m) }
      : canPreview(m)
        ? { key: "preview", label: "Preview", icon: <Eye className="h-4 w-4" aria-hidden="true" />, run: () => props.onPreview?.(m) }
        : canDownload(m)
          ? { key: "download", label: "Download", icon: <Download className="h-4 w-4" aria-hidden="true" />, run: () => props.onDownload?.(m) }
          : null;
  type Entry = { key: string; label: string; icon: ReactNode; danger?: boolean; run: () => void };
  /** What the three-dots menu offers. A tile already has the main action as a button, so the menu never says it a second time. */
  const entriesOf = (m: MaterialItem): Entry[] => {
    const all: Entry[] = [];
    if (m.linkUrl) all.push({ key: "open", label: "Open", icon: <ExternalLink className="h-4 w-4" />, run: () => openLink(m) });
    if (canPreview(m)) all.push({ key: "preview", label: "Preview", icon: <Eye className="h-4 w-4" />, run: () => props.onPreview?.(m) });
    if (canDownload(m)) all.push({ key: "download", label: "Download", icon: <Download className="h-4 w-4" />, run: () => props.onDownload?.(m) });
    if (canRemove && !m.removedAt) all.push({ key: "remove", label: "Remove", icon: <Trash2 className="h-4 w-4" />, danger: true, run: () => props.onRemove(m) });
    const main = layout === "TILES" ? primary(m)?.key : undefined;
    return all.filter((e) => e.key !== main);
  };
  /** No menu when there is nothing in it: a dead control is worse than none. */
  const menuButton = (m: MaterialItem, className = "") =>
    entriesOf(m).length === 0 ? null : (
      <button
        type="button"
        ref={menu.getRef(m.id)}
        aria-label={`More actions for ${m.title}`}
        className={`inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-slate-200 md:h-8 md:w-8 ${className}`}
        onClick={(event) => menu.toggle(m.id, event)}
      >
        <MoreVertical className="h-4 w-4" />
      </button>
    );
  const openItem = items.find((m) => m.id === menu.openId);
  const typeBadges = (m: MaterialItem) => (
    <div className="flex flex-wrap items-center gap-1.5">
      {m.linkUrl && <Badge color="amber" size="sm">Link, not a controlled file</Badge>}
      {m.staged && <Badge color="emerald" size="sm">Not saved yet</Badge>}
    </div>
  );
  const subline = (m: MaterialItem): ReactNode =>
    m.linkUrl ? (
      <a href={m.linkUrl} target="_blank" rel="noopener noreferrer" className="break-all text-emerald-600 hover:underline">{host(m.linkUrl)}</a>
    ) : (
      `${m.fileName ?? "file"}${m.sizeBytes ? ` · ${size(m.sizeBytes)}` : ""}`
    );
  const removedNote = (m: MaterialItem) =>
    m.removedAt ? <div className="text-xs text-red-700">Removed {m.removedAt}: {m.removeReason}</div> : null;
  const fingerprint = (m: MaterialItem) =>
    m.sha256 ? (
      <div className="font-mono text-xs text-slate-500" title={m.sha256}>SHA-256 {m.sha256.slice(0, 12)}…{m.sha256.slice(-6)}</div>
    ) : null;
  const added = (m: MaterialItem) => (m.staged ? "Saved with the activity" : m.addedBy ?? "");

  const columns: DataTableColumn<MaterialItem>[] = [
    { id: "rowNo", header: "No.", locked: true, cell: (_m, i) => i + 1 },
    {
      id: "title",
      header: "Title",
      cell: (m) => (
        <div className="max-w-80 whitespace-normal">
          {m.title}
          {removedNote(m)}
        </div>
      ),
    },
    {
      id: "file",
      header: "File or link",
      cell: (m) => (
        <div className="max-w-80 space-y-1 whitespace-normal">
          <div className="text-slate-700">{subline(m)}</div>
          {fingerprint(m)}
          {typeBadges(m)}
        </div>
      ),
    },
    { id: "by", header: "Uploaded by", cell: (m) => <div className="max-w-60 whitespace-normal">{added(m)}</div> },
  ];
  const tableLayout: DataTableColumnLayout<MaterialItem> = { columns, pinnedIds: ["rowNo"] };
  const tableAction: DataTableAction<MaterialItem> = { cell: (m) => menuButton(m) };

  const empty = <div className="p-4 text-sm text-slate-500">{emptyText}</div>;
  const head = (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h3 className="text-sm font-semibold text-slate-800">{items.length} material{items.length === 1 ? "" : "s"}</h3>
      {layout === "TABLE" && canAdd && (
        <Button size="sm" variant="outline-emerald" onClick={() => setDialog(true)}>
          <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />Add material
        </Button>
      )}
    </div>
  );
  const lock = lockedNote ? (
    <p className="flex items-center gap-2 text-xs text-slate-500">
      <Lock className="h-3.5 w-3.5 flex-none" aria-hidden="true" />
      {lockedNote}
    </p>
  ) : null;

  return (
    <div className="space-y-4">
      {layout === "TILES" && canAdd && (
        <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Add material</h3>
            <p className="mt-0.5 text-xs text-slate-500">Drop a file or paste a link. Files are fingerprinted when they are saved.</p>
          </div>
          {fields}
          <div>
            <Button size="sm" variant="outline-emerald" loading={busy || !!sending} disabled={!ready} onClick={() => void add()}>
              {form.mode === "link" ? "Add link" : "Add material"}
            </Button>
          </div>
        </div>
      )}
      {head}
      {layout === "TABLE" ? (
        <DataTable rows={items} getRowKey={(m) => m.id} columns={columns} columnLayout={tableLayout} action={tableAction} emptyState={empty} />
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/50">{empty}</div>
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((m) => {
            const main = primary(m);
            return (
              <li
                key={m.id}
                className={`flex min-w-0 flex-col rounded-2xl border border-slate-200 bg-white p-4 ${m.removedAt ? "bg-slate-50" : ""}`}
              >
                <div className="flex items-start gap-3">
                  {/* ring, not border: the box has a fixed size */}
                  <span className="flex h-11 w-11 flex-none items-center justify-center rounded-xl bg-white ring-1 ring-slate-200">
                    {m.linkUrl ? (
                      <Link2 className="h-5 w-5 text-slate-500" aria-hidden="true" />
                    ) : (
                      <img src={getFileIconSrc(m.fileName ?? "")} alt="" className="h-7 w-7 object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <h4 className={`line-clamp-2 break-words text-sm font-semibold leading-5 ${m.removedAt ? "text-slate-500 line-through" : "text-slate-900"}`} title={m.title}>{m.title}</h4>
                    <p className="mt-0.5 truncate text-xs text-slate-500" title={m.linkUrl ?? m.fileName ?? undefined}>
                      {m.linkUrl ? host(m.linkUrl) : `${m.fileName ?? "file"}${m.sizeBytes ? ` · ${size(m.sizeBytes)}` : ""}`}
                    </p>
                  </div>
                  {menuButton(m, "-mr-1 -mt-1 flex-none")}
                </div>
                {(m.linkUrl || m.staged || m.removedAt || m.sha256) && (
                  <div className="mt-3 space-y-1.5">
                    {typeBadges(m)}
                    {removedNote(m)}
                    {fingerprint(m)}
                  </div>
                )}
                <div className="mt-auto pt-4">
                  <div className="flex items-center gap-2 border-t border-slate-100 pt-3">
                    {m.staged ? (
                      <span className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-slate-100 text-slate-500" aria-hidden="true">
                        <CloudUpload className="h-3.5 w-3.5" />
                      </span>
                    ) : (
                      <span className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-slate-100 text-[11px] font-semibold text-slate-600" aria-hidden="true">
                        {initials(m.addedBy) || "-"}
                      </span>
                    )}
                    <span className="min-w-0 flex-1 truncate text-xs text-slate-500" title={added(m)}>{added(m)}</span>
                    {main && (
                      <Button size="sm" variant="outline-emerald" onClick={main.run}>
                        <span className="mr-1.5">{main.icon}</span>{main.label}
                      </Button>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {lock}
      <PortalDropdownMenu isOpen={!!openItem} onClose={menu.close} position={menu.position} minWidth={200}>
        {openItem && (
          <div className="py-1">
            {entriesOf(openItem).map((e) => (
              <DropdownMenuItem key={e.key} variant={e.danger ? "danger" : "default"} icon={e.icon} onClick={() => { menu.close(); e.run(); }}>
                {e.label}
              </DropdownMenuItem>
            ))}
          </div>
        )}
      </PortalDropdownMenu>
      <FormModal
        isOpen={dialog}
        onClose={() => setDialog(false)}
        title="Add Material"
        confirmText="Add material"
        isLoading={busy || !!sending}
        confirmDisabled={!ready}
        size="md"
        onConfirm={() => void add()}
      >
        {fields}
      </FormModal>
    </div>
  );
}
