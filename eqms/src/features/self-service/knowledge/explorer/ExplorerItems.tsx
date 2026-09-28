import React from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Bell, BellOff, FolderSearch, RefreshCw, Star, ThumbsUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SectionLoading } from "@/components/ui/loading";
import { TableEmptyState } from "@/components/ui/table/TableEmptyState";
import { cn } from "@/components/ui/utils";
import type { KnowledgePortalDocument } from "@/services/api/knowledge";
import { FileIcon, FolderIcon } from "./ExplorerIcons";
import { FOCUS_RING, GROUP_LABEL } from "./explorerStyles";
import { folderColor, pluralize, typeBadgeColor, type FolderEntry, type Selection, type ViewMode } from "./explorerModel";

interface ExplorerItemsProps {
  folders: FolderEntry[];
  docs: KnowledgePortalDocument[];
  view: ViewMode;
  selection: Selection;
  highlight?: string;
  /** Touch and narrow screens: a single tap opens a folder because there is no double-click. */
  singleTapOpen: boolean;
  onSelect: (selection: Exclude<Selection, null>) => void;
  onOpen: (selection: Exclude<Selection, null>) => void;
  onContextMenu: (event: React.MouseEvent, selection: Exclude<Selection, null>) => void;
  onToggleSubscribe: (key: string) => void;
}

const GRID = "grid grid-cols-2 gap-1.5 sm:grid-cols-3 md:grid-cols-[repeat(auto-fill,minmax(148px,1fr))]";
const TILE = "group relative flex cursor-default select-none flex-col items-center gap-1.5 rounded-lg border px-2 pb-2.5 pt-3 text-center transition-colors";
// Reserve two title lines in every grid tile so its metadata shares one baseline
// with neighbouring tiles, regardless of whether the title wraps.
const TILE_NAME = "line-clamp-2 min-h-10 w-full break-words text-xs font-medium leading-tight text-slate-900 md:text-sm";
const TILE_META = "max-w-full truncate text-2xs tabular-nums text-slate-500 md:text-xs";

const Highlight: React.FC<{ text: string; term?: string }> = ({ text, term }) => {
  const needle = term?.trim().toLowerCase();
  const at = needle ? text.toLowerCase().indexOf(needle) : -1;
  if (!needle || at < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, at)}
      <mark className="rounded-sm bg-emerald-100 px-0.5 text-emerald-800">{text.slice(at, at + needle.length)}</mark>
      {text.slice(at + needle.length)}
    </>
  );
};

const SectionTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <h2 className={cn(GROUP_LABEL, "mb-2.5 flex items-center gap-2 after:h-px after:flex-1 after:bg-slate-200 after:content-['']")}>{children}</h2>
);

const useStagger = () => {
  const reduceMotion = useReducedMotion();
  return (index: number) => ({
    initial: reduceMotion ? false : ({ opacity: 0, y: 8, scale: 0.97 } as const),
    animate: { opacity: 1, y: 0, scale: 1 },
    transition: { duration: reduceMotion ? 0 : 0.28, delay: reduceMotion ? 0 : Math.min(index, 14) * 0.024, ease: [0.2, 0.8, 0.3, 1] as [number, number, number, number] },
  });
};

const itemKeys = (open: () => void, select: () => void) => (e: React.KeyboardEvent) => {
  if (e.key === "Enter") { e.preventDefault(); open(); }
  if (e.key === " ") { e.preventDefault(); select(); }
};

