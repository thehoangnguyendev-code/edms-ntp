import React, { useState, useMemo, useEffect } from "react";
import {
  FileText,
  Check,
  Search,
  ChevronRight,
  ChevronLeft,
} from "lucide-react";
import { FormModal } from "@/components/ui/modal/FormModal";
import { cn } from "@/components/ui/utils";
import { StatusBadge, type StatusType } from "@/components/ui/badge/Badge";
import { documentApi } from "@/services/api/documents";
import type { DocumentListItem } from "@/features/documents/document-list/types";
import { ParentDocument, RelatedDocument } from "../types";

const mapDocumentListItemToRelation = (item: DocumentListItem): RelatedDocument => ({
  id: item.id,
  documentNumber: item.documentNumber || "",
  created: item.created || "",
  openedBy: item.openedBy || "",
  documentName: item.documentName || "",
  displayLabel: [item.documentNumber, item.documentName].filter(Boolean).join(" - "),
  status: item.status || "",
  revisionNumber: item.version || item.revisionNumber || "",
  version: item.version || item.revisionNumber || "",
  type: item.type,
  department: item.department || "",
  authorCoAuthor: item.author || "",
  effectiveDate: item.effectiveDate || "",
  validUntil: item.validUntil || "",
});

interface DocumentRelationshipsProps {
  currentDocumentId?: string | null;
  correlatedDocuments: ParentDocument[];
  onCorrelatedDocumentsChange: (docs: ParentDocument[]) => void;
  relatedDocuments: RelatedDocument[];
  onRelatedDocumentsChange: (docs: RelatedDocument[]) => void;
  documentType?: string;
  onSuggestedCodeChange?: (code: string) => void;
  isRelatedModalOpen?: boolean;
  onRelatedModalClose?: () => void;
  isCorrelatedModalOpen?: boolean;
  onCorrelatedModalClose?: () => void;
}

