import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Bell, BellOff, Copy, ExternalLink, FolderOpen, Sparkles, Star, ThumbsUp } from "lucide-react";
import { ROUTES } from "@/app/routes.constants";
import { useBranding } from "@/components/branding/BrandLogo";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/components/ui/utils";
import { usePermissions } from "@/hooks/usePermissions";
import { useAuth } from "@/contexts/AuthContext";
import {
  knowledgeApi,
  type KnowledgeBrowseResult,
  type KnowledgePortalDocument,
  type KnowledgePortalOverview,
} from "@/services/api/knowledge";
import { ExplorerContextMenu, type ContextMenuAction } from "./ExplorerContextMenu";
import { ExplorerInspector, type InspectorTarget } from "./ExplorerInspector";
import { ExplorerEmpty, ExplorerItems, ExplorerLoading } from "./ExplorerItems";
import { ExplorerSidebar } from "./ExplorerSidebar";
import { ExplorerToolbar } from "./ExplorerToolbar";
import { ExplorerWidgets } from "./ExplorerWidgets";
import {
  buildCrumbs,
  cardsToFolders,
  navKey,
  parentOf,
  sortDocuments,
  sortFolders,
  SMART_LABELS,
  type ExplorerNav,
  type FolderEntry,
  type Selection,
  type SortKey,
  type ViewMode,
} from "./explorerModel";
import { openKnowledgePreview } from "./openExplorer";
import { useMediaQuery } from "./useMediaQuery";

const VIEW_STORAGE_KEY = "eqms.knowledgeExplorer.view";
const WIDGETS_STORAGE_KEY = "eqms.knowledgeExplorer.widgets";
const SIDEBAR_STORAGE_KEY = "eqms.knowledgeExplorer.sidebar";
const MIN_SEARCH_LENGTH = 3;

const readStored = (key: string): string | null => {
  try { return window.localStorage.getItem(key); } catch { return null; }
};
const writeStored = (key: string, value: string) => {
  try { window.localStorage.setItem(key, value); } catch { /* storage unavailable: the preference just is not remembered */ }
};

const errorMessage = (error: unknown, fallback: string) =>
  (error as { response?: { data?: { error?: { message?: string }; message?: string } } })?.response?.data?.error?.message ?? fallback;

type Status = "loading" | "ready" | "error";

interface MenuState { x: number; y: number; selection: Exclude<Selection, null> }

