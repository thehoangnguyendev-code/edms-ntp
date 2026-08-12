import React, { useState, useEffect, useMemo } from "react";
import { useLocation } from "react-router-dom";
import { Search } from "lucide-react";
import { StatusBadge } from "@/components/ui";
import { FullPageLoading } from "@/components/ui/loading/Loading";
import { useDebounce, useNavigateWithLoading } from "@/hooks";
import { documentApi } from "@/services/api/documents";
import { buildRevisionDetailSnapshotState } from "@/features/documents/shared/detailSnapshotHelpers";
import { Revision } from "./types";
import { mapRevisionSummaryFromApi } from "@/features/documents/shared/statusMapping";
import { ROUTES } from "@/app/routes.constants";
import { type WorkspaceNavigationMode } from "@/features/documents/shared/navigationContext";

interface DocumentRevisionsTabProps {
    revisions?: Revision[];
    navigationMode?: Extract<WorkspaceNavigationMode, "create" | "edit">;
    onCountChange?: (count: number) => void;
    documentAuthor?: string;
    documentStatus?: string;
    documentCreated?: string;
    revisionFile?: File | null;
    formData?: any;
    reviewers?: any[];
    approvers?: any[];
    documentNumber?: string;
    relationshipDocs?: any[];
    correlatedDocuments?: any[];
}