export const DocumentRelationships: React.FC<DocumentRelationshipsProps> = ({
  currentDocumentId,
  correlatedDocuments,
  onCorrelatedDocumentsChange,
  relatedDocuments,
  onRelatedDocumentsChange,
  documentType,
  onSuggestedCodeChange,
  isRelatedModalOpen: externalRelatedModalOpen,
  onRelatedModalClose: externalRelatedModalClose,
  isCorrelatedModalOpen: externalCorrelatedModalOpen,
  onCorrelatedModalClose: externalCorrelatedModalClose,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSearchQuery, setSelectedSearchQuery] = useState("");
  const [correlatedSearchQuery, setCorrelatedSearchQuery] = useState("");
  const [selectedCorrelatedSearchQuery, setSelectedCorrelatedSearchQuery] = useState("");
  const [selectedAvailableIds, setSelectedAvailableIds] = useState<string[]>([]);
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
  const [selectedAvailableCorrelatedIds, setSelectedAvailableCorrelatedIds] = useState<string[]>([]);
  const [selectedCorrelatedDocIds, setSelectedCorrelatedDocIds] = useState<string[]>([]);
  const [relatedAvailableRemoteDocs, setRelatedAvailableRemoteDocs] = useState<RelatedDocument[] | null>(null);
  const [relatedSelectedRemoteDocs, setRelatedSelectedRemoteDocs] = useState<RelatedDocument[] | null>(null);
  const [correlatedAvailableRemoteDocs, setCorrelatedAvailableRemoteDocs] = useState<ParentDocument[] | null>(null);
  const [correlatedSelectedRemoteDocs, setCorrelatedSelectedRemoteDocs] = useState<ParentDocument[] | null>(null);
  const [isRelatedLoading, setIsRelatedLoading] = useState(false);
  const [isCorrelatedLoading, setIsCorrelatedLoading] = useState(false);

  // State for focused document preview
  const [focusedRelatedId, setFocusedRelatedId] = useState<string | null>(null);
  const [focusedCorrelatedId, setFocusedCorrelatedId] = useState<string | null>(null);

  const [internalParentModalOpen, setInternalParentModalOpen] = useState(false);
  const [internalRelatedModalOpen, setInternalRelatedModalOpen] = useState(false);

  // Temporary state for modal editing
  const [tempCorrelatedDocuments, setTempCorrelatedDocuments] = useState<ParentDocument[]>([]);
  const [tempRelatedDocuments, setTempRelatedDocuments] = useState<RelatedDocument[]>([]);

  // Use external state if provided, otherwise use internal state
  const isParentModalOpen = externalCorrelatedModalOpen !== undefined ? externalCorrelatedModalOpen : internalParentModalOpen;
  const setIsParentModalOpen = externalCorrelatedModalClose || setInternalParentModalOpen;
  const isRelatedModalOpen = externalRelatedModalOpen !== undefined ? externalRelatedModalOpen : internalRelatedModalOpen;
  const setIsRelatedModalOpen = externalRelatedModalClose || setInternalRelatedModalOpen;

  // Initialize temp state when modal opens
  React.useEffect(() => {
    if (isParentModalOpen) {
      setTempCorrelatedDocuments(correlatedDocuments);
      setCorrelatedSearchQuery("");
      setSelectedCorrelatedSearchQuery("");
      setSelectedAvailableCorrelatedIds([]);
      setSelectedCorrelatedDocIds([]);
      setFocusedCorrelatedId(null);
      setCorrelatedAvailableRemoteDocs(null);
      setCorrelatedSelectedRemoteDocs(null);
      setIsCorrelatedLoading(false);
    }
  }, [isParentModalOpen, correlatedDocuments]);

  React.useEffect(() => {
    if (isRelatedModalOpen) {
      setTempRelatedDocuments(relatedDocuments);
      setSearchQuery("");
      setSelectedSearchQuery("");
      setSelectedAvailableIds([]);
      setSelectedDocIds([]);
      setFocusedRelatedId(null);
      setRelatedAvailableRemoteDocs(null);
      setRelatedSelectedRemoteDocs(null);
      setIsRelatedLoading(false);
    }
  }, [isRelatedModalOpen, relatedDocuments]);

  useEffect(() => {
    if (!isRelatedModalOpen) {
      return;
    }

    const timer = window.setTimeout(async () => {
      const query = searchQuery.trim();
      setIsRelatedLoading(true);
      try {
        const response = await documentApi.getDocumentsPage({
          search: query || undefined,
          status: "DRAFT,ACTIVE",
          page: 1,
          limit: 50,
          sortBy: "created",
          sortDirection: "desc",
        });
        const documentItems = (response.data || []).map(mapDocumentListItemToRelation);
        const excludedIds = new Set([
          currentDocumentId,
          ...tempCorrelatedDocuments.map((doc) => doc.id),
          ...tempRelatedDocuments.map((doc) => doc.id),
        ].filter(Boolean));
        setRelatedAvailableRemoteDocs(
          documentItems.filter((doc) => !excludedIds.has(doc.id)),
        );
      } catch (error) {
        console.error("Failed to search related available documents", error);
        setRelatedAvailableRemoteDocs([]);
      } finally {
        setIsRelatedLoading(false);
      }
    }, 300);

    return () => window.clearTimeout(timer);
  }, [isRelatedModalOpen, searchQuery, tempCorrelatedDocuments, tempRelatedDocuments, currentDocumentId]);

  useEffect(() => {
    if (!isRelatedModalOpen) {
      return;
    }

    const timer = window.setTimeout(async () => {
      const query = selectedSearchQuery.trim();
      if (!query) {
        setRelatedSelectedRemoteDocs(null);
        return;
      }

      try {
        const response = await documentApi.getDocumentsPage({
          search: query,
          ids: tempRelatedDocuments.map((doc) => doc.id).join(","),
          status: "DRAFT,ACTIVE",
          page: 1,
          limit: 50,
          sortBy: "created",
          sortDirection: "desc",
        });
        setRelatedSelectedRemoteDocs(
          (response.data || []).map(mapDocumentListItemToRelation),
        );
      } catch (error) {
        console.error("Failed to search related selected documents", error);
        setRelatedSelectedRemoteDocs([]);
      }
    }, 300);

    return () => window.clearTimeout(timer);
  }, [isRelatedModalOpen, selectedSearchQuery, tempRelatedDocuments]);

  useEffect(() => {
    if (!isParentModalOpen) {
      return;
    }

    const timer = window.setTimeout(async () => {
      const query = correlatedSearchQuery.trim();
      setIsCorrelatedLoading(true);
      try {
        const response = await documentApi.getDocumentsPage({
          search: query || undefined,
          status: "DRAFT,ACTIVE",
          page: 1,
          limit: 50,
          sortBy: "created",
          sortDirection: "desc",
        });
        const documentItems = (response.data || []).map(mapDocumentListItemToRelation);
        const excludedIds = new Set([
          currentDocumentId,
          ...tempCorrelatedDocuments.map((doc) => doc.id),
          ...tempRelatedDocuments.map((doc) => doc.id),
        ].filter(Boolean));
        setCorrelatedAvailableRemoteDocs(
          documentItems.filter((doc) => !excludedIds.has(doc.id)),
        );
      } catch (error) {
        console.error("Failed to search correlated available documents", error);
        setCorrelatedAvailableRemoteDocs([]);
      } finally {
        setIsCorrelatedLoading(false);
      }
    }, 300);

    return () => window.clearTimeout(timer);
  }, [isParentModalOpen, correlatedSearchQuery, tempCorrelatedDocuments, tempRelatedDocuments, currentDocumentId]);

  useEffect(() => {
    if (!isParentModalOpen) {
      return;
    }

    const timer = window.setTimeout(async () => {
      const query = selectedCorrelatedSearchQuery.trim();
      if (!query) {
        setCorrelatedSelectedRemoteDocs(null);
        return;
      }

      try {
        const response = await documentApi.getDocumentsPage({
          search: query,
          ids: tempCorrelatedDocuments.map((doc) => doc.id).join(","),
          status: "DRAFT,ACTIVE",
          page: 1,
          limit: 50,
          sortBy: "created",
          sortDirection: "desc",
        });
        setCorrelatedSelectedRemoteDocs(
          (response.data || [])
            .map(mapDocumentListItemToRelation) as ParentDocument[],
        );
      } catch (error) {
        console.error("Failed to search correlated selected documents", error);
        setCorrelatedSelectedRemoteDocs([]);
      }
    }, 300);

    return () => window.clearTimeout(timer);
  }, [isParentModalOpen, selectedCorrelatedSearchQuery, tempCorrelatedDocuments]);

  // Available parent documents for Related modal.
  const availableDocuments = useMemo(() => {
    const excludedIds = [
      currentDocumentId,
      ...tempCorrelatedDocuments.map((d) => d.id),
      ...tempRelatedDocuments.map((d) => d.id),
    ].filter(Boolean) as string[];

    return (relatedAvailableRemoteDocs ?? []).filter((doc) => !excludedIds.includes(doc.id));
  }, [relatedAvailableRemoteDocs, tempCorrelatedDocuments, tempRelatedDocuments, currentDocumentId]);

  // Available parent documents for Correlated modal.
  const availableCorrelatedDocs = useMemo(() => {
    const excludedIds = [
      currentDocumentId,
      ...tempCorrelatedDocuments.map((d) => d.id),
      ...tempRelatedDocuments.map((d) => d.id),
    ].filter(Boolean) as string[];

    return (correlatedAvailableRemoteDocs ?? []).filter((doc) => !excludedIds.includes(doc.id));
  }, [correlatedAvailableRemoteDocs, tempCorrelatedDocuments, tempRelatedDocuments, currentDocumentId]);

  // Displayed lists
  const filteredAvailableDocs = availableDocuments;

  const filteredAvailableCorrelatedDocs = availableCorrelatedDocs;

  const filteredSelectedCorrelatedDocs = selectedCorrelatedSearchQuery.trim()
    ? (correlatedSelectedRemoteDocs ?? [])
    : tempCorrelatedDocuments;

  const filteredSelectedRelatedDocs = selectedSearchQuery.trim()
    ? (relatedSelectedRemoteDocs ?? [])
    : tempRelatedDocuments;

  // --- Actions for Related Modal ---
  const handleToggleAvailable = (id: string) => {
    setSelectedAvailableIds((prev) => (prev.includes(id) ? [] : [id]));
    setFocusedRelatedId((prev) => (prev === id ? null : id));
  };

  const handleToggleSelected = (id: string) => {
    setSelectedDocIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
    setFocusedRelatedId(id);
  };

  const handleMoveToSelected = () => {
    const docsToAdd = availableDocuments.filter((doc) =>
      selectedAvailableIds.includes(doc.id),
    );
    const newRelatedDocs: RelatedDocument[] = docsToAdd.map((doc: any) => ({
      id: doc.id,
      documentNumber: doc.documentNumber || "",
      created: doc.created || "",
      openedBy: doc.openedBy || "",
      documentName: doc.documentName,
      status: doc.status || "",
      revisionNumber: doc.revisionNumber || "",
      type: doc.type,
      department: doc.department || "",
      authorCoAuthor: doc.author || doc.authorCoAuthor || "",
      effectiveDate: doc.effectiveDate || "",
      validUntil: doc.validUntil || ""
    }));
    setTempRelatedDocuments([...tempRelatedDocuments, ...newRelatedDocs]);
    setSelectedAvailableIds([]);
  };

  const handleMoveToAvailable = () => {
    setTempRelatedDocuments(
      tempRelatedDocuments.filter((doc) => !selectedDocIds.includes(doc.id)),
    );
    setSelectedDocIds([]);
  };

  const handleDoubleClickAvailable = (id: string) => {
    const doc = availableDocuments.find((d) => d.id === id) as any;
    if (doc) {
      setTempRelatedDocuments([
        ...tempRelatedDocuments,
        {
          id: doc.id,
          documentNumber: doc.documentNumber || "",
          created: doc.created || "",
          openedBy: doc.openedBy || "",
          documentName: doc.documentName,
          status: doc.status || "",
          revisionNumber: doc.revisionNumber || "",
          type: doc.type,
          department: doc.department || "",
          authorCoAuthor: doc.author || doc.authorCoAuthor || "",
          effectiveDate: doc.effectiveDate || "",
          validUntil: doc.validUntil || ""
        },
      ]);
    }
  };

  const handleDoubleClickSelected = (id: string) => {
    setTempRelatedDocuments(tempRelatedDocuments.filter((doc) => doc.id !== id));
  };

  // --- Drag and Drop Handlers for Related Modal ---
  const handleDragStart = (e: React.DragEvent, id: string, source: "available" | "selected") => {
    e.dataTransfer.setData("docId", id);
    e.dataTransfer.setData("source", source);
    e.dataTransfer.effectAllowed = "move";

    // Add a ghost image or style if needed, but default is fine
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = "0.5";
    }
  };

  const handleDragEnd = (e: React.DragEvent) => {
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = "1";
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDropToSelected = (e: React.DragEvent) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("docId");
    const source = e.dataTransfer.getData("source");

    if (source === "available") {
      const doc = availableDocuments.find((d) => d.id === id) as any;
      if (doc) {
        const newRelatedDoc: RelatedDocument = {
          id: doc.id,
          documentNumber: doc.documentNumber || "",
          created: doc.created || "",
          openedBy: doc.openedBy || "",
          documentName: doc.documentName,
          status: doc.status || "",
          revisionNumber: doc.revisionNumber || "",
          type: doc.type,
          department: doc.department || "",
          authorCoAuthor: doc.author || doc.authorCoAuthor || "",
          effectiveDate: doc.effectiveDate || "",
          validUntil: doc.validUntil || ""
        };
        setTempRelatedDocuments((prev) => [...prev, newRelatedDoc]);
      }
    }
  };

  const handleDropToAvailable = (e: React.DragEvent) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("docId");
    const source = e.dataTransfer.getData("source");

    if (source === "selected") {
      setTempRelatedDocuments((prev) => prev.filter((doc) => doc.id !== id));
    }
  };

  // --- Drag and Drop Handlers for Correlated Modal ---
  const handleDragStartCorrelated = (e: React.DragEvent, id: string, source: "available" | "selected") => {
    e.dataTransfer.setData("docId", id);
    e.dataTransfer.setData("source", source);
    e.dataTransfer.effectAllowed = "move";
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = "0.5";
    }
  };

  const handleDropToSelectedCorrelated = (e: React.DragEvent) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("docId");
    const source = e.dataTransfer.getData("source");

    if (source === "available") {
      const doc = availableCorrelatedDocs.find((d) => d.id === id) as any;
      if (doc) {
        const newCorrelatedDoc: ParentDocument = {
          id: doc.id,
          documentNumber: doc.documentNumber || "",
          created: doc.created || "",
          openedBy: doc.openedBy || "",
          documentName: doc.documentName,
          status: doc.status || "",
          revisionNumber: doc.revisionNumber || "",
          type: doc.type,
          department: doc.department || "",
          authorCoAuthor: doc.author || doc.authorCoAuthor || "",
          effectiveDate: doc.effectiveDate || "",
          validUntil: doc.validUntil || ""
        };
        setTempCorrelatedDocuments((prev) => [...prev, newCorrelatedDoc]);
      }
    }
  };

  const handleDropToAvailableCorrelated = (e: React.DragEvent) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("docId");
    const source = e.dataTransfer.getData("source");

    if (source === "selected") {
      setTempCorrelatedDocuments((prev) => prev.filter((doc) => doc.id !== id));
    }
  };

  const handleSaveRelated = () => {
    onRelatedDocumentsChange(tempRelatedDocuments);
    typeof setIsRelatedModalOpen === "function" && setIsRelatedModalOpen(false);
  };

  const handleCancelRelated = () => {
    setTempRelatedDocuments(relatedDocuments);
    typeof setIsRelatedModalOpen === "function" && setIsRelatedModalOpen(false);
  };

  // --- Actions for Correlated Modal ---
  const handleToggleAvailableCorrelated = (id: string) => {
    setSelectedAvailableCorrelatedIds((prev) => (prev.includes(id) ? [] : [id]));
    setFocusedCorrelatedId((prev) => (prev === id ? null : id));
  };

  const handleToggleSelectedCorrelated = (id: string) => {
    setSelectedCorrelatedDocIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
    setFocusedCorrelatedId(id);
  };

  const handleMoveToSelectedCorrelated = () => {
    const docsToAdd = availableCorrelatedDocs.filter((doc) =>
      selectedAvailableCorrelatedIds.includes(doc.id),
    );
    const newCorrelatedDocs: ParentDocument[] = docsToAdd.map((doc: any) => ({
      id: doc.id,
      documentNumber: doc.documentNumber || "",
      created: doc.created || "",
      openedBy: doc.openedBy || "",
      documentName: doc.documentName,
      status: doc.status || "",
      revisionNumber: doc.revisionNumber || "",
      type: doc.type,
      department: doc.department || "",
      authorCoAuthor: doc.author || doc.authorCoAuthor || "",
      effectiveDate: doc.effectiveDate || "",
      validUntil: doc.validUntil || ""
    }));
    setTempCorrelatedDocuments([...tempCorrelatedDocuments, ...newCorrelatedDocs]);
    setSelectedAvailableCorrelatedIds([]);
  };

  const handleMoveToAvailableCorrelated = () => {
    setTempCorrelatedDocuments(
      tempCorrelatedDocuments.filter((doc) => !selectedCorrelatedDocIds.includes(doc.id)),
    );
    setSelectedCorrelatedDocIds([]);
  };

  const handleDoubleClickAvailableCorrelated = (id: string) => {
    const doc = availableCorrelatedDocs.find((d) => d.id === id) as any;
    if (doc) {
      setTempCorrelatedDocuments([
        ...tempCorrelatedDocuments,
        {
          id: doc.id,
          documentNumber: doc.documentNumber || "",
          created: doc.created || "",
          openedBy: doc.openedBy || "",
          documentName: doc.documentName,
          status: doc.status || "",
          revisionNumber: doc.revisionNumber || "",
          type: doc.type,
          department: doc.department || "",
          authorCoAuthor: doc.author || doc.authorCoAuthor || "",
          effectiveDate: doc.effectiveDate || "",
          validUntil: doc.validUntil || ""
        },
      ]);
    }
  };

  const handleDoubleClickSelectedCorrelated = (id: string) => {
    setTempCorrelatedDocuments(tempCorrelatedDocuments.filter((doc) => doc.id !== id));
  };

  const handleSaveCorrelated = () => {
    onCorrelatedDocumentsChange(tempCorrelatedDocuments);
    typeof setIsParentModalOpen === "function" && setIsParentModalOpen(false);
  };

  const handleCancelCorrelated = () => {
    setTempCorrelatedDocuments(correlatedDocuments);
    typeof setIsParentModalOpen === "function" && setIsParentModalOpen(false);
  };

  // Helper component for Document Preview
  const DocumentPreviewPanel = ({ docId }: { docId: string | null }) => {
    if (!docId) return (
      <div className="mt-6 p-4 border border-dashed border-slate-200 rounded-xl bg-slate-50/50 flex flex-col items-center justify-center text-slate-400">
        <p className="text-xs">Click a document to view details</p>
      </div>
    );

    const doc =
      (tempRelatedDocuments.find((d) => d.id === docId) ||
        tempCorrelatedDocuments.find((d) => d.id === docId) ||
        availableDocuments.find((d) => d.id === docId) ||
        availableCorrelatedDocs.find((d) => d.id === docId)) as any;
    if (!doc) return null;

    const infoItems = [
      { label: "Document Number", value: doc.documentNumber || "N/A" },
      { label: "Created", value: doc.created || "N/A" },
      { label: "Opened by", value: doc.openedBy || "N/A" },
      { label: "Document Name", value: doc.documentName, fullWidth: true },
      { label: "State", value: <StatusBadge status={(doc.status?.toLowerCase() as any) || 'draft'} size="xs" /> },
      { label: "Document Type", value: doc.type },
      { label: "Department", value: doc.department || "N/A" },
      { label: "Author", value: doc.author || doc.authorCoAuthor || "N/A" },
      { label: "Effective Date", value: doc.effectiveDate || "N/A" },
      { label: "Valid Until", value: doc.validUntil || "N/A" },
    ];

    return (
      <div className="mt-6 p-5 border border-slate-200 rounded-xl bg-white shadow-sm animate-in fade-in slide-in-from-bottom-2 duration-300">
        <div className="space-y-1.5">
          {infoItems.map((item, idx) => (
            <div key={idx} className="grid grid-cols-[160px_1fr] gap-4 items-baseline border-b border-slate-50 pb-1.5 last:border-0 last:pb-0">
              <span className="text-[11px] font-semibold text-slate-500 tracking-tight">
                {item.label}
              </span>
              <div className="text-[11px] font-medium text-slate-900 break-words line-clamp-2">
                {item.value}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Correlated Documents Modal */}
      <FormModal
        isOpen={isParentModalOpen}
        onClose={handleCancelCorrelated}
        title="Select Correlated Documents"
        description="Link peer-level documents (e.g., Procurement SOP ↔ Inventory Control SOP)"
        size="2xl"
        className="max-w-[95%] sm:max-w-3xl"
        showCancel={true}
        cancelText="Cancel"
        confirmText="Save"
        onConfirm={handleSaveCorrelated}
      >
        <div className="flex flex-col h-full">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr] gap-2 lg:gap-6">
            {/* Available Documents */}
            <div className="flex flex-col min-w-0">
              <h3 className="text-xs sm:text-sm font-semibold text-slate-900 mb-2 sm:mb-3">Available Documents</h3>
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  value={correlatedSearchQuery}
                  onChange={(e) => setCorrelatedSearchQuery(e.target.value)}
                  placeholder="Search by Document Number or Title..."
                  className="w-full h-9 pl-9 pr-3 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-all shadow-sm"
                />
              </div>
              <div
                onDragOver={handleDragOver}
                onDrop={handleDropToAvailableCorrelated}
                className="border border-slate-200 rounded-lg bg-slate-50/50 flex-1 min-h-[100px] sm:min-h-[180px] max-h-[160px] sm:max-h-[240px] overflow-y-auto custom-scrollbar"
              >
                {isCorrelatedLoading ? (
                  <div className="flex flex-col items-center justify-center h-full text-sm text-slate-400 py-10">
                    <FileText className="h-8 w-8 mb-2 opacity-10 animate-pulse" />
                    Loading documents...
                  </div>
                ) : filteredAvailableCorrelatedDocs.length > 0 ? (
                  <div className="divide-y divide-slate-100">
                    {filteredAvailableCorrelatedDocs.map((doc) => (
                      <div
                        key={doc.id}
                        draggable={true}
                        onDragStart={(e) => handleDragStartCorrelated(e, doc.id, "available")}
                        onDragEnd={handleDragEnd}
                        onClick={() => handleToggleAvailableCorrelated(doc.id)}
                        onDoubleClick={() => handleDoubleClickAvailableCorrelated(doc.id)}
                        className={cn(
                          "px-3 py-2.5 cursor-pointer transition-all text-[11px] hover:bg-emerald-50/50 flex items-start justify-between gap-3",
                          (selectedAvailableCorrelatedIds.includes(doc.id) || focusedCorrelatedId === doc.id) &&
                          "bg-emerald-50/80 font-medium"
                        )}
                      >
                        <span className="font-medium text-slate-900 break-words leading-relaxed min-w-0 flex-1">
                          <span className="text-emerald-600">{doc.documentNumber || "N/A"}</span>
                          {" - "}
                          {doc.documentName}
                        </span>
                        <StatusBadge
                          status={(doc.status?.toLowerCase() as StatusType) || 'effective'}
                          size="xs"
                          className="shrink-0 mt-0.5"
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-sm text-slate-400 py-10">
                    <FileText className="h-8 w-8 mb-2 opacity-10" />
                    {correlatedSearchQuery ? "No matching documents" : "No documents available"}
                  </div>
                )}
              </div>
            </div>

            {/* Arrow Buttons */}
            <div className="flex lg:flex-col items-center justify-center gap-3 py-2 lg:pt-12">
              <button
                onClick={handleMoveToSelectedCorrelated}
                disabled={selectedAvailableCorrelatedIds.length === 0}
                className="p-2 sm:p-2.5 border border-slate-200 rounded-xl bg-white shadow-sm hover:bg-emerald-50 hover:border-emerald-200 hover:text-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                <ChevronRight className="h-5 w-5 rotate-90 lg:rotate-0" />
              </button>
              <button
                onClick={handleMoveToAvailableCorrelated}
                disabled={selectedCorrelatedDocIds.length === 0}
                className="p-2 sm:p-2.5 border border-slate-200 rounded-xl bg-white shadow-sm hover:bg-blue-50 hover:border-blue-200 hover:text-blue-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                <ChevronLeft className="h-5 w-5 rotate-90 lg:rotate-0" />
              </button>
            </div>

            {/* Selected Documents */}
            <div className="flex flex-col min-w-0">
              <h3 className="text-xs sm:text-sm font-semibold text-slate-900 mb-2 sm:mb-3">Selected Documents</h3>
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  value={selectedCorrelatedSearchQuery}
                  onChange={(e) => setSelectedCorrelatedSearchQuery(e.target.value)}
                  placeholder="Search in selected..."
                  className="w-full h-9 pl-9 pr-3 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-all shadow-sm"
                />
              </div>
              <div
                onDragOver={handleDragOver}
                onDrop={handleDropToSelectedCorrelated}
                className="border border-slate-200 rounded-lg bg-slate-50/50 flex-1 min-h-[100px] sm:min-h-[180px] max-h-[160px] sm:max-h-[240px] overflow-y-auto custom-scrollbar"
              >
                {filteredSelectedCorrelatedDocs.length > 0 ? (
                  <div className="divide-y divide-slate-100">
                    {filteredSelectedCorrelatedDocs.map((doc) => (
                      <div
                        key={doc.id}
                        draggable={true}
                        onDragStart={(e) => handleDragStartCorrelated(e, doc.id, "selected")}
                        onDragEnd={handleDragEnd}
                        onClick={() => handleToggleSelectedCorrelated(doc.id)}
                        onDoubleClick={() => handleDoubleClickSelectedCorrelated(doc.id)}
                        className={cn(
                          "px-3 py-2.5 cursor-pointer transition-all text-[11px] hover:bg-white/80 flex items-start justify-between gap-3",
                          (selectedCorrelatedDocIds.includes(doc.id) || focusedCorrelatedId === doc.id) &&
                          "bg-blue-50/80 font-medium",
                        )}
                      >
                        <span className="font-medium text-slate-900 break-words leading-relaxed min-w-0 flex-1">
                          <span className="text-emerald-600">{doc.documentNumber || "N/A"}</span>
                          {" - "}
                          {doc.documentName}
                        </span>
                        <StatusBadge
                          status={(doc.status?.toLowerCase().replace(/ /g, "") as any) || 'effective'}
                          size="xs"
                          className="shrink-0 mt-0.5"
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-slate-400 py-10 opacity-60">
                    <Check className="h-8 w-8 mb-2 opacity-10" />
                    <span className="text-xs">No documents selected</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <DocumentPreviewPanel docId={focusedCorrelatedId} />
        </div>
      </FormModal>

      {/* Related Documents Modal */}
      <FormModal
        isOpen={isRelatedModalOpen}
        onClose={handleCancelRelated}
        title="Select Related Documents"
        description="Link subordinate documents (Forms, Annexes, Work Instructions, etc.)"
        size="2xl"
        className="max-w-[95%] sm:max-w-3xl"
        showCancel={true}
        cancelText="Cancel"
        confirmText="Save Selection"
        onConfirm={handleSaveRelated}
      >
        <div className="flex flex-col h-full">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr] gap-2 lg:gap-6">
            {/* Available Documents */}
            <div className="flex flex-col min-w-0">
              <h3 className="text-xs sm:text-sm font-semibold text-slate-900 mb-2 sm:mb-3">
                Available Documents
              </h3>

              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by Document Number or Title..."
                  className="w-full h-9 pl-9 pr-3 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-all shadow-sm"
                />
              </div>

              <div
                onDragOver={handleDragOver}
                onDrop={handleDropToAvailable}
                className="border border-slate-200 rounded-lg bg-slate-50/50 flex-1 min-h-[100px] sm:min-h-[180px] max-h-[160px] sm:max-h-[240px] overflow-y-auto custom-scrollbar"
              >
                {isRelatedLoading ? (
                  <div className="flex flex-col items-center justify-center h-full text-sm text-slate-400 py-10">
                    <FileText className="h-8 w-8 mb-2 opacity-10 animate-pulse" />
                    Loading documents...
                  </div>
                ) : filteredAvailableDocs.length > 0 ? (
                  <div className="divide-y divide-slate-100">
                    {filteredAvailableDocs.map((doc) => (
                      <div
                        key={doc.id}
                        draggable={true}
                        onDragStart={(e) => handleDragStart(e, doc.id, "available")}
                        onDragEnd={handleDragEnd}
                        onClick={() => handleToggleAvailable(doc.id)}
                        onDoubleClick={() => handleDoubleClickAvailable(doc.id)}
                        className={cn(
                          "px-3 py-2.5 cursor-pointer transition-all text-[11px] hover:bg-emerald-50/50 flex items-start justify-between gap-3",
                          (selectedAvailableIds.includes(doc.id) || focusedRelatedId === doc.id) &&
                          "bg-emerald-50/80 font-medium"
                        )}
                      >
                        <span className="font-medium text-slate-900 break-words leading-relaxed min-w-0 flex-1">
                          <span className="text-emerald-600">{doc.documentNumber || "N/A"}</span>
                          {" - "}
                          {doc.documentName}
                        </span>
                        <StatusBadge
                          status={(doc.status?.toLowerCase() as StatusType) || 'effective'}
                          size="xs"
                          className="shrink-0 mt-0.5"
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-slate-400 py-10">
                    <FileText className="h-8 w-8 mb-2 opacity-10" />
                    {searchQuery ? "No matching documents" : "No documents available"}
                  </div>
                )}
              </div>
            </div>

            {/* Arrow Buttons */}
            <div className="flex lg:flex-col items-center justify-center gap-3 py-2 lg:pt-12">
              <button
                onClick={handleMoveToSelected}
                disabled={selectedAvailableIds.length === 0}
                className="p-2 sm:p-2.5 border border-slate-200 rounded-xl bg-white shadow-sm hover:bg-emerald-50 hover:border-emerald-200 hover:text-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                title="Move to selected"
              >
                <ChevronRight className="h-5 w-5 rotate-90 lg:rotate-0" />
              </button>
              <button
                onClick={handleMoveToAvailable}
                disabled={selectedDocIds.length === 0}
                className="p-2 sm:p-2.5 border border-slate-200 rounded-xl bg-white shadow-sm hover:bg-blue-50 hover:border-blue-200 hover:text-blue-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                title="Move to available"
              >
                <ChevronLeft className="h-5 w-5 rotate-90 lg:rotate-0" />
              </button>
            </div>

            {/* Selected Documents */}
            <div className="flex flex-col min-w-0">
              <h3 className="text-xs sm:text-sm font-semibold text-slate-900 mb-2 sm:mb-3">
                Selected Documents
              </h3>

              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  value={selectedSearchQuery}
                  onChange={(e) => setSelectedSearchQuery(e.target.value)}
                  placeholder="Search in selected..."
                  className="w-full h-9 pl-9 pr-3 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-all shadow-sm"
                />
              </div>

              <div
                onDragOver={handleDragOver}
                onDrop={handleDropToSelected}
                className="border border-slate-200 rounded-lg bg-slate-50/50 flex-1 min-h-[100px] sm:min-h-[180px] max-h-[160px] sm:max-h-[240px] overflow-y-auto custom-scrollbar"
              >
                {filteredSelectedRelatedDocs.length > 0 ? (
                  <div className="divide-y divide-slate-100">
                    {filteredSelectedRelatedDocs.map((doc) => (
                      <div
                        key={doc.id}
                        draggable={true}
                        onDragStart={(e) => handleDragStart(e, doc.id, "selected")}
                        onDragEnd={handleDragEnd}
                        onClick={() => handleToggleSelected(doc.id)}
                        onDoubleClick={() => handleDoubleClickSelected(doc.id)}
                        className={cn(
                          "px-3 py-2.5 cursor-pointer transition-all text-[11px] hover:bg-white/80 flex items-start justify-between gap-3",
                          (selectedDocIds.includes(doc.id) || focusedRelatedId === doc.id) &&
                          "bg-blue-50/80 font-medium",
                        )}
                      >
                        <span className="font-medium text-slate-900 break-words leading-relaxed min-w-0 flex-1">
                          <span className="text-emerald-600">{doc.documentNumber || "N/A"}</span>
                          {" - "}
                          {doc.documentName}
                        </span>
                        <StatusBadge
                          status={(doc.status?.toLowerCase().replace(/ /g, "") as any) || 'effective'}
                          size="xs"
                          className="shrink-0 mt-0.5"
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-slate-400 py-10 opacity-60">
                    <Check className="h-8 w-8 mb-2 opacity-10" />
                    <span className="text-xs">No documents selected</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <DocumentPreviewPanel docId={focusedRelatedId} />
        </div>
      </FormModal>
    </>
  );
};
