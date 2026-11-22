import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Kbd } from "@/components/ui/kbd";
import { Bell, BellOff, Copy, ExternalLink, FolderOpen, Info, Share2, Sparkles, Star, ThumbsUp } from "lucide-react";
import { useBranding } from "@/components/branding/BrandLogo";
import { useLanguage } from "@/i18n";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/components/ui/utils";
import { usePermissions } from "@/hooks/usePermissions";
import { useAuth } from "@/contexts/AuthContext";
import {
  knowledgeApi,
  type KnowledgeBrowseResult,
  type KnowledgePortalDocument,
  type KnowledgePortalOverview,
  type SharingManaged,
} from "@/services/api/knowledge";
import { ExplorerContextMenu, type ContextMenuAction } from "./ExplorerContextMenu";
import { ExplorerActionSheet } from "./ExplorerActionSheet";
import { ExplorerDetailsModal } from "./ExplorerDetailsModal";
import { ExplorerInspector, type InspectorTarget } from "./ExplorerInspector";
import { FolderStylesProvider, TypeIconsProvider, folderStyleKeys, typeIconKey, type FolderStyleOf, type TypeIcon } from "./ExplorerIcons";
import { ExplorerEmpty, ExplorerItems, ExplorerLoading } from "./ExplorerItems";
import { TablePagination } from "@/components/ui/table/TablePagination";
import { ExplorerSidebar } from "./ExplorerSidebar";
import { ExplorerToolbar } from "./ExplorerToolbar";
import { ShareDialog, type ShareTarget } from "./ShareDialog";
import { ExplorerWidgets } from "./ExplorerWidgets";
import {
  buildCrumbs,
  cardsToFolders,
  navKey,
  parentOf,
  DEFAULT_SORT_DIR,
  PAGE_SIZE_OPTIONS,
  DEFAULT_PAGE_SIZE,
  serverSortKey,
  sortFolders,
  SMART_LABELS,
  type ExplorerNav,
  type FolderEntry,
  type Selection,
  type SortDir,
  type SortKey,
  type ViewMode,
} from "./explorerModel";
import { openKnowledgePreview, openKnowledgeSuggestion } from "./openExplorer";
import { pageBackgroundCss } from "@/config/page-background";
import { useMediaQuery } from "./useMediaQuery";
import { APP_SIDEBAR_COLLAPSED_WIDTH, MOBILE_SIDEBAR_WIDTH } from "@/components/layout/sidebar/sidebarWidths";
import { useSidebarWidth } from "@/components/layout/sidebar/useSidebarWidth";
import { SEARCH_DEBOUNCE_MS } from "@/constants/search";

const VIEW_STORAGE_KEY = "eqms.knowledgeExplorer.view";
const WIDGETS_STORAGE_KEY = "eqms.knowledgeExplorer.widgets";

