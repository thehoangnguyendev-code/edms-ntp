import React from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Bell, BellOff, ChevronDown, ChevronUp, FolderSearch, RefreshCw, Star, ThumbsUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SectionLoading } from "@/components/ui/loading";
import { TableEmptyState } from "@/components/ui/table/TableEmptyState";
import { cn } from "@/components/ui/utils";
import type { KnowledgePortalDocument } from "@/services/api/knowledge";
import { FileIcon, FolderIcon } from "./ExplorerIcons";
import { Card, CardHeader } from "@/features/self-service/dashboard/shared/dashboardUi";
import { FOCUS_RING } from "./explorerStyles";
import { folderColor, formatFileSize, pluralize, typeBadgeColor, type FolderEntry, type Selection, type SortDir, type SortKey, type ViewMode } from "./explorerModel";
import { formatDateTime } from "@/utils/format";
import { TableMarkup, TABLE_STYLES } from "@/components/ui/table/TablePrimitives";

interface ExplorerItemsProps {
  folders: FolderEntry[];
  /** The documents on the current page. */
  docs: KnowledgePortalDocument[];
  /** All documents in this location, across pages. */
  totalDocs: number;
  sort: SortKey;
  sortDir: SortDir;
  onSortColumn: (key: SortKey) => void;
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
const TILE = "group relative flex cursor-default select-none flex-col items-center gap-1.5 rounded-lg border px-2 pb-2.5 pt-3 text-center transition-[background-color,border-color,box-shadow] duration-200";
// Reserve two title lines in every grid tile so its metadata shares one baseline
// with neighbouring tiles, regardless of whether the title wraps.
const TILE_NAME = "line-clamp-2 min-h-10 w-full break-words text-xs font-medium leading-tight text-slate-900 md:text-sm";
/** Header of the shared tables: uppercase, small, bold. */
const TH = TABLE_STYLES.headerCell9.replace("py-1.5 px-2 sm:py-2.5 sm:px-4", "px-2.5 py-2.5");
const TH_RIGHT = cn(TH, "text-right");

/** A column header that sorts when pressed; the arrow of the active column shows its direction, as in the shared tables. */
const SortHeader: React.FC<{ id: SortKey; label: string; sort: SortKey; dir: SortDir; onSort: (key: SortKey) => void; className?: string; align?: "right"; title?: string }> = ({
  id, label, sort, dir, onSort, className, align, title,
}) => (
  <TableMarkup.HeaderCell
    aria-sort={sort === id ? (dir === "asc" ? "ascending" : "descending") : "none"}
    className={cn(align === "right" ? TH_RIGHT : TH, "bg-slate-50 text-slate-500", className)}
  >
    <button
      type="button"
      onClick={() => onSort(id)}
      title={title ?? `Sort by ${label}`}
      className={cn("group inline-flex w-full items-center gap-1.5 uppercase tracking-wider transition-colors hover:text-slate-700", FOCUS_RING, align === "right" && "justify-end")}
    >
      <span className="truncate">{label}</span>
      <span className="flex shrink-0 flex-col text-slate-400 group-hover:text-slate-600" aria-hidden="true">
        <ChevronUp className={cn("-mb-1 h-3 w-3", sort === id && dir === "asc" && "text-emerald-600")} />
        <ChevronDown className={cn("h-3 w-3", sort === id && dir === "desc" && "text-emerald-600")} />
      </span>
    </button>
  </TableMarkup.HeaderCell>
);

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

/** A group of items as a dashboard card: the title with its real count as a badge, the items beneath. */
const Group: React.FC<{ title: string; count: number; className?: string; children: React.ReactNode }> = ({ title, count, className, children }) => (
  <Card aria-label={title} className={className}>
    <CardHeader title={title} badge={<Badge variant="soft">{count}</Badge>} className="pb-2.5" />
    <div className="border-t border-slate-100 p-2">{children}</div>
  </Card>
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
  folders, docs, totalDocs, sort, sortDir, onSortColumn, view, selection, highlight, singleTapOpen, onSelect, onOpen, onContextMenu, onToggleSubscribe,
}) => {
  const stagger = useStagger();
  const reduceMotion = useReducedMotion();
  const isFolderSelected = (key: string) => selection?.type === "folder" && selection.key === key;
  const isDocSelected = (id: string) => selection?.type === "doc" && selection.id === id;
  const tone = (selected: boolean) => (selected ? "border-emerald-200 bg-emerald-50" : "border-transparent hover:border-emerald-100 hover:bg-white hover:shadow-md");
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
        <Group title="Folders" count={folders.length} className="mb-3">
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
            <div className="overflow-x-auto">
              <TableMarkup.Root className="w-full border-collapse">
                <TableMarkup.Head><TableMarkup.Row className="bg-slate-50 text-left">
                  <TableMarkup.HeaderCell className={cn(TH, "bg-slate-50")}>Name</TableMarkup.HeaderCell>
                  <TableMarkup.HeaderCell className={cn(TH, "hidden bg-slate-50 sm:table-cell")}>Type</TableMarkup.HeaderCell>
                  <TableMarkup.HeaderCell className={cn(TH_RIGHT, "bg-slate-50")}>Documents</TableMarkup.HeaderCell>
                </TableMarkup.Row></TableMarkup.Head>
                <TableMarkup.Body role="listbox" aria-label="Folders" className="divide-y divide-slate-100">
                  {folders.map((folder) => {
                    const sel = { type: "folder", key: folder.key } as const;
                    const selected = isFolderSelected(folder.key);
                    return <motion.tr key={folder.key} layout={!reduceMotion} {...stagger(order++)} role="option" aria-selected={selected} tabIndex={0} data-item={`folder:${folder.key}`}
                      onClick={() => (singleTapOpen ? onOpen(sel) : onSelect(sel))} onDoubleClick={() => onOpen(sel)} onContextMenu={(e) => onContextMenu(e, sel)} onKeyDown={itemKeys(() => onOpen(sel), () => onSelect(sel))}
                      className={cn("cursor-default select-none bg-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-500", selected ? "bg-emerald-50" : "hover:bg-slate-50")}>
                      <TableMarkup.Cell className="px-2.5 py-2"><span className="flex min-w-0 items-center gap-2.5"><FolderIcon color={folderColor(folder.label)} className="h-7 w-8 shrink-0" /><span className="min-w-0"><span className="block truncate text-xs font-medium text-slate-900 md:text-sm"><Highlight text={folder.label} term={highlight} /></span><span className="block text-2xs text-slate-500 sm:hidden">{pluralize(folder.documentCount, "document")}</span></span></span></TableMarkup.Cell>
                      <TableMarkup.Cell className="hidden px-2.5 py-2 text-xs text-slate-600 sm:table-cell md:text-sm">{folder.isKnowledgeBase ? "Knowledge Base" : "Folder"}</TableMarkup.Cell>
                      <TableMarkup.Cell className="px-2.5 py-2 text-right text-xs tabular-nums text-slate-600 md:text-sm">{folder.documentCount}</TableMarkup.Cell>
                    </motion.tr>;
                  })}
                </TableMarkup.Body>
              </TableMarkup.Root>
            </div>
          )}
        </Group>
      )}

      {docs.length > 0 && (
        <Group title="Documents" count={totalDocs}>
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
            <div className="overflow-x-auto">
              <TableMarkup.Root className="w-full border-collapse">
                <TableMarkup.Head>
                  <TableMarkup.Row className="bg-slate-50 text-left">
                    <SortHeader id="name" label="Name" sort={sort} dir={sortDir} onSort={onSortColumn} />
                    <SortHeader id="number" label="Number" sort={sort} dir={sortDir} onSort={onSortColumn} className="hidden sm:table-cell" />
                    <SortHeader id="department" label="Department" sort={sort} dir={sortDir} onSort={onSortColumn} className="hidden lg:table-cell" />
                    <SortHeader id="type" label="Type" sort={sort} dir={sortDir} onSort={onSortColumn} className="hidden sm:table-cell" />
                    <SortHeader id="size" label="Size" sort={sort} dir={sortDir} onSort={onSortColumn} align="right" className="hidden md:table-cell" />
                    <SortHeader id="lastOpened" label="Last update" sort={sort} dir={sortDir} onSort={onSortColumn} className="hidden md:table-cell" title="Sort by when you last opened the document" />
                    <SortHeader id="views" label="Views" sort={sort} dir={sortDir} onSort={onSortColumn} align="right" className="hidden md:table-cell" />
                    <SortHeader id="helpful" label="Helpful" sort={sort} dir={sortDir} onSort={onSortColumn} align="right" className="hidden md:table-cell" />
                  </TableMarkup.Row>
                </TableMarkup.Head>
                <TableMarkup.Body role="listbox" aria-label="Documents" className="divide-y divide-slate-100">
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
                        <TableMarkup.Cell className="px-2.5 py-2">
                          <span className="flex min-w-0 items-center gap-2.5">
                            <FileIcon type={doc.documentType} className="h-6 w-5 shrink-0" />
                            <span className="min-w-0">
                              <span className="block truncate text-xs font-medium text-slate-900 md:text-sm"><Highlight text={doc.documentName} term={highlight} /></span>
                              <span className="block truncate text-2xs text-slate-500 sm:hidden">{doc.documentNumber}{doc.documentType ? ` · ${doc.documentType}` : ""}</span>
                            </span>
                            {item.featured && <Star className="h-3.5 w-3.5 shrink-0 fill-amber-400 text-amber-500" aria-label="Featured" />}
                          </span>
                        </TableMarkup.Cell>
                        <TableMarkup.Cell className="hidden whitespace-nowrap px-2.5 py-2 text-xs tabular-nums text-slate-600 sm:table-cell md:text-sm"><Highlight text={doc.documentNumber} term={highlight} /></TableMarkup.Cell>
                        <TableMarkup.Cell className="hidden whitespace-nowrap px-2.5 py-2 text-xs text-slate-600 lg:table-cell md:text-sm">{doc.department || "-"}</TableMarkup.Cell>
                        <TableMarkup.Cell className="hidden px-2.5 py-2 sm:table-cell">
                          <Badge color={typeBadgeColor(doc.documentType)} size="sm">{doc.documentType || "Document"}</Badge>
                        </TableMarkup.Cell>
                        <TableMarkup.Cell className={TABLE_STYLES.table4}>{formatFileSize(item.sizeBytes)}</TableMarkup.Cell>
                        <TableMarkup.Cell className="hidden whitespace-nowrap px-2.5 py-2 text-xs text-slate-600 md:table-cell md:text-sm" title="When you last opened this document">
                          {item.myLastOpenedAt ? formatDateTime(item.myLastOpenedAt) : <span className="text-slate-400">Never opened</span>}
                        </TableMarkup.Cell>
                        <TableMarkup.Cell className={TABLE_STYLES.table4}>{item.views}</TableMarkup.Cell>
                        <TableMarkup.Cell className={TABLE_STYLES.table4}>{item.helpfulVotes}</TableMarkup.Cell>
                      </motion.tr>
                    );
                  })}
                </TableMarkup.Body>
              </TableMarkup.Root>
            </div>
          )}
        </Group>
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
