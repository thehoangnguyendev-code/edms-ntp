import { useState, type ReactNode } from "react";
import { ChevronRight, Download, ExternalLink, Eye, Link2, Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge/Badge";
import { Button } from "@/components/ui/button/Button";
import { Drawer } from "@/components/ui/drawer/Drawer";
import { getFileIconSrc } from "@/utils/fileIcons";
import type { MaterialItem } from "./TrainingMaterialsBoard";
import { tr } from "@/i18n";

const size = (bytes: number) => (bytes > 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);
const host = (url: string) => {
  try {
    const u = new URL(url);
    return `${u.host}${u.pathname === "/" ? "" : u.pathname}`;
  } catch {
    return url;
  }
};
const isPhone = () => typeof window !== "undefined" && window.matchMedia("(max-width: 1023px)").matches;

/** The line under a title: the file name and size, or the address of a link. */
const metaOf = (m: MaterialItem) => (m.linkUrl ? host(m.linkUrl) : `${m.fileName ?? "file"}${m.sizeBytes ? ` · ${size(m.sizeBytes)}` : ""}`);

function Tile({ m, className = "h-10 w-10" }: { m: MaterialItem; className?: string }) {
  return (
    <span className={`flex flex-none items-center justify-center rounded-lg bg-white ring-1 ring-slate-200 ${className}`}>
      {m.linkUrl ? (
        <Link2 className="h-5 w-5 text-slate-500" aria-hidden="true" />
      ) : (
        <img src={getFileIconSrc(m.fileName ?? "")} alt="" className="h-3/4 w-3/4 object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
      )}
    </span>
  );
}

/**
 * The materials of a training as the session workspace shows them: nothing is added or removed here, a person picks one and opens it.
 * A desktop has the list and, beside it, the facts and the buttons of the chosen material; a phone has the list alone and opens the facts in a sheet from the bottom.
 */
export function TrainingMaterialsReader({ items, lockedNote, emptyText, onPreview, onDownload }: {
  items: MaterialItem[];
  lockedNote?: string;
  emptyText: ReactNode;
  /** Only for a file that is on record (PDF or Word). */
  onPreview?: (item: MaterialItem) => void;
  onDownload?: (item: MaterialItem) => void;
}) {
  const [picked, setPicked] = useState<string>();
  const [sheet, setSheet] = useState(false);
  const chosen = items.find((m) => m.id === picked) ?? items.find((m) => !m.removedAt) ?? items[0];

  const canPreview = (m: MaterialItem) => !!onPreview && !m.removedAt && !m.linkUrl && /\.(pdf|docx)$/i.test(m.fileName ?? "");
  const canDownload = (m: MaterialItem) => !!onDownload && !m.removedAt && !m.linkUrl;
  const open = (m: MaterialItem) => window.open(m.linkUrl as string, "_blank", "noopener,noreferrer");

  const buttons = (m: MaterialItem, tall: string) => {
    if (m.removedAt) return null;
    const main = m.linkUrl ? { label: "Open", icon: ExternalLink, run: () => open(m) } : canPreview(m) ? { label: "Preview", icon: Eye, run: () => onPreview?.(m) } : null;
    return (
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-1">
        {main && (
          <Button size="sm" className={tall} onClick={main.run}>
            <main.icon className="mr-1.5 h-4 w-4" aria-hidden="true" />{main.label}
          </Button>
        )}
        {canDownload(m) && (
          <Button size="sm" variant={main ? "outline-emerald" : "default"} className={`${tall} ${main ? "" : "col-span-2 lg:col-span-1"}`} onClick={() => onDownload?.(m)}>
            <Download className="mr-1.5 h-4 w-4" aria-hidden="true" />{tr("Download")}
          </Button>
        )}
      </div>
    );
  };

  const facts = (m: MaterialItem) => (
    <dl className="grid gap-3 text-sm">
      <div>
        <dt className="text-xs text-slate-500">{m.linkUrl ? "Link" : "File"}</dt>
        <dd className="break-all font-medium text-slate-900">
          {m.linkUrl ? <a href={m.linkUrl} target="_blank" rel="noopener noreferrer" className="text-emerald-600 hover:underline">{host(m.linkUrl)}</a> : metaOf(m)}
        </dd>
      </div>
      {m.addedBy ? (
        <div>
          <dt className="text-xs text-slate-500">{tr("Added by")}</dt>
          <dd className="font-medium text-slate-900">{m.addedBy}</dd>
        </div>
      ) : null}
      {m.sha256 ? (
        <div>
          <dt className="text-xs text-slate-500">SHA-256</dt>
          <dd className="break-all font-mono text-xs text-slate-700">{m.sha256}</dd>
        </div>
      ) : null}
      {m.linkUrl ? <Badge color="amber" size="sm">{tr("Link, not a controlled file")}</Badge> : null}
        {m.removedAt ? <p className="text-xs text-red-700">{tr("Removed")} {m.removedAt}: {m.removeReason}</p> : null}
    </dl>
  );

  const detail = (m: MaterialItem, tall: string) => (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Tile m={m} className="h-12 w-12" />
        <h4 className={`min-w-0 break-words text-sm font-semibold leading-snug ${m.removedAt ? "text-slate-500 line-through" : "text-slate-900"}`}>{m.title}</h4>
      </div>
      {facts(m)}
      {buttons(m, tall)}
    </div>
  );

  if (items.length === 0) return <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/50 p-4 text-sm text-slate-500">{emptyText}</div>;

  return (
    <section aria-label={tr("Materials")} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="flex items-center justify-between gap-2 border-b border-slate-200 px-4 py-3 md:px-5">
        <h3 className="text-sm font-semibold text-slate-800">{items.length} {tr("material")}{items.length === 1 ? "" : "s"}</h3>
      </div>
      <div className="grid lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 lg:border-r lg:border-slate-200">
          {lockedNote ? (
            <p className="flex items-start gap-2 px-4 pb-1 pt-3 text-xs text-slate-500 md:px-5">
              <Lock className="mt-0.5 h-3.5 w-3.5 flex-none" aria-hidden="true" />{lockedNote}
            </p>
          ) : null}
          <ul className="divide-y divide-slate-100">
            {items.map((m) => {
              const on = chosen?.id === m.id;
              return (
                <li key={m.id}>
                  <button
                    type="button"
                    aria-current={on ? "true" : undefined}
                    onClick={() => { setPicked(m.id); if (isPhone()) setSheet(true); }}
                    className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-emerald-500 md:px-5 ${on ? "bg-emerald-50/60 lg:shadow-[inset_3px_0_0_#059669]" : "hover:bg-slate-50"}`}
                  >
                    <Tile m={m} />
                    <span className="min-w-0 flex-1">
                      <span className={`line-clamp-2 break-words text-sm font-medium ${m.removedAt ? "text-slate-500 line-through" : "text-slate-900"}`}>{m.title}</span>
                      <span className="block truncate text-xs text-slate-500">{m.removedAt ? `Removed ${m.removedAt}` : metaOf(m)}</span>
                    </span>
                    <ChevronRight className="h-4 w-4 flex-none text-slate-400" aria-hidden="true" />
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
        {chosen ? <aside aria-label={tr("Selected material")} className="hidden p-5 lg:block">{detail(chosen, "h-10")}</aside> : null}
      </div>
      {sheet && chosen ? <Drawer title={tr("Material")} onClose={() => setSheet(false)} onExited={() => setSheet(false)}>{detail(chosen, "h-11")}</Drawer> : null}
    </section>
  );
}