export const KnowledgeExplorerPage: React.FC = () => {
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  const { showToast } = useToast();
  const { user } = useAuth();
  const { hasPermissionAlias } = usePermissions();
  const branding = useBranding();
  const canFeature = hasPermissionAlias("documents.admin.knowledge_categories.manage");

  const isWide = useMediaQuery("(min-width: 1280px)");
  const isMedium = useMediaQuery("(min-width: 768px)");
  const isTouch = useMediaQuery("(pointer: coarse)");
  const singleTapOpen = isTouch || !isMedium;

  const [hierarchyId, setHierarchyId] = useState<string | undefined>(undefined);
  const [overview, setOverview] = useState<KnowledgePortalOverview | null>(null);
  const [overviewStatus, setOverviewStatus] = useState<Status>("loading");
  const [overviewVersion, setOverviewVersion] = useState(0);

  const [history, setHistory] = useState<{ stack: ExplorerNav[]; index: number }>({ stack: [{ kind: "home" }], index: 0 });
  const nav = history.stack[history.index];
  const [direction, setDirection] = useState<1 | -1>(1);

  const [browse, setBrowse] = useState<KnowledgeBrowseResult | null>(null);
  const [browseStatus, setBrowseStatus] = useState<Status>("ready");
  const [browseVersion, setBrowseVersion] = useState(0);

  const [searchInput, setSearchInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<KnowledgePortalDocument[]>([]);
  const [searchStatus, setSearchStatus] = useState<Status>("ready");
  const [searchVersion, setSearchVersion] = useState(0);

  const [sort, setSort] = useState<SortKey>("name");
  const [sortTouched, setSortTouched] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>(() => (readStored(VIEW_STORAGE_KEY) === "list" ? "list" : "grid"));
  const [widgetsVisible, setWidgetsVisible] = useState<boolean>(() => readStored(WIDGETS_STORAGE_KEY) !== "off");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => readStored(SIDEBAR_STORAGE_KEY) === "collapsed");

  const [selection, setSelection] = useState<Selection>(null);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState<MenuState | null>(null);

  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => { document.title = `${branding.systemDisplayName || "EQMS"} · Knowledge Base`; }, [branding.systemDisplayName]);

  const explorerGridTemplateColumns = useMemo(() => {
    if (!isMedium) return "minmax(0, 1fr)";
    const sidebarWidth = sidebarCollapsed ? "4.5rem" : "18rem";
    return isWide ? `${sidebarWidth} minmax(0, 1fr) 22rem` : `${sidebarWidth} minmax(0, 1fr)`;
  }, [isMedium, isWide, sidebarCollapsed]);

  // ---- data -------------------------------------------------------------------------------
  useEffect(() => {
    let alive = true;
    knowledgeApi.overview(hierarchyId)
      .then((result) => { if (alive) { setOverview(result); setOverviewStatus("ready"); } })
      .catch((error) => {
        if (!alive) return;
        setOverviewStatus("error");
        showToast({ type: "error", title: "Failed to load", message: errorMessage(error, "Unable to load the Knowledge Base.") });
      });
    return () => { alive = false; };
  }, [hierarchyId, overviewVersion, showToast]);

  const activeHierarchyId = overview?.selectedHierarchyId ?? hierarchyId;
  useEffect(() => {
    if (nav.kind !== "kb") { setBrowse(null); setBrowseStatus("ready"); return undefined; }
    let alive = true;
    setBrowseStatus("loading");
    knowledgeApi.browse(activeHierarchyId, nav.kb.key, nav.path)
      .then((result) => { if (alive) { setBrowse(result); setBrowseStatus("ready"); } })
      .catch((error) => {
        if (!alive) return;
        setBrowseStatus("error");
        showToast({ type: "error", title: "Failed to load", message: errorMessage(error, "Unable to open this folder.") });
      });
    return () => { alive = false; };
  }, [nav, activeHierarchyId, browseVersion, showToast]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const trimmed = searchInput.trim();
      setSearchTerm(trimmed.length >= MIN_SEARCH_LENGTH ? trimmed : "");
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    if (!searchTerm) { setSearchResults([]); setSearchStatus("ready"); return undefined; }
    let alive = true;
    setSearchStatus("loading");
    knowledgeApi.search(searchTerm)
      .then((result) => { if (alive) { setSearchResults(result); setSearchStatus("ready"); } })
      .catch(() => { if (alive) { setSearchResults([]); setSearchStatus("error"); } });
    return () => { alive = false; };
  }, [searchTerm, searchVersion]);

  const refreshAll = useCallback(() => {
    setOverviewVersion((v) => v + 1);
    setBrowseVersion((v) => v + 1);
    setSearchVersion((v) => v + 1);
  }, []);

  // ---- navigation -------------------------------------------------------------------------
  const clearTransient = useCallback(() => {
    setSelection(null);
    setInspectorOpen(false);
    setMenuOpen(false);
    setContextMenu(null);
    setSearchInput("");
    setSearchTerm("");
    setSortTouched(false);
  }, []);

  const go = useCallback((next: ExplorerNav) => {
    setDirection(1);
    setHistory((h) => {
      if (navKey(h.stack[h.index]) === navKey(next)) return h;
      const stack = [...h.stack.slice(0, h.index + 1), next];
      return { stack, index: stack.length - 1 };
    });
    clearTransient();
  }, [clearTransient]);

  const goBack = useCallback(() => {
    if (history.index === 0) return;
    setDirection(-1);
    setHistory((h) => ({ ...h, index: Math.max(0, h.index - 1) }));
    clearTransient();
  }, [history.index, clearTransient]);

  const goForward = useCallback(() => {
    if (history.index >= history.stack.length - 1) return;
    setDirection(1);
    setHistory((h) => ({ ...h, index: Math.min(h.stack.length - 1, h.index + 1) }));
    clearTransient();
  }, [history.index, history.stack.length, clearTransient]);

  const parent = parentOf(nav);
  const goUp = useCallback(() => {
    if (searchInput) { setSearchInput(""); setSearchTerm(""); return; }
    if (!parent) return;
    setDirection(-1);
    go(parent);
  }, [parent, go, searchInput]);

  useEffect(() => { scrollRef.current?.scrollTo?.({ top: 0 }); }, [navKey(nav), searchTerm]);

  // ---- what is on screen ------------------------------------------------------------------
  const trimmedSearch = searchInput.trim();
  const searching = trimmedSearch.length > 0;
  const shortQuery = searching && trimmedSearch.length < MIN_SEARCH_LENGTH;
  const searchActive = searchTerm.length > 0;
  // Typed three characters but the debounce has not fired yet: results are on their way.
  const searchPending = searching && !shortQuery && trimmedSearch !== searchTerm;

  const content = useMemo(() => {
    let folders: FolderEntry[] = [];
    let docs: KnowledgePortalDocument[] = [];
    if (searching) {
      docs = shortQuery || !searchActive ? [] : searchResults;
    } else if (nav.kind === "home") {
      folders = cardsToFolders(overview?.knowledgeBases ?? []);
    } else if (nav.kind === "smart") {
      if (nav.key === "featured") docs = overview?.featured ?? [];
      if (nav.key === "viewed") docs = overview?.mostViewed ?? [];
      if (nav.key === "useful") docs = overview?.mostUseful ?? [];
      if (nav.key === "subscribed") folders = cardsToFolders((overview?.knowledgeBases ?? []).filter((kb) => kb.subscribed));
    } else if (browse) {
      folders = browse.folders.map((f) => ({ key: f.key, label: f.label, documentCount: f.documentCount, isKnowledgeBase: false }));
      docs = browse.documents;
    }
    // "Most viewed" and friends are ranked lists; only re-sort them when the user asks to.
    const rankedList = searching || nav.kind === "smart";
    if (!rankedList || sortTouched) {
      docs = sortDocuments(docs, sort);
      folders = sortFolders(folders, sort);
    }
    return { folders, docs };
  }, [searching, shortQuery, searchActive, searchResults, nav, overview, browse, sort, sortTouched]);

  const knownDocuments = useMemo(() => {
    const map = new Map<string, KnowledgePortalDocument>();
    [...(overview?.featured ?? []), ...(overview?.mostViewed ?? []), ...(overview?.mostUseful ?? []), ...content.docs]
      .forEach((item) => map.set(item.document.id, item));
    return map;
  }, [overview, content.docs]);

  const loading = searching ? !shortQuery && (searchPending || searchStatus === "loading") : nav.kind === "kb" ? browseStatus === "loading" && !browse : overviewStatus === "loading";
  const failed = searching ? !shortQuery && !searchPending && searchStatus === "error" : nav.kind === "kb" ? browseStatus === "error" : overviewStatus === "error";
  const itemCount = content.folders.length + content.docs.length;
  const showWidgets = nav.kind === "home" && !searchInput && widgetsVisible && overview !== null && overviewStatus === "ready";

  const crumbs = buildCrumbs(nav, browse?.path, searchActive ? searchTerm : searching ? searchInput.trim() : undefined);
  const locationTitle = searching ? "Search results" : nav.kind === "home" ? "Knowledge Base" : nav.kind === "smart" ? SMART_LABELS[nav.key] : crumbs[crumbs.length - 1]?.label ?? nav.kb.label;

  // ---- actions ----------------------------------------------------------------------------
  const folderTarget = useCallback((folder: FolderEntry): ExplorerNav => {
    if (folder.isKnowledgeBase) return { kind: "kb", kb: { key: folder.key, label: folder.label }, path: [] };
    if (nav.kind === "kb") return { kind: "kb", kb: nav.kb, path: [...nav.path, folder.key] };
    return nav;
  }, [nav]);

  const openSelection = useCallback((sel: Exclude<Selection, null>) => {
    if (sel.type === "folder") {
      const folder = content.folders.find((f) => f.key === sel.key);
      if (folder) go(folderTarget(folder));
      return;
    }
    const item = knownDocuments.get(sel.id);
    if (item) openKnowledgePreview(item);
  }, [content.folders, go, folderTarget, knownDocuments]);

  const select = useCallback((sel: Exclude<Selection, null>) => {
    setSelection(sel);
    if (sel.type === "doc") setInspectorOpen(true);
  }, []);

  const selectDocument = useCallback((item: KnowledgePortalDocument) => select({ type: "doc", id: item.document.id }), [select]);

  const toggleSubscribe = useCallback(async (key: string) => {
    const card = overview?.knowledgeBases.find((kb) => kb.key === key);
    if (!card || !overview?.determinatorField) return;
    try {
      await knowledgeApi.setSubscribed(overview.determinatorField, key, !card.subscribed);
      showToast({
        type: "success",
        title: card.subscribed ? "Unsubscribed" : "Subscribed",
        message: card.subscribed ? `You will no longer be told about new documents in ${card.label}.` : `You will be notified when a new document is published in ${card.label}.`,
      });
      refreshAll();
    } catch (error) {
      showToast({ type: "error", title: "Could not update the subscription", message: errorMessage(error, "Please try again.") });
    }
  }, [overview, refreshAll, showToast]);

  const toggleHelpful = useCallback(async (item: KnowledgePortalDocument) => {
    try {
      await knowledgeApi.giveFeedback(item.document.id, !item.myFeedback);
      refreshAll();
    } catch (error) {
      showToast({ type: "error", title: "Could not save feedback", message: errorMessage(error, "Please try again.") });
    }
  }, [refreshAll, showToast]);

  const toggleFeatured = useCallback(async (item: KnowledgePortalDocument) => {
    try {
      await knowledgeApi.setFeatured(item.document.id, !item.featured);
      refreshAll();
    } catch (error) {
      showToast({ type: "error", title: "Could not update Featured", message: errorMessage(error, "Please try again.") });
    }
  }, [refreshAll, showToast]);

  const copyNumber = useCallback(async (item: KnowledgePortalDocument) => {
    try {
      await navigator.clipboard.writeText(item.document.documentNumber);
      showToast({ type: "success", title: "Copied", message: `${item.document.documentNumber} copied to the clipboard.` });
    } catch {
      showToast({ type: "error", title: "Could not copy", message: "Your browser did not allow access to the clipboard." });
    }
  }, [showToast]);

  const openContextMenu = useCallback((event: React.MouseEvent, sel: Exclude<Selection, null>) => {
    event.preventDefault();
    setSelection(sel);
    setContextMenu({ x: event.clientX, y: event.clientY, selection: sel });
  }, []);

  const contextActions = useMemo<ContextMenuAction[]>(() => {
    if (!contextMenu) return [];
    const sel = contextMenu.selection;
    if (sel.type === "folder") {
      const folder = content.folders.find((f) => f.key === sel.key);
      if (!folder) return [];
      const actions: ContextMenuAction[] = [{ id: "open", label: "Open folder", icon: <FolderOpen className="h-4 w-4" />, onSelect: () => openSelection(sel) }];
      if (folder.isKnowledgeBase) {
        actions.push({ id: "subscribe", label: folder.subscribed ? "Unsubscribe" : "Subscribe to new documents", icon: folder.subscribed ? <BellOff className="h-4 w-4" /> : <Bell className="h-4 w-4" />, onSelect: () => void toggleSubscribe(folder.key) });
      }
      return actions;
    }
    const item = knownDocuments.get(sel.id);
    if (!item) return [];
    const actions: ContextMenuAction[] = [
      { id: "open", label: "Open document", icon: <ExternalLink className="h-4 w-4" />, onSelect: () => openSelection(sel) },
      { id: "helpful", label: item.myFeedback ? "Remove my helpful vote" : "Mark as helpful", icon: <ThumbsUp className="h-4 w-4" />, onSelect: () => void toggleHelpful(item) },
    ];
    if (canFeature) actions.push({ id: "feature", label: item.featured ? "Remove from Featured" : "Feature this document", icon: <Star className="h-4 w-4" />, onSelect: () => void toggleFeatured(item) });
    actions.push({ id: "copy", label: "Copy document number", icon: <Copy className="h-4 w-4" />, separatorBefore: true, onSelect: () => void copyNumber(item) });
    return actions;
  }, [contextMenu, content.folders, knownDocuments, canFeature, openSelection, toggleSubscribe, toggleHelpful, toggleFeatured, copyNumber]);

  // ---- keyboard ---------------------------------------------------------------------------
  const orderedKeys = useMemo(() => [
    ...content.folders.map((f) => ({ sel: { type: "folder", key: f.key } as const, id: `folder:${f.key}` })),
    ...content.docs.map((d) => ({ sel: { type: "doc", id: d.document.id } as const, id: `doc:${d.document.id}` })),
  ], [content]);

  const onKeyDown = (event: React.KeyboardEvent) => {
    const target = event.target as HTMLElement;
    const typing = target.tagName === "INPUT" || target.tagName === "SELECT" || target.tagName === "TEXTAREA";
    if (event.key === "/" && !typing) { event.preventDefault(); searchInputRef.current?.focus(); return; }
    if (event.key === "Escape") {
      if (contextMenu) { setContextMenu(null); return; }
      if (menuOpen) { setMenuOpen(false); return; }
      if (inspectorOpen && !isWide) { setInspectorOpen(false); return; }
      if (searchInput) { setSearchInput(""); setSearchTerm(""); return; }
      return;
    }
    if (typing || target.closest('[role="menu"]')) return;
    if (event.key === "Backspace" || (event.altKey && event.key === "ArrowLeft")) { event.preventDefault(); goUp(); return; }
    if (event.key === "Enter" && selection && target.getAttribute("role") !== "option" && target.tagName !== "BUTTON") { event.preventDefault(); openSelection(selection); return; }
    const step = ({ ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 } as Record<string, number>)[event.key];
    if (!step || orderedKeys.length === 0) return;
    event.preventDefault();
    const current = orderedKeys.findIndex((o) => selection && o.sel.type === selection.type && (selection.type === "doc" ? o.sel.type === "doc" && o.sel.id === selection.id : o.sel.type === "folder" && o.sel.key === selection.key));
    const next = orderedKeys[current < 0 ? 0 : (current + step + orderedKeys.length) % orderedKeys.length];
    setSelection(next.sel);
    if (next.sel.type === "doc" && isWide) setInspectorOpen(true);
    const el = scrollRef.current?.querySelector<HTMLElement>(`[data-item="${next.id.replace(/"/g, '\\"')}"]`);
    el?.focus({ preventScroll: true });
    el?.scrollIntoView?.({ block: "nearest" });
  };

  // ---- inspector --------------------------------------------------------------------------
  const inspectorTarget: InspectorTarget = (() => {
    if (selection?.type === "doc") {
      const item = knownDocuments.get(selection.id);
      if (item) return { type: "doc", item };
    }
    if (selection?.type === "folder") {
      const folder = content.folders.find((f) => f.key === selection.key);
      if (folder) return { type: "folder", folder };
    }
    return { type: "location", title: locationTitle, itemCount };
  })();

  const inspector = (overlay: boolean) => (
    <ExplorerInspector
      target={inspectorTarget}
      canFeature={canFeature}
      onOpenDocument={openKnowledgePreview}
      onOpenFolder={(folder) => go(folderTarget(folder))}
      onToggleHelpful={(item) => void toggleHelpful(item)}
      onToggleFeatured={(item) => void toggleFeatured(item)}
      onToggleSubscribe={(key) => void toggleSubscribe(key)}
      onClose={overlay ? () => setInspectorOpen(false) : undefined}
    />
  );

  const renderSidebar = (collapsed = false) => (
    <ExplorerSidebar
      overview={overview}
      nav={nav}
      onGo={go}
      onHierarchyChange={(id) => { setHierarchyId(id); go({ kind: "home" }); }}
      onOpenClassic={() => navigate(ROUTES.SELF_SERVICE.KNOWLEDGE)}
      collapsed={collapsed}
      onToggleCollapsed={() => setSidebarCollapsed((current) => { const next = !current; writeStored(SIDEBAR_STORAGE_KEY, next ? "collapsed" : "expanded"); return next; })}
    />
  );

  // ---- empty / message states -------------------------------------------------------------
  const emptyState = (() => {
    if (failed) return <ExplorerEmpty title="This could not be loaded" description="Check your connection and try again." onRetry={refreshAll} />;
    if (shortQuery) return <ExplorerEmpty title="Keep typing" description={`Enter at least ${MIN_SEARCH_LENGTH} characters to search all documents.`} />;
    if (searching) return <ExplorerEmpty title={`No documents match "${trimmedSearch}"`} description="Try a different document number or a shorter part of the name." />;
    if (nav.kind === "home") {
      return overview && !overview.selectedHierarchyId
        ? <ExplorerEmpty title="No hierarchy configured" description="Ask an administrator to create a Knowledge Categories Hierarchy." />
        : <ExplorerEmpty title="No documents yet" description="Effective documents you are allowed to see will appear here." />;
    }
    if (nav.kind === "smart") {
      const text: Record<string, string> = {
        featured: "Document Control has not featured any document yet.",
        viewed: "Documents will be ranked here once people start opening them.",
        useful: "Documents will be ranked here once readers mark them as helpful.",
        subscribed: "Use the bell on a Knowledge Base to get an email when a new document is published.",
      };
      return <ExplorerEmpty title="Nothing here yet" description={text[nav.key]} />;
    }
    return <ExplorerEmpty title="This folder is empty" description="There are no documents in this folder." />;
  })();

  return (
    <div className="flex h-[100dvh] w-full overflow-hidden bg-white" onKeyDown={onKeyDown}>
      <motion.div
        initial={false}
        animate={{ gridTemplateColumns: explorerGridTemplateColumns }}
        transition={{ gridTemplateColumns: reduceMotion ? { duration: 0 } : { duration: 0.56, ease: [0.22, 1, 0.36, 1] } }}
        className="grid min-h-0 w-full flex-1 grid-cols-1 overflow-hidden bg-white"
        style={{
          willChange: "grid-template-columns",
          contain: "layout paint",
        }}
      >
        <aside className="hidden min-h-0 border-r border-slate-200 md:block">{renderSidebar(sidebarCollapsed)}</aside>

        <section className="flex min-h-0 min-w-0 flex-col" aria-label="Knowledge Base explorer">
          <ExplorerToolbar
            crumbs={crumbs}
            canBack={history.index > 0}
            canForward={history.index < history.stack.length - 1}
            canUp={!!parent || searching}
            search={searchInput}
            sort={sort}
            view={viewMode}
            widgetsVisible={widgetsVisible}
            widgetsAvailable={nav.kind === "home"}
            searchInputRef={searchInputRef}
            onBack={goBack}
            onForward={goForward}
            onUp={goUp}
            onCrumb={go}
            onSearch={setSearchInput}
            onSort={(value) => { setSort(value); setSortTouched(true); }}
            onView={(mode) => { setViewMode(mode); writeStored(VIEW_STORAGE_KEY, mode); }}
            onToggleWidgets={() => setWidgetsVisible((v) => { writeStored(WIDGETS_STORAGE_KEY, v ? "off" : "on"); return !v; })}
            onOpenMenu={() => setMenuOpen(true)}
          />

          <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-3 py-4 custom-scrollbar md:px-4" onClick={(e) => { if (!(e.target as HTMLElement).closest("[data-item],button,select,input,section")) setSelection(null); }}>
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={`${navKey(nav)}|${searching ? "s" : ""}`}
                initial={reduceMotion ? false : { opacity: 0, x: direction * 18 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: reduceMotion ? 0 : 0.2, ease: [0.2, 0.8, 0.3, 1] }}
              >
                {nav.kind === "home" && !searching && (
                  <motion.section
                    initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: reduceMotion ? 0 : 0.24, ease: [0.22, 1, 0.36, 1] }}
                    aria-labelledby="knowledge-welcome-title"
                    className="mb-4 flex flex-col gap-3 rounded-xl border border-emerald-100 bg-gradient-to-r from-emerald-50 via-white to-white px-4 py-4 sm:flex-row sm:items-center sm:justify-between md:px-5"
                  >
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="min-w-0">
                        <h2 id="knowledge-welcome-title" className="text-sm font-semibold text-slate-900 md:text-base">
                          Welcome to Knowledge {user?.fullName?.trim() ? `, ${user.fullName.trim()}` : ""}
                        </h2>
                        <p className="mt-0.5 text-xs leading-5 text-slate-600 md:text-sm">
                          Browse the latest effective documents, or use search to find the information you need.
                        </p>
                      </div>
                    </div>
                  </motion.section>
                )}
                {showWidgets && overview && (
                  <ExplorerWidgets overview={overview} onSelectDocument={selectDocument} onGo={go} onToggleSubscribe={(key) => void toggleSubscribe(key)} />
                )}
                {loading ? (
                  <ExplorerLoading />
                ) : itemCount === 0 ? (
                  emptyState
                ) : (
                  <ExplorerItems
                    folders={content.folders}
                    docs={content.docs}
                    view={viewMode}
                    selection={selection}
                    highlight={searchActive ? searchTerm : undefined}
                    singleTapOpen={singleTapOpen}
                    onSelect={select}
                    onOpen={openSelection}
                    onContextMenu={openContextMenu}
                    onToggleSubscribe={(key) => void toggleSubscribe(key)}
                  />
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="flex items-center gap-4 border-t border-slate-200 bg-white px-4 py-1.5 text-2xs text-slate-500 md:text-xs">
            <span><span className="font-semibold tabular-nums text-slate-700">{itemCount}</span> {itemCount === 1 ? "item" : "items"}</span>
            {selection && <span><span className="font-semibold text-slate-700">1</span> selected</span>}
            <span className="ml-auto hidden lg:inline">{singleTapOpen ? "Tap to open" : "Double-click to open"} · Right-click for actions · <kbd className="rounded border border-b-2 border-slate-300 bg-white px-1 text-2xs">/</kbd> to search</span>
          </div>
        </section>

        {isWide && <aside className="min-h-0 border-l border-slate-200" aria-label="Details">{inspector(false)}</aside>}
      </motion.div>

      <AnimatePresence>
        {menuOpen && (
          <div className="fixed inset-0 z-50 md:hidden">
            <motion.div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setMenuOpen(false)} />
            <motion.aside
              className="absolute inset-y-0 left-0 w-72 max-w-[85%] bg-white shadow-xl"
              initial={reduceMotion ? false : { x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ duration: reduceMotion ? 0 : 0.26, ease: [0.2, 0.8, 0.2, 1] }}
              role="dialog"
              aria-label="Navigation"
            >
              {renderSidebar(false)}
            </motion.aside>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {!isWide && inspectorOpen && selection && (
          <div className="fixed inset-0 z-50">
            <motion.div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setInspectorOpen(false)} />
            <motion.aside
              className={isMedium
                ? "absolute inset-y-0 right-0 w-80 max-w-full bg-white shadow-xl"
                : "absolute inset-x-0 bottom-0 max-h-[85%] overflow-hidden rounded-t-2xl bg-white shadow-xl"}
              initial={reduceMotion ? false : isMedium ? { x: "100%" } : { y: "100%" }}
              animate={{ x: 0, y: 0 }}
              exit={isMedium ? { x: "100%" } : { y: "100%" }}
              transition={{ duration: reduceMotion ? 0 : 0.28, ease: [0.2, 0.8, 0.2, 1] }}
              role="dialog"
              aria-label="Details"
            >
              {inspector(true)}
            </motion.aside>
          </div>
        )}
      </AnimatePresence>

      {contextMenu && contextActions.length > 0 && (
        <ExplorerContextMenu x={contextMenu.x} y={contextMenu.y} actions={contextActions} onClose={() => setContextMenu(null)} />
      )}
    </div>
  );
};