const SIDEBAR_STORAGE_KEY = "eqms.knowledgeExplorer.sidebar";
const PAGE_SIZE_STORAGE_KEY = "eqms.knowledgeExplorer.pageSize";
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
  // A link made by a Head opens the explorer at a folder: ?kb=<key>&kbLabel=<name>&path=<key>,<key>&hierarchyId=<id>
  const [searchParams] = useSearchParams();
  const reduceMotion = useReducedMotion();
  const { showToast } = useToast();
  const { user } = useAuth();
  const { hasPermissionAlias } = usePermissions();
  const branding = useBranding();
  const { language, t, tLabel } = useLanguage();
  const canFeature = hasPermissionAlias("documents.admin.knowledge_categories.manage");

  const isMedium = useMediaQuery("(min-width: 768px)");
  const isWide = useMediaQuery("(min-width: 1280px)");
  const isCompact = useMediaQuery("(max-width: 767px)");
  const isTouch = useMediaQuery("(pointer: coarse)");
  const singleTapOpen = isTouch || !isMedium;

  const [hierarchyId, setHierarchyId] = useState<string | undefined>(() => searchParams.get("hierarchyId") ?? undefined);
  const [overview, setOverview] = useState<KnowledgePortalOverview | null>(null);
  const [overviewStatus, setOverviewStatus] = useState<Status>("loading");
  const [overviewVersion, setOverviewVersion] = useState(0);

  const [history, setHistory] = useState<{ stack: ExplorerNav[]; index: number }>(() => {
    const kbKey = searchParams.get("kb");
    if (!kbKey) return { stack: [{ kind: "home" }], index: 0 };
    const path = (searchParams.get("path") ?? "").split(",").filter(Boolean);
    return { stack: [{ kind: "home" }, { kind: "kb", kb: { key: kbKey, label: searchParams.get("kbLabel") ?? kbKey }, path }], index: 1 };
  });
  const nav = history.stack[history.index];
  const [direction, setDirection] = useState<1 | -1>(1);

  const [browse, setBrowse] = useState<KnowledgeBrowseResult | null>(null);
  const [browseStatus, setBrowseStatus] = useState<Status>("ready");
  const [browseVersion, setBrowseVersion] = useState(0);

  const [searchInput, setSearchInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<KnowledgePortalDocument[]>([]);
  const [searchTotal, setSearchTotal] = useState(0);
  const [searchStatus, setSearchStatus] = useState<Status>("ready");
  const [searchVersion, setSearchVersion] = useState(0);

  const [sort, setSort] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [sortTouched, setSortTouched] = useState(false);
  const [page, setPage] = useState(1);
  const [viewMode, setViewMode] = useState<ViewMode>(() => (readStored(VIEW_STORAGE_KEY) === "list" ? "list" : "grid"));
  const [widgetsVisible, setWidgetsVisible] = useState<boolean>(() => readStored(WIDGETS_STORAGE_KEY) !== "off");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => readStored(SIDEBAR_STORAGE_KEY) === "collapsed");
  // While the sidebar opens or closes the main column changes width every frame; the items must follow it, not each animate to a new place.
  const [sidebarMoving, setSidebarMoving] = useState(false);
  const sidebarMovingTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(sidebarMovingTimer.current), []);

  const [selection, setSelection] = useState<Selection>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [typeIcons, setTypeIcons] = useState<ReadonlyMap<string, TypeIcon>>(new Map());
  const [folderStyles, setFolderStyles] = useState<ReadonlyMap<string, FolderStyleOf>>(new Map());
  const [pageSize, setPageSize] = useState<number>(() => {
    const stored = Number(readStored(PAGE_SIZE_STORAGE_KEY));
    return PAGE_SIZE_OPTIONS.includes(stored) ? stored : DEFAULT_PAGE_SIZE;
  });
  const [menuOpen, setMenuOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState<MenuState | null>(null);
  /** A small screen has no right-click: the actions of the chosen item are shown in a bottom sheet. */
  const [actionSheet, setActionSheet] = useState<Exclude<Selection, null> | null>(null);
  /** The Departments the user may share (a Department Head); empty for everyone else, who then never see "Share". */
  const [managed, setManaged] = useState<SharingManaged>({ departmentIds: [], businessUnitIds: [] });
  const [shareTarget, setShareTarget] = useState<ShareTarget | null>(null);
  const canShare = managed.departmentIds.length > 0 || managed.businessUnitIds.length > 0;

  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let alive = true;
    knowledgeApi.sharingManaged().then((result) => { if (alive) setManaged(result); }).catch(() => { if (alive) setManaged({ departmentIds: [], businessUnitIds: [] }); });
    return () => { alive = false; };
  }, []);

  useEffect(() => { document.title = `${branding.systemDisplayName || "EQMS"} · ${t("knowledge.title", "Knowledge Base")}`; }, [branding.systemDisplayName, t]);

  const { width: storedSidebarWidth } = useSidebarWidth();
  const explorerGridTemplateColumns = useMemo(() => {
    if (!isMedium) return "minmax(0, 1fr)";
    const sidebarWidth = sidebarCollapsed ? `${APP_SIDEBAR_COLLAPSED_WIDTH}px` : `${storedSidebarWidth}px`;
    // A wide screen keeps the details of the selection beside the list, so browsing does not open and close a dialog.
    return isWide ? `${sidebarWidth} minmax(0, 1fr) 20rem` : `${sidebarWidth} minmax(0, 1fr)`;
  }, [isMedium, isWide, sidebarCollapsed, storedSidebarWidth]);

  // ---- data -------------------------------------------------------------------------------
  // the colour and the abbreviation of each Business Unit, Department and Document Type, as folders (Dictionaries); read once
  useEffect(() => {
    let alive = true;
    knowledgeApi.folderStyles()
      .then((list) => {
        if (!alive) return;
        const styles = new Map<string, FolderStyleOf>();
        list.forEach((f) => {
          const [byId, byName] = folderStyleKeys(f.id, f.name);
          const style = { color: f.color, abbreviation: f.abbreviation };
          styles.set(byId, style);
          if (!styles.has(byName)) styles.set(byName, style);
        });
        setFolderStyles(styles);
      })
      .catch(() => { /* the automatic colours and the full names are used */ });
    return () => { alive = false; };
  }, []);

  // the icon each Document Type was designed with (Document Types administration); read once
  useEffect(() => {
    let alive = true;
    knowledgeApi.documentTypeIcons()
      .then((list) => {
        if (!alive) return;
        setTypeIcons(new Map(list.map((t) => [typeIconKey(t.name), { label: t.iconLabel, color: t.iconColor, shortCode: t.shortCode }])));
      })
      .catch(() => { /* the automatic icons are used */ });
    return () => { alive = false; };
  }, []);

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
    knowledgeApi.browse(activeHierarchyId, nav.kb.key, nav.path, { page, limit: pageSize, sortBy: serverSortKey(sort), sortDirection: sortDir })
      .then((result) => { if (alive) { setBrowse(result); setBrowseStatus("ready"); } })
      .catch((error) => {
        if (!alive) return;
        setBrowseStatus("error");
        showToast({ type: "error", title: "Failed to load", message: errorMessage(error, "Unable to open this folder.") });
      });
    return () => { alive = false; };
  }, [nav, activeHierarchyId, browseVersion, page, pageSize, sort, sortDir, showToast]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const trimmed = searchInput.trim();
      setSearchTerm(trimmed.length >= MIN_SEARCH_LENGTH ? trimmed : "");
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    const collection = nav.kind === "smart" && nav.key !== "subscribed" ? nav.key : undefined;
    if (!searchTerm && !collection) { setSearchResults([]); setSearchTotal(0); setSearchStatus("ready"); return undefined; }
    let alive = true;
    setSearchStatus("loading");
    knowledgeApi.queryDocuments({ search: searchTerm || undefined, collection: searchTerm ? undefined : collection, page, limit: pageSize,
      sortBy: sortTouched ? serverSortKey(sort) : !searchTerm && collection ? (collection === "useful" ? "helpful" : "views") : "name",
      sortDirection: sortTouched ? sortDir : !searchTerm && collection ? "desc" : "asc" })
      .then((result) => { if (alive) { setSearchResults(result.documents); setSearchTotal(result.totalDocuments); setSearchStatus("ready"); } })
      .catch(() => { if (alive) { setSearchResults([]); setSearchTotal(0); setSearchStatus("error"); } });
    return () => { alive = false; };
  }, [searchTerm, searchVersion, nav, page, pageSize, sort, sortDir, sortTouched]);

  const refreshAll = useCallback(() => {
    setOverviewVersion((v) => v + 1);
    setBrowseVersion((v) => v + 1);
    setSearchVersion((v) => v + 1);
  }, []);

  // ---- navigation -------------------------------------------------------------------------
  const clearTransient = useCallback(() => {
    setSelection(null);
    setDetailsOpen(false);
    setMenuOpen(false);
    setContextMenu(null);
    setActionSheet(null);
    setSearchInput("");
    setSearchTerm("");
    setSortTouched(false);
    setPage(1);
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

  useEffect(() => { scrollRef.current?.scrollTo?.({ top: 0, behavior: "instant" }); }, [navKey(nav), searchTerm]);

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
      if (nav.key !== "subscribed") docs = searchResults;
      if (nav.key === "subscribed") folders = cardsToFolders((overview?.knowledgeBases ?? []).filter((kb) => kb.subscribed));
    } else if (browse) {
      folders = browse.folders.map((f) => ({ key: f.key, label: f.label, documentCount: f.documentCount, isKnowledgeBase: false }));
      docs = browse.documents;
    }
    // Business document rows arrive in server order. Only navigation folders are arranged here.
    const fromServer = searching || nav.kind === "kb" || (nav.kind === "smart" && nav.key !== "subscribed");
    const rankedList = searching || nav.kind === "smart";
    if (!rankedList || sortTouched) {
      folders = sortFolders(folders, sort);
    }
    const totalDocs = fromServer ? (searching || nav.kind === "smart" ? searchTotal : browse?.totalDocuments ?? 0) : docs.length;
    return { folders, docs, totalDocs };
  }, [searching, shortQuery, searchActive, searchResults, searchTotal, nav, overview, browse, sort, sortDir, sortTouched]);

  const knownDocuments = useMemo(() => {
    const map = new Map<string, KnowledgePortalDocument>();
    [...(overview?.featured ?? []), ...(overview?.mostViewed ?? []), ...(overview?.mostUseful ?? []), ...content.docs]
      .forEach((item) => map.set(item.document.id, item));
    return map;
  }, [overview, content.docs]);

  const smartDocuments = nav.kind === "smart" && nav.key !== "subscribed";
  const loading = searching ? !shortQuery && (searchPending || searchStatus === "loading") : smartDocuments ? searchStatus === "loading" : nav.kind === "kb" ? browseStatus === "loading" && !browse : overviewStatus === "loading";
  const failed = searching ? !shortQuery && !searchPending && searchStatus === "error" : smartDocuments ? searchStatus === "error" : nav.kind === "kb" ? browseStatus === "error" : overviewStatus === "error";
  const itemCount = content.folders.length + content.totalDocs;
  const totalPages = Math.max(1, Math.ceil(content.totalDocs / pageSize));
  // The list shrank (another search, a refresh): never sit on a page that no longer exists.
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);

  const chooseSort = useCallback((key: SortKey, dir?: SortDir) => {
    setSort(key);
    setSortDir(dir ?? DEFAULT_SORT_DIR[key]);
    setSortTouched(true);
    setPage(1);
  }, []);
  // A column header: the same column flips its direction, another column starts in its natural direction.
  const sortByColumn = useCallback((key: SortKey) => {
    chooseSort(key, key === sort ? (sortDir === "asc" ? "desc" : "asc") : undefined);
  }, [chooseSort, sort, sortDir]);
  const showWidgets = nav.kind === "home" && !searchInput && widgetsVisible && overview !== null && overviewStatus === "ready";
  // A list-view table that is the first thing on the page owns the top edge: no padding above it, so its header pins flush.
  const tableAtTop = !isCompact && viewMode === "list" && nav.kind !== "home";

  const folderStylesValue = useMemo(() => ({
    styles: folderStyles,
    abbreviate: branding.knowledgeFolderNames === "ABBREVIATION",
    abbreviateSidebar: (branding.knowledgeSidebarFolderNames ?? branding.knowledgeFolderNames) === "ABBREVIATION",
  }), [folderStyles, branding.knowledgeFolderNames, branding.knowledgeSidebarFolderNames]);
  const builtCrumbs = buildCrumbs(nav, browse?.path, searchActive ? searchTerm : searching ? searchInput.trim() : undefined);
  // the folders of the path are named as the folders themselves are (full name or abbreviation); the full name stays the label of the crumb for the title
  const presentedCrumbs = nav.kind === "kb" && !searching && folderStylesValue.abbreviate
    ? builtCrumbs.map((crumb, index) => {
        if (index === 0) return crumb;
        const key = browse?.path?.[index - 1]?.key ?? nav.kb.key;
        const style = folderStylesValue.styles.get(folderStyleKeys(key, crumb.label)[0]) ?? folderStylesValue.styles.get(folderStyleKeys(key, crumb.label)[1]);
        return style?.abbreviation ? { ...crumb, label: style.abbreviation } : crumb;
      })
    : builtCrumbs;
  const crumbs = presentedCrumbs.map((crumb) => ({
    ...crumb,
    label: crumb.label.startsWith("Search: ")
      ? `${t("knowledge.search", "Search")}: ${crumb.label.slice("Search: ".length)}`
      : tLabel(crumb.label),
  }));
  const locationTitle = searching
    ? t("knowledge.searchResults", "Search results")
    : nav.kind === "home"
      ? t("knowledge.title", "Knowledge Base")
      : nav.kind === "smart"
        ? tLabel(SMART_LABELS[nav.key])
        : crumbs[crumbs.length - 1]?.label ?? nav.kb.label;

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
  }, []);

  const selectDocument = useCallback((item: KnowledgePortalDocument) => select({ type: "doc", id: item.document.id }), [select]);

  const toggleSubscribe = useCallback(async (key: string) => {
    const card = overview?.knowledgeBases.find((kb) => kb.key === key);
    if (!card || !overview?.determinatorField) return;
    try {
      await knowledgeApi.setSubscribed(overview.determinatorField, key, !card.subscribed);
      showToast({
        type: "success",
        title: card.subscribed ? t("knowledge.unsubscribedToast", "Unsubscribed") : t("knowledge.subscribedToast", "Subscribed"),
        message: card.subscribed
          ? `${t("knowledge.unsubscribeMessage", "You will no longer be told about new documents in")} ${card.label}.`
          : `${t("knowledge.subscribeMessage", "You will be notified when a new document is published in")} ${card.label}.`,
      });
      refreshAll();
    } catch (error) {
      showToast({ type: "error", title: t("knowledge.subscriptionUpdateFailed", "Could not update the subscription"), message: errorMessage(error, t("knowledge.pleaseTryAgain", "Please try again.")) });
    }
  }, [overview, refreshAll, showToast, t]);

  const toggleHelpful = useCallback(async (item: KnowledgePortalDocument) => {
    try {
      await knowledgeApi.giveFeedback(item.document.id, !item.myFeedback);
      refreshAll();
    } catch (error) {
      showToast({ type: "error", title: t("knowledge.feedbackFailed", "Could not save feedback"), message: errorMessage(error, t("knowledge.pleaseTryAgain", "Please try again.")) });
    }
  }, [refreshAll, showToast, t]);

  const toggleFeatured = useCallback(async (item: KnowledgePortalDocument) => {
    try {
      await knowledgeApi.setFeatured(item.document.id, !item.featured);
      refreshAll();
    } catch (error) {
      showToast({ type: "error", title: t("knowledge.featuredFailed", "Could not update Featured"), message: errorMessage(error, t("knowledge.pleaseTryAgain", "Please try again.")) });
    }
  }, [refreshAll, showToast, t]);

  const copyNumber = useCallback(async (item: KnowledgePortalDocument) => {
    try {
      await navigator.clipboard.writeText(item.document.documentNumber);
      showToast({ type: "success", title: t("knowledge.copiedTitle", "Copied"), message: `${item.document.documentNumber} ${t("knowledge.copiedMessage", "copied to the clipboard.")}` });
    } catch {
      showToast({ type: "error", title: t("knowledge.copyFailedTitle", "Could not copy"), message: t("knowledge.clipboardDenied", "Your browser did not allow access to the clipboard.") });
    }
  }, [showToast, t]);

  const shareFolder = useCallback((folder: FolderEntry) => {
    if (folder.isKnowledgeBase) {
      setShareTarget({ kind: "folder", hierarchyId: activeHierarchyId, knowledgeBase: folder.key, path: [], label: folder.label });
    } else if (nav.kind === "kb") {
      setShareTarget({ kind: "folder", hierarchyId: activeHierarchyId, knowledgeBase: nav.kb.key, path: [...nav.path, folder.key], label: folder.label });
    }
  }, [activeHierarchyId, nav]);

  const shareDocument = useCallback((item: KnowledgePortalDocument) => {
    setShareTarget({ kind: "document", documentId: item.document.id, label: `${item.document.documentNumber} - ${item.document.documentName}` });
  }, []);

  const openContextMenu = useCallback((event: React.MouseEvent, sel: Exclude<Selection, null>) => {
    event.preventDefault();
    setSelection(sel);
    setContextMenu({ x: event.clientX, y: event.clientY, selection: sel });
  }, []);

  const actionsFor = useCallback((sel: Exclude<Selection, null>): ContextMenuAction[] => {
    if (sel.type === "folder") {
      const folder = content.folders.find((f) => f.key === sel.key);
      if (!folder) return [];
      const actions: ContextMenuAction[] = [
        { id: "open", label: t("knowledge.openFolder", "Open folder"), icon: <FolderOpen className="h-4 w-4" />, onSelect: () => openSelection(sel) },
        { id: "details", label: t("knowledge.viewDetails", "View Details"), icon: <Info className="h-4 w-4" />, onSelect: () => setDetailsOpen(true) },
      ];
      if (canShare) {
        actions.push({ id: "share", label: t("knowledge.share", "Share..."), icon: <Share2 className="h-4 w-4" />, separatorBefore: true, onSelect: () => shareFolder(folder) });
      }
      if (folder.isKnowledgeBase) {
        actions.push({ id: "subscribe", label: folder.subscribed ? t("knowledge.unsubscribe", "Unsubscribe") : t("knowledge.subscribe", "Subscribe to new documents"), icon: folder.subscribed ? <BellOff className="h-4 w-4" /> : <Bell className="h-4 w-4" />, onSelect: () => void toggleSubscribe(folder.key) });
      }
      return actions;
    }
    const item = knownDocuments.get(sel.id);
    if (!item) return [];
    const actions: ContextMenuAction[] = [
      { id: "open", label: t("knowledge.openDocument", "Open Document"), icon: <ExternalLink className="h-4 w-4" />, onSelect: () => openSelection(sel) },
      { id: "details", label: t("knowledge.viewDetails", "View Details"), icon: <Info className="h-4 w-4" />, onSelect: () => setDetailsOpen(true) },
      { id: "helpful", label: item.myFeedback ? t("knowledge.removeHelpfulVote", "Remove My Helpful Vote") : t("knowledge.markAsHelpful", "Mark As Helpful"), icon: <ThumbsUp className="h-4 w-4" />, onSelect: () => void toggleHelpful(item) },
    ];
    if (canFeature) actions.push({ id: "feature", label: item.featured ? t("knowledge.removeFeatured", "Remove From Featured") : t("knowledge.featureThis", "Feature This document"), icon: <Star className="h-4 w-4" />, onSelect: () => void toggleFeatured(item) });
    if (canShare) actions.push({ id: "share", label: t("knowledge.shareAction", "Share"), icon: <Share2 className="h-4 w-4" />, separatorBefore: true, onSelect: () => shareDocument(item) });
    actions.push({ id: "copy", label: t("knowledge.copyNumber", "Copy Document Number"), icon: <Copy className="h-4 w-4" />, separatorBefore: true, onSelect: () => void copyNumber(item) });
    return actions;
  }, [content.folders, knownDocuments, canFeature, canShare, openSelection, shareFolder, shareDocument, toggleSubscribe, toggleHelpful, toggleFeatured, copyNumber, t]);

  const contextActions = useMemo<ContextMenuAction[]>(() => (contextMenu ? actionsFor(contextMenu.selection) : []), [contextMenu, actionsFor]);

  /** A small screen opens the same actions as a bottom sheet; a mouse still gets the menu at the pointer. */
  const openActions = useCallback((event: React.MouseEvent, sel: Exclude<Selection, null>) => {
    if (isCompact || isTouch) {
      setSelection(sel);
      setContextMenu(null);
      setMenuOpen(false);
      setActionSheet(sel);
      return;
    }
    openContextMenu(event, sel);
  }, [isCompact, isTouch, openContextMenu]);

  const actionSheetTitle = useMemo(() => {
    if (!actionSheet) return "";
    if (actionSheet.type === "folder") return content.folders.find((f) => f.key === actionSheet.key)?.label ?? "Folder";
    return knownDocuments.get(actionSheet.id)?.document.documentName ?? "Document";
  }, [actionSheet, content.folders, knownDocuments]);

  const sheetActions = useMemo<ContextMenuAction[]>(() => {
    if (!actionSheet) return [];
    return actionsFor(actionSheet).map((action) => ({
      ...action,
      onSelect: () => { setActionSheet(null); action.onSelect(); },
    }));
  }, [actionSheet, actionsFor]);

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
      if (actionSheet) { setActionSheet(null); return; }
      if (contextMenu) { setContextMenu(null); return; }
      if (menuOpen) { setMenuOpen(false); return; }
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

  const renderSidebar = (collapsed = false) => (
    <ExplorerSidebar
      overview={overview}
      nav={nav}
      onGo={go}
      onHierarchyChange={(id) => { setHierarchyId(id); go({ kind: "home" }); }}
      collapsed={collapsed}
      onFocusSearch={() => { setMenuOpen(false); searchInputRef.current?.focus(); }}
      onToggleCollapsed={() => {
        setSidebarMoving(true);
        window.clearTimeout(sidebarMovingTimer.current);
        sidebarMovingTimer.current = window.setTimeout(() => setSidebarMoving(false), 520);
        setSidebarCollapsed((current) => { const next = !current; writeStored(SIDEBAR_STORAGE_KEY, next ? "collapsed" : "expanded"); return next; });
      }}
    />
  );

  // ---- empty / message states -------------------------------------------------------------
  const emptyState = (() => {
    if (failed) return <ExplorerEmpty title={t("knowledge.couldNotLoad", "This could not be loaded")} description={t("knowledge.connectionHint", "Check your connection and try again.")} onRetry={refreshAll} />;
    if (shortQuery) return <ExplorerEmpty title={t("knowledge.keepTyping", "Keep typing")} description={t("knowledge.keepTypingHint", `Enter at least ${MIN_SEARCH_LENGTH} characters to search all documents.`)} />;
    if (searching) return <ExplorerEmpty title={`${t("knowledge.noMatch", "No documents match")} "${trimmedSearch}"`} description={t("knowledge.noMatchHint", "Try a different document number or a shorter part of the name.")} />;
    if (nav.kind === "home") {
      return overview && !overview.selectedHierarchyId
        ? <ExplorerEmpty title={t("knowledge.noHierarchy", "No hierarchy configured")} description={t("knowledge.noHierarchyHint", "Ask an administrator to create a Knowledge Categories Hierarchy.")} />
        : <ExplorerEmpty title={t("knowledge.noDocumentsYet", "No documents yet")} description={t("knowledge.noDocumentsHint", "Effective documents you are allowed to see will appear here.")} />;
    }
    if (nav.kind === "smart") {
      const text: Record<string, string> = {
        featured: t("knowledge.featuredNone", "Document Control has not featured any document yet."),
        viewed: t("knowledge.viewedNone", "Documents will be ranked here once people start opening them."),
        useful: t("knowledge.usefulNone", "Documents will be ranked here once readers mark them as helpful."),
        subscribed: t("knowledge.subscribedNone", "Use the bell on a Knowledge Base to get an email when a new document is published."),
      };
      return <ExplorerEmpty title={t("knowledge.nothingHere", "Nothing here yet")} description={text[nav.key]} />;
    }
    return <ExplorerEmpty title={t("knowledge.thisFolderEmpty", "This folder is empty")} description={t("knowledge.folderEmptyHint", "There are no documents in this folder.")} />;
  })();

  return (
    <TypeIconsProvider value={typeIcons}>
    <FolderStylesProvider value={folderStylesValue}>
    <div className="flex h-[100dvh] w-full overflow-hidden bg-white" onKeyDown={onKeyDown}>
      <motion.div
        initial={false}
        animate={{ gridTemplateColumns: explorerGridTemplateColumns }}
        transition={{ gridTemplateColumns: reduceMotion ? { duration: 0 } : { duration: 0.4, ease: [0.16, 1, 0.3, 1] } }}
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
            onSubmitSearch={() => { const typed = searchInput.trim(); if (typed.length >= MIN_SEARCH_LENGTH) setSearchTerm(typed); }}
            onOpenSuggestion={openKnowledgeSuggestion}
            onSort={(value) => chooseSort(value)}
            onView={(mode) => { setViewMode(mode); writeStored(VIEW_STORAGE_KEY, mode); }}
            onToggleWidgets={() => setWidgetsVisible((v) => { writeStored(WIDGETS_STORAGE_KEY, v ? "off" : "on"); return !v; })}
            onOpenMenu={() => setMenuOpen(true)}
          />

          <div ref={scrollRef} className={cn("min-h-0 flex-1 overflow-auto px-3 custom-scrollbar md:px-4", tableAtTop ? "pb-4 pt-0" : "py-4")} style={{ background: pageBackgroundCss(branding.knowledgeBackground) }} onClick={(e) => { if (!(e.target as HTMLElement).closest("[data-item],button,select,input")) setSelection(null); }}>
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
                    className="mb-4 flex flex-col gap-3 rounded-xl border border-slate-200 bg-white px-4 py-4 shadow-sm sm:flex-row sm:items-center sm:justify-between md:px-5"
                  >
                    <div className="flex min-w-0 items-start gap-3">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-emerald-50 text-emerald-600" aria-hidden="true">
                        <Sparkles className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <h2 id="knowledge-welcome-title" className="text-sm font-semibold text-slate-900 md:text-base">
                          {t("knowledge.welcome", "Welcome to Knowledge Base")}{user?.fullName?.trim() ? `, ${user.fullName.trim()}` : ""}
                        </h2>
                        <p className="mt-0.5 text-xs leading-5 text-slate-600 md:text-sm">
                          {t("knowledge.welcomeBrowse", "Browse the latest effective documents, or use search to find the information you need.")}
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
                    totalDocs={content.totalDocs}
                    sort={sort}
                    sortDir={sortDir}
                    onSortColumn={sortByColumn}
                    view={viewMode}
                    selection={selection}
                    highlight={searchActive ? searchTerm : undefined}
                    singleTapOpen={singleTapOpen}
                    layoutAnimations={!sidebarMoving}
                    onSelect={select}
                    onOpen={openSelection}
                    onContextMenu={openContextMenu}
                    onActions={openActions}
                    onToggleSubscribe={(key) => void toggleSubscribe(key)}
                  />
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          {content.totalDocs > 0 && (
            <div className="border-t border-slate-200 bg-white">
              <TablePagination
                currentPage={page}
                totalPages={totalPages}
                totalItems={content.totalDocs}
                itemsPerPage={pageSize}
                itemsPerPageOptions={PAGE_SIZE_OPTIONS}
                isLoading={loading}
                onPageChange={setPage}
                onItemsPerPageChange={(size) => { setPageSize(size); writeStored(PAGE_SIZE_STORAGE_KEY, String(size)); setPage(1); }}
              />
            </div>
          )}

          <div className="flex items-center gap-4 border-t border-slate-200 bg-white px-4 py-1.5 text-xs text-slate-600">
            <span><span className="font-semibold tabular-nums text-slate-700">{itemCount}</span> {t(itemCount === 1 ? "knowledge.item" : "knowledge.items", itemCount === 1 ? "item" : "items")}</span>
            {selection && <span><span className="font-semibold text-slate-700">1</span> {t("knowledge.selected", "selected")}</span>}
            <span className="ml-auto hidden items-center gap-1.5 lg:inline-flex">
              {t(singleTapOpen ? "knowledge.tapToOpen" : "knowledge.doubleClickToOpen", singleTapOpen ? "Tap to open" : "Double-click to open")} · {t("knowledge.rightClickActions", "Right-click or ⋯ for actions")} · <Kbd keys={["/"]} size="sm" /> {t("knowledge.searchHint", "to search")}
            </span>
          </div>
        </section>

        {isWide && (
          <aside className="min-h-0 overflow-hidden border-l border-slate-200 bg-white" aria-label="Details">
            <ExplorerInspector
              target={inspectorTarget}
              canFeature={canFeature}
              onShareDocument={canShare ? shareDocument : undefined}
              onShareFolder={canShare ? shareFolder : undefined}
              onOpenDocument={openKnowledgePreview}
              onOpenFolder={(folder) => go(folderTarget(folder))}
              onToggleHelpful={(item) => void toggleHelpful(item)}
              onToggleFeatured={(item) => void toggleFeatured(item)}
              onToggleSubscribe={(key) => void toggleSubscribe(key)}
            />
          </aside>
        )}

      </motion.div>

      <AnimatePresence>
        {menuOpen && (
          <div className="fixed inset-0 z-50 md:hidden">
            <motion.div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setMenuOpen(false)} />
            <motion.aside
              className="absolute inset-y-0 left-0 max-w-[92vw] bg-white shadow-xl" style={{ width: MOBILE_SIDEBAR_WIDTH }}
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

      {contextMenu && contextActions.length > 0 && (
        <ExplorerContextMenu x={contextMenu.x} y={contextMenu.y} actions={contextActions} onClose={() => setContextMenu(null)} />
      )}

      <ExplorerDetailsModal
        target={detailsOpen ? inspectorTarget : null}
        canFeature={canFeature}
        onClose={() => setDetailsOpen(false)}
        onShareDocument={canShare ? shareDocument : undefined}
        onShareFolder={canShare ? shareFolder : undefined}
        onOpenDocument={openKnowledgePreview}
        onOpenFolder={(folder) => go(folderTarget(folder))}
        onToggleHelpful={(item) => void toggleHelpful(item)}
        onToggleFeatured={(item) => void toggleFeatured(item)}
        onToggleSubscribe={(key) => void toggleSubscribe(key)}
      />

      <ExplorerActionSheet
        open={actionSheet !== null}
        title={actionSheetTitle}
        actions={sheetActions}
        onClose={() => setActionSheet(null)}
      />

      <ShareDialog target={shareTarget} onClose={() => setShareTarget(null)} />
    </div>
    </FolderStylesProvider>
    </TypeIconsProvider>
  );
};