export const ExplorerItems: React.FC<ExplorerItemsProps> = ({
  folders, docs, view, selection, highlight, singleTapOpen, onSelect, onOpen, onContextMenu, onToggleSubscribe,
}) => {
  const stagger = useStagger();
  const reduceMotion = useReducedMotion();
  const isFolderSelected = (key: string) => selection?.type === "folder" && selection.key === key;
  const isDocSelected = (id: string) => selection?.type === "doc" && selection.id === id;
  const tone = (selected: boolean) => (selected ? "border-emerald-200 bg-emerald-50" : "border-transparent hover:bg-slate-50");
  let order = 0;

  return (
    <AnimatePresence initial={false} mode="wait">
      <motion.div
        key={view}
        initial={reduceMotion ? false : { opacity: 0, y: 8, scale: 0.99 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={reduceMotion ? undefined : { opacity: 0, y: -6, scale: 0.99 }}
        transition={{ duration: reduceMotion ? 0 : 0.2, ease: [0.2, 0.8, 0.3, 1] }}
      >
      {folders.length > 0 && (
        <section aria-label="Folders" className="mb-5">
          <SectionTitle>Folders · {folders.length}</SectionTitle>
          {view === "grid" ? <div role="listbox" aria-label="Folders" className={GRID}>
            {folders.map((folder) => {
              const sel = { type: "folder", key: folder.key } as const;
              return (
                <motion.div
                  key={folder.key}
                  layout={!reduceMotion}
                  {...stagger(order++)}
                  role="option"
                  aria-selected={isFolderSelected(folder.key)}
                  tabIndex={0}
                  data-item={`folder:${folder.key}`}
                  onClick={() => (singleTapOpen ? onOpen(sel) : onSelect(sel))}
                  onDoubleClick={() => onOpen(sel)}
                  onContextMenu={(e) => onContextMenu(e, sel)}
                  onKeyDown={itemKeys(() => onOpen(sel), () => onSelect(sel))}
                  className={cn(TILE, FOCUS_RING, tone(isFolderSelected(folder.key)))}
                >
                  <FolderIcon color={folderColor(folder.label)} className="h-14 w-16 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:scale-105" />
                  <span className={TILE_NAME}><Highlight text={folder.label} term={highlight} /></span>
                  <span className={TILE_META}>{pluralize(folder.documentCount, "document")}</span>
                  {folder.isKnowledgeBase && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); onToggleSubscribe(folder.key); }}
                      onDoubleClick={(e) => e.stopPropagation()}
                      aria-label={folder.subscribed ? `Unsubscribe from ${folder.label}` : `Subscribe to ${folder.label}`}
                      aria-pressed={!!folder.subscribed}
                      title={folder.subscribed ? "Unsubscribe" : "Subscribe to new documents"}
                      className={cn(
                        "absolute right-1.5 top-1.5 grid h-7 w-7 place-items-center rounded-lg transition-all",
                        FOCUS_RING,
                        folder.subscribed ? "bg-emerald-50 text-emerald-700" : "text-slate-400 opacity-100 hover:bg-white hover:text-emerald-700 md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100",
                      )}
                    >
                      {folder.subscribed ? <Bell className="h-3.5 w-3.5" /> : <BellOff className="h-3.5 w-3.5" />}
                    </button>
                  )}
                </motion.div>
              );
            })}
          </div> : (
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full border-collapse">
                <thead><tr className="bg-slate-50 text-left">
                  <th className="border-b border-slate-200 px-2.5 py-2 text-2xs font-semibold text-slate-600 md:text-xs">Name</th>
                  <th className="hidden border-b border-slate-200 px-2.5 py-2 text-2xs font-semibold text-slate-600 sm:table-cell md:text-xs">Type</th>
                  <th className="border-b border-slate-200 px-2.5 py-2 text-right text-2xs font-semibold text-slate-600 md:text-xs">Documents</th>
                </tr></thead>
                <tbody role="listbox" aria-label="Folders" className="divide-y divide-slate-100">
                  {folders.map((folder) => {
                    const sel = { type: "folder", key: folder.key } as const;
                    const selected = isFolderSelected(folder.key);
                    return <motion.tr key={folder.key} layout={!reduceMotion} {...stagger(order++)} role="option" aria-selected={selected} tabIndex={0} data-item={`folder:${folder.key}`}
                      onClick={() => (singleTapOpen ? onOpen(sel) : onSelect(sel))} onDoubleClick={() => onOpen(sel)} onContextMenu={(e) => onContextMenu(e, sel)} onKeyDown={itemKeys(() => onOpen(sel), () => onSelect(sel))}
                      className={cn("cursor-default select-none bg-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-500", selected ? "bg-emerald-50" : "hover:bg-slate-50")}>
                      <td className="px-2.5 py-2"><span className="flex min-w-0 items-center gap-2.5"><FolderIcon color={folderColor(folder.label)} className="h-7 w-8 shrink-0" /><span className="min-w-0"><span className="block truncate text-xs font-medium text-slate-900 md:text-sm"><Highlight text={folder.label} term={highlight} /></span><span className="block text-2xs text-slate-500 sm:hidden">{pluralize(folder.documentCount, "document")}</span></span></span></td>
                      <td className="hidden px-2.5 py-2 text-xs text-slate-600 sm:table-cell md:text-sm">{folder.isKnowledgeBase ? "Knowledge Base" : "Folder"}</td>
                      <td className="px-2.5 py-2 text-right text-xs tabular-nums text-slate-600 md:text-sm">{folder.documentCount}</td>
                    </motion.tr>;
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {docs.length > 0 && (
        <section aria-label="Documents">
          <SectionTitle>Documents · {docs.length}</SectionTitle>
          {view === "grid" ? (
            <div role="listbox" aria-label="Documents" className={GRID}>
              {docs.map((item) => {
                const doc = item.document;
                const sel = { type: "doc", id: doc.id } as const;
                return (
                  <motion.div
                    key={doc.id}
                    layout={!reduceMotion}
                    {...stagger(order++)}
                    role="option"
                    aria-selected={isDocSelected(doc.id)}
                    tabIndex={0}
                    data-item={`doc:${doc.id}`}
                    onClick={() => onSelect(sel)}
                    onDoubleClick={() => onOpen(sel)}
                    onContextMenu={(e) => onContextMenu(e, sel)}
                    onKeyDown={itemKeys(() => onOpen(sel), () => onSelect(sel))}
                    className={cn(TILE, FOCUS_RING, tone(isDocSelected(doc.id)))}
                  >
                    <FileIcon type={doc.documentType} className="h-16 w-14 drop-shadow-sm transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:scale-105" />
                    <span className={TILE_NAME}><Highlight text={doc.documentName} term={highlight} /></span>
                    <span className={TILE_META}><Highlight text={doc.documentNumber} term={highlight} /></span>
                    <span className="absolute left-1.5 top-1.5 flex gap-0.5">
                      {item.featured && <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-500" aria-label="Featured" />}
                      {item.myFeedback && <ThumbsUp className="h-3.5 w-3.5 text-emerald-600" aria-label="You found this helpful" />}
                    </span>
                  </motion.div>
                );
              })}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-left">
                    <th className="border-b border-slate-200 px-2.5 py-2 text-2xs font-semibold text-slate-600 md:text-xs">Name</th>
                    <th className="hidden border-b border-slate-200 px-2.5 py-2 text-2xs font-semibold text-slate-600 sm:table-cell md:text-xs">Number</th>
                    <th className="hidden border-b border-slate-200 px-2.5 py-2 text-2xs font-semibold text-slate-600 lg:table-cell md:text-xs">Department</th>
                    <th className="hidden border-b border-slate-200 px-2.5 py-2 text-2xs font-semibold text-slate-600 sm:table-cell md:text-xs">Type</th>
                    <th className="hidden border-b border-slate-200 px-2.5 py-2 text-right text-2xs font-semibold text-slate-600 md:table-cell md:text-xs">Views</th>
                    <th className="hidden border-b border-slate-200 px-2.5 py-2 text-right text-2xs font-semibold text-slate-600 md:table-cell md:text-xs">Helpful</th>
                  </tr>
                </thead>
                <tbody role="listbox" aria-label="Documents" className="divide-y divide-slate-100">
                  {docs.map((item) => {
                    const doc = item.document;
                    const sel = { type: "doc", id: doc.id } as const;
                    const selected = isDocSelected(doc.id);
                    return (
                      <motion.tr
                        key={doc.id}
                        layout={!reduceMotion}
                        {...stagger(order++)}
                        role="option"
                        aria-selected={selected}
                        tabIndex={0}
                        data-item={`doc:${doc.id}`}
                        onClick={() => onSelect(sel)}
                        onDoubleClick={() => onOpen(sel)}
                        onContextMenu={(e) => onContextMenu(e, sel)}
                        onKeyDown={itemKeys(() => onOpen(sel), () => onSelect(sel))}
                        className={cn("cursor-default select-none bg-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-500", selected ? "bg-emerald-50" : "hover:bg-slate-50")}
                      >
                        <td className="px-2.5 py-2">
                          <span className="flex min-w-0 items-center gap-2.5">
                            <FileIcon type={doc.documentType} className="h-6 w-5 shrink-0" />
                            <span className="min-w-0">
                              <span className="block truncate text-xs font-medium text-slate-900 md:text-sm"><Highlight text={doc.documentName} term={highlight} /></span>
                              <span className="block truncate text-2xs text-slate-500 sm:hidden">{doc.documentNumber}{doc.documentType ? ` · ${doc.documentType}` : ""}</span>
                            </span>
                            {item.featured && <Star className="h-3.5 w-3.5 shrink-0 fill-amber-400 text-amber-500" aria-label="Featured" />}
                          </span>
                        </td>
                        <td className="hidden whitespace-nowrap px-2.5 py-2 text-xs tabular-nums text-slate-600 sm:table-cell md:text-sm"><Highlight text={doc.documentNumber} term={highlight} /></td>
                        <td className="hidden whitespace-nowrap px-2.5 py-2 text-xs text-slate-600 lg:table-cell md:text-sm">{doc.department || "-"}</td>
                        <td className="hidden px-2.5 py-2 sm:table-cell">
                          <Badge color={typeBadgeColor(doc.documentType)} size="sm">{doc.documentType || "Document"}</Badge>
                        </td>
                        <td className="hidden px-2.5 py-2 text-right text-xs tabular-nums text-slate-600 md:table-cell md:text-sm">{item.views}</td>
                        <td className="hidden px-2.5 py-2 text-right text-xs tabular-nums text-slate-600 md:table-cell md:text-sm">{item.helpfulVotes}</td>
                      </motion.tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
      </motion.div>
    </AnimatePresence>
  );
};

export const ExplorerLoading: React.FC = () => <SectionLoading text="Loading..." minHeight="240px" />;

export const ExplorerEmpty: React.FC<{ title: string; description: string; onRetry?: () => void }> = ({ title, description, onRetry }) => (
  <div className="flex flex-col items-center">
    <TableEmptyState icon={<FolderSearch className="text-slate-300" />} title={title} description={description} />
    {onRetry && (
      <Button variant="outline" size="sm" onClick={onRetry} className="gap-1.5">
        <RefreshCw className="h-3.5 w-3.5" /> Try again
      </Button>
    )}
  </div>
);
