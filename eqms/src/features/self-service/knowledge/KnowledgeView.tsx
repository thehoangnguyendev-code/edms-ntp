import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { IconBook2, IconFile, IconFolderOpen, IconStar, IconStarFilled, IconThumbUp } from "@tabler/icons-react";
import { Bell, BellOff, Search, X } from "lucide-react";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { knowledge as knowledgeBreadcrumb } from "@/components/ui/breadcrumb/breadcrumbs.config";
import { Button } from "@/components/ui/button/Button";
import { Select } from "@/components/ui/select/Select";
import { FullPageLoading } from "@/components/ui/loading/Loading";
import { TableEmptyState } from "@/components/ui/table/TableEmptyState";
import { cn } from "@/components/ui/utils";
import { useToast } from "@/components/ui/toast";
import { useDebounce } from "@/hooks";
import { usePermissions } from "@/hooks/usePermissions";
import { ROUTES } from "@/app/routes.constants";
import {
    knowledgeApi,
    type KnowledgeBrowseResult,
    type KnowledgePortalDocument,
    type KnowledgePortalOverview,
} from "@/services/api/knowledge";
import { FolderDocumentsList } from "./FolderDocumentsList";

// Static, literal Tailwind classes so the CDN JIT scanner can detect them.
const KB_COLORS = ["text-emerald-600", "text-blue-600", "text-amber-600", "text-purple-600", "text-cyan-600", "text-orange-600", "text-indigo-600", "text-teal-600"];

const errorMessage = (error: unknown, fallback: string) =>
    (error as { response?: { data?: { error?: { message?: string }; message?: string } } })?.response?.data?.error?.message ?? fallback;

const openPreview = (item: KnowledgePortalDocument) => {
    const doc = item.document;
    void knowledgeApi.recordView(doc.id).catch(() => undefined);
    const params = new URLSearchParams({ name: doc.documentName });
    if (doc.documentNumber) params.set("number", doc.documentNumber);
    if (doc.revisionNumber) params.set("revision", doc.revisionNumber);
    if (doc.department) params.set("department", doc.department);
    window.open(`${ROUTES.DOCUMENTS.KNOWLEDGE_PREVIEW(doc.id)}?${params.toString()}`, "_blank", "noopener,noreferrer");
};

interface Selection {
    kb: { key: string; label: string };
    path: string[];
}

