import React from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Bell, BellOff, ChevronDown, ChevronUp, FolderSearch, MoreHorizontal, RefreshCw, Star, ThumbsUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SectionLoading } from "@/components/ui/loading";
import { TableEmptyState } from "@/components/ui/table/TableEmptyState";
import { cn } from "@/components/ui/utils";
import type { KnowledgePortalDocument } from "@/services/api/knowledge";
import { FileIcon, FolderIcon, useFolderColor, useFolderLabel } from "./ExplorerIcons";
import { Folder } from "@/components/ui/folder-component";
import { Card, CardHeader } from "@/features/self-service/dashboard/shared/dashboardUi";
import { FOCUS_RING } from "./explorerStyles";
import { formatFileSize, pluralize, typeBadgeColor, type FolderEntry, type Selection, type SortDir, type SortKey, type ViewMode } from "./explorerModel";
import { formatDateTime } from "@/utils/format";
import { TableMarkup, TABLE_STYLES } from "@/components/ui/table/TablePrimitives";
import { useMediaQuery } from "./useMediaQuery";
import { useLanguage, tr } from "@/i18n";

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
  /** False while the page around the items is changing width (the sidebar opening): the items just follow, they do not each animate to their new place. */
  layoutAnimations?: boolean;
  onSelect: (selection: Exclude<Selection, null>) => void;
  onOpen: (selection: Exclude<Selection, null>) => void;
  onContextMenu: (event: React.MouseEvent, selection: Exclude<Selection, null>) => void;
  /** The visible actions button (touch, and a discoverable control on a mouse): opens the menu or the bottom sheet. */
  onActions: (event: React.MouseEvent, selection: Exclude<Selection, null>) => void;
  onToggleSubscribe: (key: string) => void;
}

const GRID = "grid grid-cols-2 gap-1.5 min-[400px]:grid-cols-3 md:grid-cols-[repeat(auto-fill,minmax(148px,1fr))]";
const TILE = "group relative flex cursor-default select-none flex-col items-center gap-1.5 rounded-lg border px-2 pb-2.5 pt-3 text-center transition-[background-color,border-color,box-shadow] duration-200";
// Reserve two title lines in every grid tile so its metadata shares one baseline
// with neighbouring tiles, regardless of whether the title wraps.
const TILE_NAME = "line-clamp-2 min-h-10 w-full break-words text-[13px] font-medium leading-tight text-slate-900 md:text-sm";
/** Header of the shared tables: uppercase, small, bold. */
// the header stays at the top of the table frame while its rows scroll
const TH = cn(TABLE_STYLES.headerCell9.replace("py-1.5 px-2 sm:py-2.5 sm:px-4", "px-2.5 py-2.5"), "sticky top-0 z-20");
const TH_RIGHT = cn(TH, "text-right");