export const DocumentRevisionsTab: React.FC<DocumentRevisionsTabProps> = ({
    revisions = [],
    onCountChange,
    documentAuthor = "",
    documentStatus = "Draft",
    documentCreated = "",
    revisionFile = null,
    formData = null,
    reviewers = [],
    approvers = [],
    documentNumber = "",
    relationshipDocs = [],
    correlatedDocuments = []
}) => {
  const location = useLocation();
  const { navigateTo, navigateToPrepared } = useNavigateWithLoading();
  const [searchQuery, setSearchQuery] = useState("");
    const [displayRevisions, setDisplayRevisions] = useState<Revision[]>(revisions);
    const [isSearching, setIsSearching] = useState(false);
    const debouncedSearch = useDebounce(searchQuery, 300);

    const revisionIds = useMemo(
        () => revisions.map((revision) => revision.id).filter(Boolean).join(","),
        [revisions],
    );

    useEffect(() => {
        setDisplayRevisions(revisions);
    }, [revisions]);

    useEffect(() => {
        let cancelled = false;

        const fetchFilteredRevisions = async () => {
            const query = debouncedSearch.trim();
            if (!query) {
                setDisplayRevisions(revisions);
                return;
            }

            if (!revisionIds) {
                setDisplayRevisions([]);
                return;
            }

            setIsSearching(true);
            try {
                const response = await documentApi.getRevisions({
                    ids: revisionIds,
                    search: query,
                    page: 1,
                    limit: Math.max(revisions.length, 1),
                    sortBy: "created",
                    sortDirection: "desc",
                });

                if (cancelled) return;

                const mapped = (response.data ?? []).map((item) => {
                    const mappedItem = mapRevisionSummaryFromApi(item);
                    return {
                        id: mappedItem.id,
                        revisionNumber: mappedItem.revisionNumber,
                        created: mappedItem.created,
                        openedBy: mappedItem.openedBy || "",
                        revisionName: mappedItem.revisionName,
                        status: mappedItem.status as Revision["status"],
                        statusLabel: item.statusInfo?.name || item.status || mappedItem.statusLabel,
                        canOpenAuthoringWorkspace: Boolean(item.canOpenAuthoringWorkspace),
                    };
                });

                const parseVersion = (v: string) => {
                    if (!v) return { major: 0, patch: 0 };
                    const parts = v.split('.');
                    return {
                        major: parseInt(parts[0]) || 0,
                        patch: parseInt(parts[2] || parts[1]) || 0,
                    };
                };

                mapped.sort((a, b) => {
                    const va = parseVersion(a.revisionNumber);
                    const vb = parseVersion(b.revisionNumber);
                    if (va.major !== vb.major) return vb.major - va.major;
                    return vb.patch - va.patch;
                });

                setDisplayRevisions(mapped);
            } catch (error) {
                if (import.meta.env.DEV) {
                    console.error("Failed to search revisions", error);
                }
                if (!cancelled) {
                    setDisplayRevisions([]);
                }
            } finally {
                if (!cancelled) {
                    setIsSearching(false);
                }
            }
        };

        void fetchFilteredRevisions();
        return () => {
            cancelled = true;
        };
    }, [debouncedSearch, revisionIds, revisions]);

    // Update counter when revisions change
    useEffect(() => {
        onCountChange?.(displayRevisions?.length || 0);
    }, [displayRevisions, onCountChange]);

    const handleRevisionClick = (revision: Revision) => {
        // Build source document payload for revision workspace.
        const sourceDocument = {
            documentNumber: documentNumber || "N/A",
            title: formData?.title || "",
            version: revision.revisionNumber,
            type: formData?.type || "",
            author: formData?.author || documentAuthor,
            coAuthors: formData?.coAuthors || [],
            businessUnit: formData?.businessUnit || "",
            department: formData?.department || "",
            knowledgeBase: formData?.knowledgeBase || "",
            subType: formData?.subType || "",
            periodicReviewCycle: formData?.periodicReviewCycle || 0,
            periodicReviewNotification: formData?.periodicReviewNotification || 0,
            language: formData?.language || "English",
            reviewDate: formData?.reviewDate || "",
            description: formData?.description || "",
            isTemplate: formData?.isTemplate || false,
            titleLocalLanguage: formData?.titleLocalLanguage || "",
        };

        // A Draft revision is the authoring workspace.  The route carries the
        // exact revision id, so it must never resolve the latest revision of
        // the parent document.  All non-Draft history rows remain read-only.
        const canOpenAuthoringWorkspace = Boolean(revision.canOpenAuthoringWorkspace);
        const route = canOpenAuthoringWorkspace
            ? ROUTES.DOCUMENTS.REVISIONS.EDIT(revision.id)
            : ROUTES.DOCUMENTS.REVISIONS.DETAIL(revision.id);
        const routeState = {
            from: location.pathname,
            returnTo: location.pathname,
            sourceDocument,
            revisionReviewers: reviewers,
            revisionApprovers: approvers,
            newDocumentData: {
                activeTab: "general",
                formData,
                status: documentStatus,
                isSaved: true,
                isRevisionUploaded: Boolean(revisionFile),
                revisionFile,
                revisions,
                documentNumber,
                revisionNumber: revision.revisionNumber,
                createdDateTime: documentCreated,
                reviewers,
                approvers,
                relationshipDocs,
                correlatedDocuments,
            },
            isStandalone: true,
            revisionId: revision.id,
            revisionCreated: revision.created,
            revisionOpenedBy: revision.openedBy,
            revisionState: revision.status.toLowerCase().replace(/ /g, ""),
            documentAuthor: formData?.author || documentAuthor,
            documentStatus,
            documentCreated,
            revisionFile,
            documentRevisions: revisions,
            documentNumber,
            relationshipDocs,
            correlatedDocuments,
        };

        if (canOpenAuthoringWorkspace) {
            navigateTo(route, { state: routeState });
            return;
        }

        void navigateToPrepared(
            route,
            async () => ({
                ...buildRevisionDetailSnapshotState(await documentApi.getRevisionByIdSnapshot(revision.id)),
            }),
            { state: routeState },
        ).catch((error) => {
            console.error("Failed to preload revision detail from document workspace", error);
            navigateTo(route, { state: routeState });
        });
    };

    return (
        <div className="space-y-4">
            {/* Search Bar */}
            <div className="flex items-center gap-2">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Search by revision number, name, or author..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full h-9 pl-10 pr-10 border border-slate-200 rounded-lg text-sm placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
                    />
                </div>
            </div>

            {/* Table */}
            <div className="border rounded-xl bg-white shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-slate-50 border-b border-slate-200">
                            <tr>
                                <th className="py-2.5 px-2 sm:py-3.5 sm:px-4 text-center text-2xs md:text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap w-10 sm:w-16">
                                    No.
                                </th>
                                <th className="py-2.5 px-2 sm:py-3.5 sm:px-4 text-left text-2xs md:text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                                    Revision Number
                                </th>
                                <th className="py-2.5 px-2 sm:py-3.5 sm:px-4 text-left text-2xs md:text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap hidden md:table-cell">
                                    Created
                                </th>
                                <th className="py-2.5 px-2 sm:py-3.5 sm:px-4 text-left text-2xs md:text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap hidden md:table-cell">
                                    Opened by
                                </th>
                                <th className="py-2.5 px-2 sm:py-3.5 sm:px-4 text-left text-2xs md:text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                                    Revision Name
                                </th>
                                <th className="py-2.5 px-2 sm:py-3.5 sm:px-4 text-left text-2xs md:text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                                    Status
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 bg-white">
                            {isSearching ? (
                                <tr>
                                    <td colSpan={6} className="py-12">
                                        <FullPageLoading text="Searching revisions..." />
                                    </td>
                                </tr>
                            ) : displayRevisions.length > 0 ? (
                                displayRevisions.map((revision, index) => (
                                    <tr
                                        key={revision.id}
                                        className="hover:bg-slate-50/80 transition-colors"
                                    >
                                        <td className="py-2 px-2 sm:py-3.5 sm:px-4 text-xs sm:text-sm text-center text-slate-500 font-medium whitespace-nowrap">
                                            {index + 1}
                                        </td>
                                        <td className="py-2 px-2 sm:py-3.5 sm:px-4 text-xs sm:text-sm whitespace-nowrap">
                                            <button
                                                onClick={() => handleRevisionClick(revision)}
                                                className="font-medium text-emerald-600 hover:text-emerald-700 hover:underline underline-offset-2 transition-colors cursor-pointer"
                                            >
                                                {revision.revisionNumber}
                                            </button>
                                        </td>
                                        <td className="py-2 px-2 sm:py-3.5 sm:px-4 text-xs sm:text-sm text-slate-600 whitespace-nowrap hidden md:table-cell">
                                            {revision.created}
                                        </td>
                                        <td className="py-2 px-2 sm:py-3.5 sm:px-4 text-xs sm:text-sm text-slate-600 whitespace-nowrap hidden md:table-cell">
                                            {revision.openedBy}
                                        </td>
                                        <td className="py-2 px-2 sm:py-3.5 sm:px-4 text-xs sm:text-sm text-slate-900 whitespace-nowrap">
                                            {revision.revisionName || revision.revisionNumber}
                                        </td>
                                        <td className="py-2 px-2 sm:py-3.5 sm:px-4 text-xs sm:text-sm whitespace-nowrap">
                                            <StatusBadge status={revision.status as any} label={revision.statusLabel} />
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={6} className="py-12 text-center">
                                        <div className="flex flex-col items-center justify-center gap-2.5">
                                            <div className="h-10 w-10 rounded-full bg-slate-50 flex items-center justify-center">
                                                <Search className="h-5 w-5 text-slate-300" />
                                            </div>
                                            <p className="text-sm font-medium text-slate-500">
                                                {searchQuery
                                                    ? "No records matching your search"
                                                    : "No records to display"}
                                            </p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