export const KnowledgeView: React.FC = () => {
    const navigate = useNavigate();
    const { showToast } = useToast();
    const { hasPermissionAlias } = usePermissions();
    const canFeature = hasPermissionAlias("documents.admin.knowledge_categories.manage");

    const [hierarchyId, setHierarchyId] = useState<string | undefined>(undefined);
    const [overview, setOverview] = useState<KnowledgePortalOverview | null>(null);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const debouncedSearch = useDebounce(searchQuery, 350);
    const [searchResults, setSearchResults] = useState<KnowledgePortalDocument[] | null>(null);
    const [selection, setSelection] = useState<Selection | null>(null);
    const [browse, setBrowse] = useState<KnowledgeBrowseResult | null>(null);
    const [browseLoading, setBrowseLoading] = useState(false);

    const loadOverview = useCallback(async () => {
        try {
            setOverview(await knowledgeApi.overview(hierarchyId));
        } catch (error) {
            showToast({ type: "error", title: "Failed to load", message: errorMessage(error, "Unable to load the Knowledge Base.") });
        } finally {
            setLoading(false);
        }
    }, [hierarchyId, showToast]);

    useEffect(() => { void loadOverview(); }, [loadOverview]);

    useEffect(() => {
        const q = debouncedSearch.trim();
        if (q.length < 3) { setSearchResults(null); return; }
        let alive = true;
        knowledgeApi.search(q).then((result) => { if (alive) setSearchResults(result); }).catch(() => { if (alive) setSearchResults([]); });
        return () => { alive = false; };
    }, [debouncedSearch]);

    useEffect(() => {
        if (!selection) { setBrowse(null); return; }
        let alive = true;
        setBrowseLoading(true);
        knowledgeApi.browse(overview?.selectedHierarchyId ?? hierarchyId, selection.kb.key, selection.path)
            .then((result) => { if (alive) setBrowse(result); })
            .catch((error) => showToast({ type: "error", title: "Failed to load", message: errorMessage(error, "Unable to open this folder.") }))
            .finally(() => { if (alive) setBrowseLoading(false); });
        return () => { alive = false; };
    }, [selection, overview?.selectedHierarchyId, hierarchyId, showToast]);

    const toggleSubscribe = async (card: { key: string; label: string; subscribed: boolean }) => {
        if (!overview?.determinatorField) return;
        try {
            await knowledgeApi.setSubscribed(overview.determinatorField, card.key, !card.subscribed);
            showToast({
                type: "success",
                title: card.subscribed ? "Unsubscribed" : "Subscribed",
                message: card.subscribed ? `You will no longer be told about new documents in ${card.label}.` : `You will be notified when a new document is published in ${card.label}.`,
            });
            await loadOverview();
        } catch (error) {
            showToast({ type: "error", title: "Could not update the subscription", message: errorMessage(error, "Please try again.") });
        }
    };

    const toggleFeatured = async (item: KnowledgePortalDocument) => {
        try {
            await knowledgeApi.setFeatured(item.document.id, !item.featured);
            await loadOverview();
        } catch (error) {
            showToast({ type: "error", title: "Could not update Featured", message: errorMessage(error, "Please try again.") });
        }
    };

    const markHelpful = async (item: KnowledgePortalDocument) => {
        try {
            await knowledgeApi.giveFeedback(item.document.id, !item.myFeedback);
            await loadOverview();
        } catch (error) {
            showToast({ type: "error", title: "Could not save feedback", message: errorMessage(error, "Please try again.") });
        }
    };

    const breadcrumbItems = (() => {
        const base = knowledgeBreadcrumb(navigate);
        if (!selection) return base;
        const back = () => setSelection(null);
        const items = base.map((item, idx) => (idx === base.length - 1 ? { ...item, isActive: false, onClick: back } : item));
        const crumbs = browse?.path ?? [];
        return [...items, ...(crumbs.length ? crumbs.map((c, i) => ({
            label: c.label,
            isActive: i === crumbs.length - 1,
            onClick: i === crumbs.length - 1 ? undefined : () => setSelection({ kb: selection.kb, path: selection.path.slice(0, i) }),
        })) : [{ label: selection.kb.label, isActive: true }])];
    })();

    const goUp = () => {
        if (!selection) return;
        if (selection.path.length === 0) setSelection(null);
        else setSelection({ kb: selection.kb, path: selection.path.slice(0, -1) });
    };

    const DocRow: React.FC<{ item: KnowledgePortalDocument; metric?: "views" | "helpful" }> = ({ item, metric }) => (
        <li className="flex items-center gap-2 py-2">
            <button type="button" onClick={() => openPreview(item)} className="min-w-0 flex-1 text-left">
                <p className="truncate text-xs md:text-sm font-medium text-slate-900 hover:text-emerald-700">{item.document.documentName}</p>
                <p className="truncate text-2xs md:text-xs text-slate-500">
                    {item.document.documentNumber}{item.document.department ? ` · ${item.document.department}` : ""}
                    {metric === "views" ? ` · ${item.views} views` : ""}{metric === "helpful" ? ` · ${item.helpfulVotes} found it helpful` : ""}
                </p>
            </button>
            <button type="button" onClick={() => void markHelpful(item)} title={item.myFeedback ? "Remove my helpful vote" : "This was helpful"}
                className={cn("shrink-0 rounded-lg p-1.5 hover:bg-slate-100", item.myFeedback ? "text-emerald-600" : "text-slate-400")}>
                <IconThumbUp size={16} />
            </button>
            {canFeature && (
                <button type="button" onClick={() => void toggleFeatured(item)} title={item.featured ? "Remove from Featured" : "Feature this document"}
                    className={cn("shrink-0 rounded-lg p-1.5 hover:bg-slate-100", item.featured ? "text-amber-500" : "text-slate-400")}>
                    {item.featured ? <IconStarFilled size={16} /> : <IconStar size={16} />}
                </button>
            )}
        </li>
    );

    const Panel: React.FC<{ title: string; items: KnowledgePortalDocument[]; metric?: "views" | "helpful" }> = ({ title, items, metric }) => (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4 md:p-5 min-w-0">
            <h3 className="text-sm md:text-base font-semibold text-slate-900 mb-2">{title}</h3>
            {items.length === 0 ? (
                <p className="text-xs md:text-sm text-slate-500 py-3">No content to display</p>
            ) : (
                <ul className="divide-y divide-slate-100">{items.map((item) => <DocRow key={item.document.id} item={item} metric={metric} />)}</ul>
            )}
        </div>
    );

    if (loading) return <FullPageLoading text="Loading..." />;

    return (
        <div className="space-y-4 md:space-y-6 w-full flex-1 flex flex-col min-h-0">
            <PageHeader
                title={selection ? (browse?.path[browse.path.length - 1]?.label ?? selection.kb.label) : "Knowledge"}
                breadcrumbItems={breadcrumbItems}
                actions={selection ? (
                    <Button onClick={goUp} variant="outline-emerald" size="sm" className="whitespace-nowrap">Back</Button>
                ) : undefined}
            />

            {!selection ? (
                <>
                    <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4 md:p-6 space-y-4">
                        <div className="flex flex-col sm:flex-row gap-4 sm:items-end">
                            <div className="w-full sm:flex-1 min-w-0">
                                <label className="text-xs sm:text-sm font-medium text-slate-700 mb-1.5 block">Search</label>
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                                    <input
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        placeholder="Search documents (minimum 3 characters)"
                                        className="w-full pl-10 pr-10 h-9 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-all placeholder:text-slate-400"
                                    />
                                    {searchQuery && (
                                        <button type="button" onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                                            <X className="h-4 w-4" />
                                        </button>
                                    )}
                                </div>
                            </div>
                            {(overview?.hierarchies.length ?? 0) > 1 && (
                                <div className="w-full sm:w-64">
                                    <Select
                                        label="Hierarchy"
                                        value={overview?.selectedHierarchyId ?? ""}
                                        onChange={(value) => setHierarchyId(String(value))}
                                        options={(overview?.hierarchies ?? []).map((h) => ({ label: h.isDefault ? `${h.name} (default)` : h.name, value: h.id }))}
                                        enableSearch={false}
                                    />
                                </div>
                            )}
                        </div>
                        <div className="flex flex-wrap items-center gap-x-8 gap-y-2 text-sm text-slate-600">
                            <span className="flex items-center gap-2"><IconBook2 size={20} className="text-emerald-600" /><b className="text-slate-900">{overview?.totalKnowledgeBases ?? 0}</b> Knowledge Bases</span>
                            <span className="flex items-center gap-2"><IconFile size={20} className="text-blue-600" /><b className="text-slate-900">{overview?.totalDocuments ?? 0}</b> Documents</span>
                        </div>
                    </div>

                    {searchResults ? (
                        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4 md:p-5">
                            <h3 className="text-sm md:text-base font-semibold text-slate-900 mb-2">Search results ({searchResults.length})</h3>
                            {searchResults.length === 0
                                ? <TableEmptyState title="No documents found" description="Try a different document number or name." />
                                : <ul className="divide-y divide-slate-100">{searchResults.map((item) => <DocRow key={item.document.id} item={item} />)}</ul>}
                        </div>
                    ) : (
                        <>
                            <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4 md:p-5">
                                <h3 className="text-sm md:text-base font-semibold text-slate-900 mb-3">
                                    Explore our Knowledge Bases{overview?.determinatorLabel ? ` (by ${overview.determinatorLabel})` : ""}
                                </h3>
                                {!overview?.selectedHierarchyId ? (
                                    <TableEmptyState title="No hierarchy configured" description="Ask an administrator to create a Knowledge Categories Hierarchy." />
                                ) : overview.knowledgeBases.length === 0 ? (
                                    <TableEmptyState title="No documents yet" description="Effective documents you are allowed to see will appear here." />
                                ) : (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
                                        {overview.knowledgeBases.map((card, index) => (
                                            <div key={card.key} className="border border-slate-200 rounded-xl p-4 flex flex-col items-center gap-2 text-center bg-white shadow-sm">
                                                <button type="button" onClick={() => setSelection({ kb: { key: card.key, label: card.label }, path: [] })} className="flex flex-col items-center gap-2 w-full min-w-0">
                                                    <IconFolderOpen size={38} stroke={1.5} className={KB_COLORS[index % KB_COLORS.length]} />
                                                    <p className="font-semibold text-slate-900 text-sm truncate w-full">{card.label}</p>
                                                    <p className="text-xs text-slate-500 font-medium">{card.documentCount} {card.documentCount === 1 ? "document" : "documents"}</p>
                                                </button>
                                                <Button size="sm" variant={card.subscribed ? "secondary" : "outline"} className="gap-1.5 h-7 text-2xs sm:text-xs px-2.5" onClick={() => void toggleSubscribe(card)}>
                                                    {card.subscribed ? <BellOff className="h-3.5 w-3.5" /> : <Bell className="h-3.5 w-3.5" />}
                                                    {card.subscribed ? "Unsubscribe" : "Subscribe"}
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                                <Panel title="Featured" items={overview?.featured ?? []} />
                                <Panel title="Most Useful" items={overview?.mostUseful ?? []} metric="helpful" />
                                <Panel title="Most Viewed" items={overview?.mostViewed ?? []} metric="views" />
                            </div>
                        </>
                    )}
                </>
            ) : browseLoading || !browse ? (
                <div className="flex-1 min-h-0"><FullPageLoading text="Loading..." /></div>
            ) : browse.nextFieldLabel ? (
                <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4 md:p-5">
                    <h3 className="text-sm md:text-base font-semibold text-slate-900 mb-3">{browse.nextFieldLabel}</h3>
                    {browse.folders.length === 0 ? (
                        <TableEmptyState title="No documents" description="There are no documents in this folder." />
                    ) : (
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4">
                            {browse.folders.map((folder, index) => (
                                <button
                                    key={folder.key}
                                    type="button"
                                    onClick={() => setSelection({ kb: selection.kb, path: [...selection.path, folder.key] })}
                                    className="bg-white border border-slate-200 rounded-xl p-3 hover:bg-slate-50 transition-colors text-left flex flex-col items-center gap-2"
                                >
                                    <IconFolderOpen size={34} stroke={1.5} className={KB_COLORS[index % KB_COLORS.length]} />
                                    <p className="font-semibold text-slate-900 text-xs md:text-sm truncate w-full text-center">{folder.label}</p>
                                    <p className="text-2xs md:text-xs font-medium text-slate-500">{folder.documentCount} {folder.documentCount === 1 ? "document" : "documents"}</p>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            ) : (
                <div className="flex-1 min-h-0">
                    <FolderDocumentsList
                        departmentName={browse.path[browse.path.length - 1]?.label ?? selection.kb.label}
                        documents={browse.documents.map((item) => ({
                            id: item.document.id,
                            name: item.document.documentName,
                            documentNumber: item.document.documentNumber || "",
                            revisionNumber: item.document.revisionNumber || "",
                            fileType: item.document.documentType || "Document",
                            lastOpened: item.document.effectiveDate || item.document.created || "",
                            fileSize: "N/A",
                        }))}
                        onBack={goUp}
                        onOpenDocument={(id) => void knowledgeApi.recordView(id).catch(() => undefined)}
                    />
                </div>
            )}
        </div>
    );
};