/** A column header that sorts when pressed; the arrow of the active column shows its direction, as in the shared tables. */
const SortHeader: React.FC<{ id: SortKey; label: string; sort: SortKey; dir: SortDir; onSort: (key: SortKey) => void; className?: string; align?: "right"; title?: string }> = ({
  id, label, sort, dir, onSort, className, align, title,
}) => {
  const { t } = useLanguage();
  return (
  <TableMarkup.HeaderCell
    aria-sort={sort === id ? (dir === "asc" ? "ascending" : "descending") : "none"}
    className={cn(align === "right" ? TH_RIGHT : TH, "bg-slate-50 text-slate-500", className)}
  >
    <button
      type="button"
      onClick={() => onSort(id)}
      title={title ?? `${t("knowledge.sortBy", "Sort by")} ${label}`}
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
};

const TILE_META = "max-w-full truncate text-xs tabular-nums text-slate-600";
// The numeric columns appear with their (same-step) headers, so a narrow table never shifts a value under the wrong heading.
const NUM_CELL_LG = "hidden whitespace-nowrap px-2.5 py-2 text-right text-xs tabular-nums text-slate-600 lg:table-cell md:text-sm";
const NUM_CELL_XL = "hidden whitespace-nowrap px-2.5 py-2 text-right text-xs tabular-nums text-slate-600 xl:table-cell md:text-sm";

/** The visible "actions" control. On a mouse it appears on hover/focus; on touch it is always there. */
const OverflowButton: React.FC<{ label: string; onClick: (event: React.MouseEvent) => void; className?: string }> = ({ label, onClick, className }) => {
  const { t } = useLanguage();
  const titleText = t("knowledge.actions", "Actions");
  return (
  <button
    type="button"
    onClick={onClick}
    onDoubleClick={(event) => event.stopPropagation()}
    aria-label={label}
    aria-haspopup="menu"
    title={titleText}
    className={cn(
      "grid h-9 w-9 shrink-0 place-items-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900",
      FOCUS_RING,
      className,
    )}
  >
    <MoreHorizontal className="h-4 w-4" />
  </button>
  );
};

const MOBILE_ROW = "group relative flex min-h-12 w-full cursor-default select-none items-center gap-2.5 rounded-lg border border-transparent bg-white px-2.5 py-2 text-left transition-colors hover:border-slate-200 hover:bg-slate-50";

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

/** A list-view table is not a card: it carries its own header row, and nothing sits between that row and the toolbar. */
const Section: React.FC<{ title: string; count: number; className?: string; bare: boolean; children: React.ReactNode }> = ({ title, count, className, bare, children }) =>
  bare ? <div className={className}>{children}</div> : <Group title={title} count={count} className={className}>{children}</Group>;

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
  folders, docs, totalDocs, sort, sortDir, onSortColumn, view, selection, highlight, singleTapOpen, layoutAnimations = true,
  onSelect, onOpen, onContextMenu, onActions, onToggleSubscribe,
}) => {
  const stagger = useStagger();
  const colorOf = useFolderColor();
  const labelOf = useFolderLabel();
  const reduceMotion = useReducedMotion();
  const { t, tLabel, language } = useLanguage();
  const documentCountLabel = (count: number) => language === "vi" ? `${count} tài liệu` : pluralize(count, "document");
  // A phone stacks the same rows as cards: a table with most of its columns hidden is a table that cannot be read.
  const compact = useMediaQuery("(max-width: 767px)");
  // The desktop list view is a plain table, not a card with a header above it.
  const tableMode = !compact && view === "list";
  // The Type column says Folder on every row unless Knowledge Bases and folders are listed together.
  const mixedFolderKinds = new Set(folders.map((folder) => !!folder.isKnowledgeBase)).size > 1;
  const isFolderSelected = (key: string) => selection?.type === "folder" && selection.key === key;
  const isDocSelected = (id: string) => selection?.type === "doc" && selection.id === id;
  const tone = (selected: boolean) => (selected ? "border-emerald-200 bg-emerald-50" : "border-transparent hover:border-emerald-100 hover:bg-white hover:shadow-md");
  // Only one item is in the tab order at a time; the arrow keys move the selection (and the focus) from there.
  const tabIndexFor = (selected: boolean, index: number) => (selected || (!selection && index === 0) ? 0 : -1);
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
        <Section title={t("knowledge.folders", "Folders")} count={folders.length} className="mb-3" bare={tableMode}>
          {compact && view === "list" ? (
            <div role="listbox" aria-label={tr("Folders")} className="space-y-1">
              {folders.map((folder) => {
                const sel = { type: "folder", key: folder.key } as const;
                const selected = isFolderSelected(folder.key);
                const index = order++;
                return (
                  <motion.div
                    key={folder.key}
                    layout={!reduceMotion && layoutAnimations}
                    {...stagger(index)}
                    role="option"
                    aria-selected={selected}
                    tabIndex={tabIndexFor(selected, index)}
                    data-item={`folder:${folder.key}`}
                    onClick={() => (singleTapOpen ? onOpen(sel) : onSelect(sel))}
                    onDoubleClick={() => onOpen(sel)}
                    onContextMenu={(e) => onContextMenu(e, sel)}
                    onKeyDown={itemKeys(() => onOpen(sel), () => onSelect(sel))}
                    className={cn(MOBILE_ROW, FOCUS_RING, selected && "border-emerald-200 bg-emerald-50")}
                  >
                    <FolderIcon color={colorOf(folder.key, folder.label)} className="h-9 w-10 shrink-0" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium text-slate-900" title={folder.label}>
                        <Highlight text={labelOf(folder.key, folder.label)} term={highlight} />
                      </span>
                      <span className="block text-xs text-slate-600">{documentCountLabel(folder.documentCount)}</span>
                    </span>
                    {folder.isKnowledgeBase && folder.subscribed && (
                      <Bell className="h-4 w-4 shrink-0 text-emerald-600" aria-label={t("knowledge.subscribed", "Subscribed")} />
                    )}
                    <OverflowButton label={`${t("knowledge.actionsFor", "Actions for")} ${folder.label}`} onClick={(e) => { e.stopPropagation(); onActions(e, sel); }} />
                  </motion.div>
                );
              })}
            </div>
          ) : view === "grid" ? <div role="listbox" aria-label={tr("Folders")} className={GRID}>
            {folders.map((folder) => {
              const sel = { type: "folder", key: folder.key } as const;
              const selected = isFolderSelected(folder.key);
              const index = order++;
              return (
                <motion.div
                  key={folder.key}
                  layout={!reduceMotion && layoutAnimations}
                  {...stagger(index)}
                  role="option"
                  aria-selected={selected}
                  tabIndex={tabIndexFor(selected, index)}
                  data-item={`folder:${folder.key}`}
                  onClick={() => (singleTapOpen ? onOpen(sel) : onSelect(sel))}
                  onDoubleClick={() => onOpen(sel)}
                  onContextMenu={(e) => onContextMenu(e, sel)}
                  onKeyDown={itemKeys(() => onOpen(sel), () => onSelect(sel))}
                  className={cn(TILE, FOCUS_RING, tone(selected))}
                >
                  <Folder color={colorOf(folder.key, folder.label) as `#${string}`} scale={0.2} open={selected || undefined} className="h-12 w-14 sm:h-14 sm:w-16" />
                  <span className={TILE_NAME} title={folder.label}><Highlight text={labelOf(folder.key, folder.label)} term={highlight} /></span>
                  <span className={TILE_META}>{documentCountLabel(folder.documentCount)}</span>
                  <OverflowButton
                    label={`${t("knowledge.actionsFor", "Actions for")} ${folder.label}`}
                    onClick={(e) => { e.stopPropagation(); onActions(e, sel); }}
                    className="absolute left-1 top-1 z-10 bg-white/80 shadow-sm ring-1 ring-slate-200/60 backdrop-blur md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100"
                  />
                  {folder.isKnowledgeBase && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); onToggleSubscribe(folder.key); }}
                      onDoubleClick={(e) => e.stopPropagation()}
                      aria-label={folder.subscribed ? `${t("knowledge.unsubscribeFrom", "Unsubscribe from")} ${folder.label}` : `${t("knowledge.subscribeTo", "Subscribe to")} ${folder.label}`}
                      aria-pressed={!!folder.subscribed}
                      title={folder.subscribed ? t("knowledge.unsubscribe", "Unsubscribe") : t("knowledge.subscribe", "Subscribe to new documents")}
                      className={cn(
                        "absolute right-1 top-1 z-10 grid h-9 w-9 place-items-center rounded-lg transition-all",
                        FOCUS_RING,
                        folder.subscribed ? "bg-emerald-50 text-emerald-700" : "text-slate-500 opacity-100 hover:bg-white hover:text-emerald-700 md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100",
                      )}
                    >
                      {folder.subscribed ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
                    </button>
                  )}
                </motion.div>
              );
            })}
          </div> : (
            <div>
              <TableMarkup.Root className="w-full border-collapse">
                <TableMarkup.Head><TableMarkup.Row className="bg-slate-50 text-left">
                  <TableMarkup.HeaderCell className={cn(TH, "bg-slate-50")}>{t("knowledge.name", "Name")}</TableMarkup.HeaderCell>
                  {mixedFolderKinds && <TableMarkup.HeaderCell className={cn(TH, "hidden bg-slate-50 sm:table-cell")}>{t("knowledge.type", "Type")}</TableMarkup.HeaderCell>}
                  <TableMarkup.HeaderCell className={cn(TH_RIGHT, "bg-slate-50")}>{t("knowledge.documents", "Documents")}</TableMarkup.HeaderCell>
                </TableMarkup.Row></TableMarkup.Head>
                <TableMarkup.Body className="divide-y divide-slate-100">
                  {folders.map((folder) => {
                    const sel = { type: "folder", key: folder.key } as const;
                    const selected = isFolderSelected(folder.key);
                    const index = order++;
                    return <motion.tr key={folder.key} layout={!reduceMotion && layoutAnimations} {...stagger(index)} tabIndex={tabIndexFor(selected, index)} data-item={`folder:${folder.key}`}
                      onClick={() => (singleTapOpen ? onOpen(sel) : onSelect(sel))} onDoubleClick={() => onOpen(sel)} onContextMenu={(e) => onContextMenu(e, sel)} onKeyDown={itemKeys(() => onOpen(sel), () => onSelect(sel))}
                      className={cn("group cursor-default select-none bg-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-500", selected ? "bg-emerald-50" : "hover:bg-slate-50")}>
                      <TableMarkup.Cell className="px-2.5 py-2"><span className="flex min-w-0 items-center gap-2.5"><FolderIcon color={colorOf(folder.key, folder.label)} className="h-7 w-8 shrink-0" /><span className="min-w-0 flex-1"><span className="block truncate text-[13px] font-medium text-slate-900 md:text-sm" title={folder.label}><Highlight text={labelOf(folder.key, folder.label)} term={highlight} /></span><span className="block text-xs text-slate-600 sm:hidden">{documentCountLabel(folder.documentCount)}</span></span><OverflowButton label={`${t("knowledge.actionsFor", "Actions for")} ${folder.label}`} onClick={(e) => { e.stopPropagation(); onActions(e, sel); }} className="ml-auto" /></span></TableMarkup.Cell>
                      {mixedFolderKinds && <TableMarkup.Cell className="hidden px-2.5 py-2 text-xs text-slate-600 sm:table-cell md:text-sm">{folder.isKnowledgeBase ? t("knowledge.knowledgeBase", "Knowledge Base") : t("knowledge.folder", "Folder")}</TableMarkup.Cell>}
                      <TableMarkup.Cell className="px-2.5 py-2 text-right text-xs tabular-nums text-slate-600 md:text-sm">{folder.documentCount}</TableMarkup.Cell>
                    </motion.tr>;
                  })}
                </TableMarkup.Body>
              </TableMarkup.Root>
            </div>
          )}
        </Section>
      )}

      {docs.length > 0 && (
        <Section title={t("knowledge.documents", "Documents")} count={totalDocs} bare={tableMode}>
          {compact && view === "list" ? (
            <div role="listbox" aria-label={tr("Documents")} className="space-y-1">
              {docs.map((item) => {
                const doc = item.document;
                const sel = { type: "doc", id: doc.id } as const;
                const selected = isDocSelected(doc.id);
                const index = order++;
                return (
                  <motion.div
                    key={doc.id}
                    layout={!reduceMotion && layoutAnimations}
                    {...stagger(index)}
                    role="option"
                    aria-selected={selected}
                    tabIndex={tabIndexFor(selected, index)}
                    data-item={`doc:${doc.id}`}
                    onClick={() => (singleTapOpen ? onOpen(sel) : onSelect(sel))}
                    onDoubleClick={() => onOpen(sel)}
                    onContextMenu={(e) => onContextMenu(e, sel)}
                    onKeyDown={itemKeys(() => onOpen(sel), () => onSelect(sel))}
                    className={cn(MOBILE_ROW, FOCUS_RING, selected && "border-emerald-200 bg-emerald-50")}
                  >
                    <FileIcon type={doc.documentType} className="h-8 w-9 shrink-0" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium text-slate-900"><Highlight text={doc.documentName} term={highlight} /></span>
                      <span className="block truncate text-xs text-slate-600"><Highlight text={doc.documentNumber} term={highlight} />{doc.documentType ? ` · ${doc.documentType}` : ""}</span>
                    </span>
                    {item.featured && <Star className="h-4 w-4 shrink-0 fill-amber-400 text-amber-500" aria-label={t("knowledge.featured", "Featured")} />}
                    {item.myFeedback && <ThumbsUp className="h-4 w-4 shrink-0 text-emerald-600" aria-label={t("knowledge.youFoundHelpful", "You found this helpful")} />}
                    <OverflowButton label={`${t("knowledge.actionsFor", "Actions for")} ${doc.documentName}`} onClick={(e) => { e.stopPropagation(); onActions(e, sel); }} />
                  </motion.div>
                );
              })}
            </div>
          ) : view === "grid" ? (
            <div role="listbox" aria-label={tr("Documents")} className={GRID}>
              {docs.map((item) => {
                const doc = item.document;
                const sel = { type: "doc", id: doc.id } as const;
                const selected = isDocSelected(doc.id);
                const index = order++;
                return (
                  <motion.div
                    key={doc.id}
                    layout={!reduceMotion && layoutAnimations}
                    {...stagger(index)}
                    role="option"
                    aria-selected={selected}
                    tabIndex={tabIndexFor(selected, index)}
                    data-item={`doc:${doc.id}`}
                    onClick={() => (singleTapOpen ? onOpen(sel) : onSelect(sel))}
                    onDoubleClick={() => onOpen(sel)}
                    onContextMenu={(e) => onContextMenu(e, sel)}
                    onKeyDown={itemKeys(() => onOpen(sel), () => onSelect(sel))}
                    className={cn(TILE, FOCUS_RING, tone(selected))}
                  >
                    <FileIcon type={doc.documentType} className="h-11 w-12 drop-shadow-sm transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:scale-105 sm:h-12 sm:w-14" />
                    <span className={TILE_NAME}><Highlight text={doc.documentName} term={highlight} /></span>
                    <span className={TILE_META}><Highlight text={doc.documentNumber} term={highlight} /></span>
                    <span className="absolute left-1 top-1 z-10 flex gap-0.5">
                      {item.featured && <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-500" aria-label={t("knowledge.featured", "Featured")} />}
                      {item.myFeedback && <ThumbsUp className="h-3.5 w-3.5 text-emerald-600" aria-label={t("knowledge.youFoundHelpful", "You found this helpful")} />}
                    </span>
                    <OverflowButton
                      label={`${t("knowledge.actionsFor", "Actions for")} ${doc.documentName}`}
                      onClick={(e) => { e.stopPropagation(); onActions(e, sel); }}
                      className="absolute right-1 top-1 z-10 bg-white/80 shadow-sm ring-1 ring-slate-200/60 backdrop-blur md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100"
                    />
                  </motion.div>
                );
              })}
            </div>
          ) : (
            <div>
              <TableMarkup.Root className="w-full border-collapse">
                <TableMarkup.Head>
                  <TableMarkup.Row className="bg-slate-50 text-left">
                    <SortHeader id="name" label={t("knowledge.name", "Name")} sort={sort} dir={sortDir} onSort={onSortColumn} />
                    <SortHeader id="number" label={t("knowledge.number", "Number")} sort={sort} dir={sortDir} onSort={onSortColumn} className="hidden sm:table-cell" />
                    <SortHeader id="department" label={t("knowledge.department", "Department")} sort={sort} dir={sortDir} onSort={onSortColumn} className="hidden xl:table-cell" />
                    <SortHeader id="type" label={t("knowledge.type", "Type")} sort={sort} dir={sortDir} onSort={onSortColumn} className="hidden sm:table-cell" />
                    <SortHeader id="size" label={t("knowledge.size", "Size")} sort={sort} dir={sortDir} onSort={onSortColumn} align="right" className="hidden lg:table-cell" />
                    <SortHeader id="lastOpened" label={t("knowledge.lastUpdate", "Last update")} sort={sort} dir={sortDir} onSort={onSortColumn} className="hidden xl:table-cell" title={t("knowledge.lastOpenedTitle", "Sort by when you last opened the document")} />
                    <SortHeader id="views" label={t("knowledge.views", "Views")} sort={sort} dir={sortDir} onSort={onSortColumn} align="right" className="hidden lg:table-cell" />
                    <SortHeader id="helpful" label={t("knowledge.helpfulColumn", "Helpful")} sort={sort} dir={sortDir} onSort={onSortColumn} align="right" className="hidden xl:table-cell" />
                  </TableMarkup.Row>
                </TableMarkup.Head>
                <TableMarkup.Body className="divide-y divide-slate-100">
                  {docs.map((item) => {
                    const doc = item.document;
                    const sel = { type: "doc", id: doc.id } as const;
                    const selected = isDocSelected(doc.id);
                    const index = order++;
                    return (
                      <motion.tr
                        key={doc.id}
                        layout={!reduceMotion && layoutAnimations}
                        {...stagger(index)}
                        tabIndex={tabIndexFor(selected, index)}
                        data-item={`doc:${doc.id}`}
                        onClick={() => (singleTapOpen ? onOpen(sel) : onSelect(sel))}
                        onDoubleClick={() => onOpen(sel)}
                        onContextMenu={(e) => onContextMenu(e, sel)}
                        onKeyDown={itemKeys(() => onOpen(sel), () => onSelect(sel))}
                        className={cn("group cursor-default select-none bg-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-500", selected ? "bg-emerald-50" : "hover:bg-slate-50")}
                      >
                        <TableMarkup.Cell className="px-2.5 py-2">
                          <span className="flex min-w-0 items-center gap-2.5">
                            <FileIcon type={doc.documentType} className="h-5 w-5 shrink-0" />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[13px] font-medium text-slate-900 md:text-sm"><Highlight text={doc.documentName} term={highlight} /></span>
                              <span className="block truncate text-xs text-slate-600 sm:hidden">{doc.documentNumber}{doc.documentType ? ` · ${doc.documentType}` : ""}</span>
                            </span>
                            {item.featured && <Star className="h-3.5 w-3.5 shrink-0 fill-amber-400 text-amber-500" aria-label={t("knowledge.featured", "Featured")} />}
                            <OverflowButton label={`${t("knowledge.actionsFor", "Actions for")} ${doc.documentName}`} onClick={(e) => { e.stopPropagation(); onActions(e, sel); }} className="ml-auto" />
                          </span>
                        </TableMarkup.Cell>
                        <TableMarkup.Cell className="hidden whitespace-nowrap px-2.5 py-2 text-xs tabular-nums text-slate-600 sm:table-cell md:text-sm"><Highlight text={doc.documentNumber} term={highlight} /></TableMarkup.Cell>
                        <TableMarkup.Cell className="hidden max-w-[11rem] truncate whitespace-nowrap px-2.5 py-2 text-xs text-slate-600 xl:table-cell md:text-sm">{doc.department || "-"}</TableMarkup.Cell>
                        <TableMarkup.Cell className="hidden px-2.5 py-2 sm:table-cell">
                          <Badge color={typeBadgeColor(doc.documentType)} size="sm" className="max-w-[10rem] truncate">{doc.documentType || "Document"}</Badge>
                        </TableMarkup.Cell>
                        <TableMarkup.Cell className={NUM_CELL_LG}>{formatFileSize(item.sizeBytes)}</TableMarkup.Cell>
                        <TableMarkup.Cell className="hidden whitespace-nowrap px-2.5 py-2 text-xs text-slate-600 xl:table-cell md:text-sm" title={t("knowledge.lastOpenedTitle", "When you last opened this document")}>
                          {item.myLastOpenedAt ? formatDateTime(item.myLastOpenedAt) : <span className="text-slate-500">{t("knowledge.neverOpened", "Never opened")}</span>}
                        </TableMarkup.Cell>
                        <TableMarkup.Cell className={NUM_CELL_LG}>{item.views}</TableMarkup.Cell>
                        <TableMarkup.Cell className={NUM_CELL_XL}>{item.helpfulVotes}</TableMarkup.Cell>
                      </motion.tr>
                    );
                  })}
                </TableMarkup.Body>
              </TableMarkup.Root>
            </div>
          )}
        </Section>
      )}
      </motion.div>
    </AnimatePresence>
  );
};

export const ExplorerLoading: React.FC = () => {
  const { t } = useLanguage();
  return <SectionLoading text={t("knowledge.loading", "Loading...")} minHeight="240px" />;
};

export const ExplorerEmpty: React.FC<{ title: string; description: string; onRetry?: () => void }> = ({ title, description, onRetry }) => {
  const { t } = useLanguage();
  return (
    <div className="flex flex-col items-center">
      <TableEmptyState icon={<FolderSearch className="text-slate-300" />} title={title} description={description} />
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry} className="gap-1.5">
          <RefreshCw className="h-3.5 w-3.5" /> {t("knowledge.tryAgain", "Try again")}
        </Button>
      )}
    </div>
  );
};
