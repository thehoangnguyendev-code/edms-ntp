import React, { useEffect, useState } from "react";
import { PortalDropdownMenu } from "@/components/ui/dropdown";
import { AlertTriangle, Check, ChevronDown, ChevronUp, MoreVertical, Power, PowerOff, Search, X } from "lucide-react";
import { AlertModal } from "@/components/ui/modal/AlertModal";
import { Badge } from "@/components/ui/badge/Badge";
import { Checkbox } from "@/components/ui/checkbox/Checkbox";
import { DateRangePicker } from "@/components/ui/datetime-picker/DateRangePicker";
import { FilterAccordionItem, FilterDrawer } from "@/components/ui/filter/FilterDrawer";
import { FormModal } from "@/components/ui/modal/FormModal";
import { Button } from "@/components/ui/button/Button";
import { Select } from "@/components/ui/select/Select";
import { TablePagination } from "@/components/ui/table/TablePagination";
import { TableEmptyState } from "@/components/ui/table/TableEmptyState";
import { cn } from "@/components/ui/utils";
import { IconFilter2, IconPencilMinus } from "@tabler/icons-react";
import { dictionaryApi, documentNameFormatApi } from "@/services/api";
import { usePortalDropdown } from "@/hooks";
import { useToast } from "@/components/ui/toast";
import { extractApiMessage } from "../utils";
import type { DocumentTypeItem } from "../types";
import type { DocumentNameFormatItem } from "@/features/settings/document-administration/documentNameFormatTypes";
import { useDictionaryServerTable } from "../hooks/useDictionaryServerTable";
import { usePermissions } from "@/hooks/usePermissions";
import { TableMarkup, TABLE_STYLES } from "@/components/ui/table/TablePrimitives";

type ResultModalState = {
  isOpen: boolean;
  type: "success" | "error";
  title: string;
  description: string;
};

type DocumentTypeFormData = {
  name: string;
  shortCode: string;
  currentSequence: number;
  description: string;
  isActive: boolean;
  nameFormatId: string | null;
};

export const DocumentTypesTab = React.forwardRef<{ openAddModal: () => void }, {}>((_, ref) => {
  const { openId: openDropdownId, position: dropdownPosition, getRef: getButtonRef, toggle: handleDropdownToggle, close: closeDropdown } = usePortalDropdown();
  const { hasPermissionAlias } = usePermissions();
  const canManage = hasPermissionAlias("documents.admin.document_types.manage");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedItem, setSelectedItem] = useState<DocumentTypeItem | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showToggleModal, setShowToggleModal] = useState(false);
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"All" | "Active" | "Inactive">("All");
  const [modifiedFromDate, setModifiedFromDate] = useState("");
  const [modifiedToDate, setModifiedToDate] = useState("");
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(["status", "date"]));
  const [resultModal, setResultModal] = useState<ResultModalState>({
    isOpen: false,
    type: "success",
    title: "",
    description: "",
  });
  const { showToast } = useToast();

  const {
    searchQuery,
    setSearchQuery,
    currentPage,
    setCurrentPage,
    itemsPerPage,
    setItemsPerPage,
    totalPages,
    totalItems,
    items,
    isLoading,
    sortConfig,
    handleSort,
    reload,
  } = useDictionaryServerTable<DocumentTypeItem>({
    fetcher: dictionaryApi.getDocumentTypesPage,
    defaultSortBy: "name",
    extraParams: {
      status: statusFilter,
      modifiedFrom: modifiedFromDate || undefined,
      modifiedTo: modifiedToDate || undefined,
    },
  });

  React.useImperativeHandle(ref, () => ({
    openAddModal: () => setShowAddModal(true),
  }));

  const openResultModal = (type: ResultModalState["type"], title: string, description: string) => {
    setResultModal({ isOpen: true, type, title, description });
  };

  const closeResultModal = () => setResultModal((prev) => ({ ...prev, isOpen: false }));

  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, modifiedFromDate, modifiedToDate, setCurrentPage]);

  const handleSave = async (payload: DocumentTypeFormData) => {
    try {
      let saved;
      if (showEditModal && selectedItem) {
        // The API validates a complete dictionary record. Sequence is included
        // unchanged because it is allocated exclusively by the server.
        saved = await dictionaryApi.updateDocumentType(selectedItem.id, payload);
      } else {
        saved = await dictionaryApi.createDocumentType(payload);
      }

      openResultModal(
        "success",
        showEditModal ? "Document Type Updated" : "Document Type Created",
        `Document type "${saved.name}" has been ${showEditModal ? "updated" : "created"} successfully.`
      );
      reload();
      setShowAddModal(false);
      setShowEditModal(false);
      setSelectedItem(null);
    } catch (error) {
      openResultModal(
        "error",
        showEditModal ? "Document Type Update Failed" : "Document Type Create Failed",
        extractApiMessage(error, showEditModal ? "Unable to update document type." : "Unable to create document type.")
      );
      throw error;
    }
  };

  const handleRequestToggleStatus = (item: DocumentTypeItem) => {
    setSelectedItem(item);
    setShowToggleModal(true);
    closeDropdown();
  };

  const handleConfirmToggleStatus = async () => {
    const item = selectedItem;
    if (!item) return;
    setIsSubmitting(true);
    try {
      const updated = await dictionaryApi.updateDocumentType(item.id, {
        name: item.name,
        shortCode: item.shortCode,
        currentSequence: item.currentSequence,
        description: item.description,
        isActive: !item.isActive,
        nameFormatId: item.nameFormatId,
      });
      setShowToggleModal(false);
      reload();
      showToast({
        type: "success",
        title: updated.isActive ? "Document Type Activated" : "Document Type Deactivated",
        message: `Document type "${updated.name}" was ${updated.isActive ? "activated" : "deactivated"} successfully.`,
      });
    } catch (error) {
      setShowToggleModal(false);
      showToast({
        type: "error",
        title: "Document Type Status Update Failed",
        message: extractApiMessage(error, "Unable to update document type status."),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const clearFilters = () => {
    setSearchQuery("");
    setStatusFilter("All");
    setModifiedFromDate("");
    setModifiedToDate("");
    setCurrentPage(1);
  };

  const hasActiveFilters =
    searchQuery.length > 0 ||
    statusFilter !== "All" ||
    modifiedFromDate.length > 0 ||
    modifiedToDate.length > 0;

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });
  };

  const getOptionClassName = (isActive: boolean) =>
    cn(
      "w-full flex items-center justify-between px-3 py-2.5 rounded-lg border text-left transition-all",
      isActive
        ? "bg-emerald-50 border-emerald-200 text-emerald-700"
        : "bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50"
    );

  return (
    <div className="flex-1 flex flex-col gap-4 md:gap-5 min-h-0">
      <div className="bg-white w-full">
        <div className="flex md:hidden flex-col gap-1.5 w-full">
          <label className="text-xs sm:text-sm font-medium text-slate-700 block">Search</label>
          <div className="flex items-center gap-2">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search document types..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full h-10 pl-10 pr-9 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
              />
              {searchQuery && (
                <button
                  onClick={() => {
                    setSearchQuery("");
                    setCurrentPage(1);
                  }}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <Button variant="outline" onClick={() => setIsFilterDrawerOpen(true)} className="whitespace-nowrap gap-2">
              <IconFilter2 className="h-4 w-4" />
              Filters
            </Button>
          </div>
        </div>

        <div className="hidden md:grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 sm:gap-4 items-end">
          <div className="sm:col-span-1 lg:col-span-4">
            <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search document types..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full h-9 pl-10 pr-4 text-xs sm:text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>
          </div>

          <div className="sm:col-span-1 lg:col-span-4">
            <Select
              label="Status"
              value={statusFilter}
              onChange={(value) => {
                setStatusFilter(value as "All" | "Active" | "Inactive");
                setCurrentPage(1);
              }}
              options={[
                { label: "All Status", value: "All" },
                { label: "Active", value: "Active" },
                { label: "Inactive", value: "Inactive" },
              ]}
              placeholder="All Status"
            />
          </div>

          <div className="sm:col-span-1 lg:col-span-4">
            <DateRangePicker
              label="Modified Date Range"
              startDate={modifiedFromDate}
              endDate={modifiedToDate}
              onStartDateChange={(v) => {
                setModifiedFromDate(v);
                setCurrentPage(1);
              }}
              onEndDateChange={(v) => {
                setModifiedToDate(v);
                setCurrentPage(1);
              }}
              placeholder="Select range"
            />
          </div>
        </div>

        <div className="hidden md:flex justify-start mt-3">
          <Button
           size="sm"
            variant="outline"
            onClick={clearFilters}
            disabled={!hasActiveFilters}
            className="gap-2"
          >
            Clear Filters
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden border border-slate-200 rounded-xl bg-white shadow-sm flex flex-col">
        <div className="flex-1 overflow-x-auto">
          <TableMarkup.Root className="w-full">
            <TableMarkup.Head className="sticky top-0 z-30">
              <TableMarkup.Row>
                <TableMarkup.HeaderCell className={TABLE_STYLES.headerCell35}>No.</TableMarkup.HeaderCell>
                {[
                  { label: "Document Type Name", id: "name" },
                  { label: "Short Code", id: "shortCode" },
                  { label: "Document Number Sequence", id: "currentSequence" },
                  { label: "Description", id: "description" },
                  { label: "Status", id: "isActive" },
                  { label: "Modified Date", id: "modifiedDate" },
                ].map((col) => {
                  const isSorted = sortConfig.key === col.id;
                  return (
                    <TableMarkup.HeaderCell
                      key={col.id}
                      onClick={() => handleSort(col.id)}
                      className={TABLE_STYLES.headerCell38}
                    >
                      <div className="flex items-center justify-between gap-2 w-full">
                        <span className="truncate">{col.label}</span>
                        <div className="flex flex-col text-slate-500 flex-shrink-0 group-hover:text-slate-700 transition-colors">
                          <ChevronUp className={cn("h-3 w-3 -mb-1", isSorted && sortConfig.direction === "asc" ? "text-emerald-600 font-bold" : "")} />
                          <ChevronDown className={cn("h-3 w-3", isSorted && sortConfig.direction === "desc" ? "text-emerald-600 font-bold" : "")} />
                        </div>
                      </div>
                    </TableMarkup.HeaderCell>
                  );
                })}
                <TableMarkup.HeaderCell className={TABLE_STYLES.headerCell26}>
                  Action
                </TableMarkup.HeaderCell>
              </TableMarkup.Row>
            </TableMarkup.Head>
            <TableMarkup.Body className="divide-y divide-slate-200 bg-white">
              {isLoading ? (
                <TableMarkup.Row>
                  <TableMarkup.Cell colSpan={8} className="py-14 text-center text-slate-500">Loading document types...</TableMarkup.Cell>
                </TableMarkup.Row>
              ) : items.length > 0 ? (
                items.map((item, index) => (
                  <TableMarkup.Row key={item.id} className="hover:bg-slate-50/80 transition-colors group">
                    <TableMarkup.Cell className={TABLE_STYLES.cell30}>
                      {(currentPage - 1) * itemsPerPage + index + 1}
                    </TableMarkup.Cell>
                    <TableMarkup.Cell className="py-3 px-4 text-xs sm:text-sm whitespace-nowrap">
                      <span className="font-medium text-slate-900">{item.name}</span>
                    </TableMarkup.Cell>
                    <TableMarkup.Cell className="py-3 px-4 text-xs sm:text-sm whitespace-nowrap">
                      <Badge color="emerald" size="sm">{item.shortCode}</Badge>
                    </TableMarkup.Cell>
                    <TableMarkup.Cell className="py-3 px-4 text-xs sm:text-sm whitespace-nowrap">
                      <div className="flex flex-col gap-0.5 sm:gap-1">
                        <span className="font-medium text-slate-900">
                          {item.lastIssuedDocumentNumber ?? "No number issued"}
                        </span>
                        <span className="text-2xs sm:text-xs text-slate-500">
                          Next: {item.nextDocumentNumber ?? "-"}
                        </span>
                      </div>
                    </TableMarkup.Cell>
                    <TableMarkup.Cell className="py-3 px-4 text-xs sm:text-sm text-slate-600 max-w-md truncate">{item.description || "-"}</TableMarkup.Cell>
                    <TableMarkup.Cell className="py-3 px-4 text-xs sm:text-sm whitespace-nowrap">
                      {item.isActive ? (
                        <Badge color="emerald" size="sm" >Active</Badge>
                      ) : (
                        <Badge color="slate" size="sm" >Inactive</Badge>
                      )}
                    </TableMarkup.Cell>
                    <TableMarkup.Cell className="py-3 px-4 text-xs sm:text-sm whitespace-nowrap text-slate-600">{item.modifiedDate}</TableMarkup.Cell>
                    <TableMarkup.Cell
                      onClick={(e) => e.stopPropagation()}
                      className={TABLE_STYLES.emptyCell3}
                    >
                      {canManage && (
                        <button
                          ref={getButtonRef(item.id)}
                          onClick={(e) => handleDropdownToggle(item.id, e)}
                          className="inline-flex items-center justify-center h-7 w-7 sm:h-8 sm:w-8 rounded-lg hover:bg-slate-100 transition-colors"
                          aria-label="More actions"
                        >
                          <MoreVertical className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-slate-600" />
                        </button>
                      )}
                    </TableMarkup.Cell>
                  </TableMarkup.Row>
                ))
              ) : (
                <TableMarkup.Row>
                  <TableMarkup.Cell colSpan={8} className="p-0">
                    <TableEmptyState title="No items found" description="Try adjusting your search" />
                  </TableMarkup.Cell>
                </TableMarkup.Row>
              )}
            </TableMarkup.Body>
          </TableMarkup.Root>
        </div>

        {!isLoading && totalItems > 0 && (
          <TablePagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={totalItems}
            itemsPerPage={itemsPerPage}
            onPageChange={setCurrentPage}
            onItemsPerPageChange={setItemsPerPage}
          />
        )}
      </div>

      <PortalDropdownMenu isOpen={!!openDropdownId} onClose={closeDropdown} position={dropdownPosition}>
        <div className="py-1.5">
          <button
            onClick={(e) => {
              e.stopPropagation();
              const item = items.find((current) => current.id === openDropdownId);
              if (item) setSelectedItem(item);
              setShowEditModal(true);
              closeDropdown();
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-xs text-slate-500 hover:bg-slate-50 transition-colors"
          >
            <IconPencilMinus className="h-3.5 w-3.5" />
            <span>Edit Document Type</span>
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              const item = items.find((current) => current.id === openDropdownId);
              if (item) handleRequestToggleStatus(item);
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-xs text-slate-500 hover:bg-slate-50 transition-colors"
          >
            {items.find((current) => current.id === openDropdownId)?.isActive ? (
              <>
                <PowerOff className="h-3.5 w-3.5" />
                <span>Disable</span>
              </>
            ) : (
              <>
                <Power className="h-3.5 w-3.5" />
                <span>Enable</span>
              </>
            )}
          </button>
        </div>
      </PortalDropdownMenu>

      <DocumentTypeModal
        isOpen={showAddModal || showEditModal}
        onClose={() => {
          setShowAddModal(false);
          setShowEditModal(false);
          setSelectedItem(null);
        }}
        item={selectedItem}
        isEdit={showEditModal}
        onSave={handleSave}
      />

      <AlertModal
        isOpen={showToggleModal}
        onClose={() => {
          setShowToggleModal(false);
          setSelectedItem(null);
        }}
        onConfirm={handleConfirmToggleStatus}
        type="warning"
        title={`${selectedItem?.isActive ? "Deactivate" : "Activate"} Document Type?`}
        description={
          <div className="space-y-3">
            <p>
              Are you sure you want to {selectedItem?.isActive ? "deactivate" : "activate"}{" "}
              <strong>{selectedItem?.name}</strong>?
            </p>
            <div className="text-xs bg-amber-50 border border-amber-200 rounded-lg p-3">
              <p className="text-amber-800">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-600 inline shrink-0" />{" "}
                <span className="font-semibold">Warning:</span> This change will take effect immediately.
              </p>
            </div>
          </div>
        }
        confirmText={selectedItem?.isActive ? "Deactivate" : "Activate"}
        cancelText="Cancel"
        isLoading={isSubmitting}
        showCancel
      />

      <AlertModal
        isOpen={resultModal.isOpen}
        onClose={closeResultModal}
        title={resultModal.title}
        description={resultModal.description}
        type={resultModal.type}
        confirmText="OK"
        showCancel={false}
      />

      <FilterDrawer
        isOpen={isFilterDrawerOpen}
        onClose={() => setIsFilterDrawerOpen(false)}
        onClear={clearFilters}
        onApply={() => setIsFilterDrawerOpen(false)}
      >
        <FilterAccordionItem
          label="Status"
          isExpanded={expandedSections.has("status")}
          onToggle={() => toggleSection("status")}
        >
          <div className="grid grid-cols-1 gap-2 pt-1 pb-4">
            {[
              { label: "All Status", value: "All" },
              { label: "Active", value: "Active" },
              { label: "Inactive", value: "Inactive" },
            ].map((opt) => (
              <button
                key={opt.value}
                onClick={() => {
                  setStatusFilter(opt.value as "All" | "Active" | "Inactive");
                  setCurrentPage(1);
                }}
                className={getOptionClassName(statusFilter === opt.value)}
              >
                <span className="text-xs">{opt.label}</span>
                {statusFilter === opt.value && <Check size={16} className="text-emerald-500" />}
              </button>
            ))}
          </div>
        </FilterAccordionItem>

        <FilterAccordionItem
          label="Modified Date Range"
          isExpanded={expandedSections.has("date")}
          onToggle={() => toggleSection("date")}
        >
          <div className="pt-2 pb-4">
            <DateRangePicker
              label=""
              startDate={modifiedFromDate}
              endDate={modifiedToDate}
              onStartDateChange={(v) => {
                setModifiedFromDate(v);
                setCurrentPage(1);
              }}
              onEndDateChange={(v) => {
                setModifiedToDate(v);
                setCurrentPage(1);
              }}
              placeholder="Select range"
            />
          </div>
        </FilterAccordionItem>
      </FilterDrawer>
    </div>
  );
});

interface DocumentTypeModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: DocumentTypeItem | null;
  isEdit: boolean;
  onSave: (data: DocumentTypeFormData) => Promise<void>;
}

const DocumentTypeModal: React.FC<DocumentTypeModalProps> = ({ isOpen, onClose, item, isEdit, onSave }) => {
  const [formData, setFormData] = useState<DocumentTypeFormData>({
    name: item?.name || "",
    shortCode: item?.shortCode || "",
    currentSequence: item?.currentSequence || 0,
    description: item?.description || "",
    isActive: item?.isActive ?? true,
    nameFormatId: item?.nameFormatId ?? null,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [eligibleFormats, setEligibleFormats] = useState<DocumentNameFormatItem[]>([]);

  // The backend rejects a Short Code change once any document number has been issued for this
  // type (the code is frozen into every document/revision/controlled-copy number).
  const shortCodeLocked =
    isEdit && (!!item?.lastIssuedDocumentNumber || (item?.currentSequence ?? 0) > 0);

  useEffect(() => {
    if (!isOpen) return;
    documentNameFormatApi.getFormats().then((formats) => {
      // Only a Format eligible for real document-number generation is offered here -- see
      // DocumentComponentResolver#isEligibleAsDocumentNumberFormat. Richer formats stay usable
      // for preview/cataloging (Document Name Formats screen) but would be silently rejected by
      // the backend if picked here, so they're filtered out rather than shown and then failing.
      setEligibleFormats(formats.filter((f) => f.isActive && f.eligibleForDocumentNumber));
    });
  }, [isOpen]);

  useEffect(() => {
    if (item) {
      setFormData({
        name: item.name,
        shortCode: item.shortCode,
        currentSequence: item.currentSequence,
        description: item.description || "",
        isActive: item.isActive,
        nameFormatId: item.nameFormatId ?? null,
      });
    } else {
      setFormData({
        name: "",
        shortCode: "",
        currentSequence: 0,
        description: "",
        isActive: true,
        nameFormatId: null,
      });
    }
  }, [item, isOpen]);

  const handleSubmit = async () => {
    setIsSaving(true);
    try {
      await onSave({
        ...formData,
        shortCode: formData.shortCode.toUpperCase(),
      });
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <FormModal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={handleSubmit}
      title={`${isEdit ? "Edit" : "Add New"} Document Type`}
      isLoading={isSaving}
      size="lg"
    >
      <div className="space-y-4">
        <div>
          <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5">
            Document Type Name<span className="text-red-500 ml-1">*</span>
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="w-full h-9 px-3 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
            placeholder="Enter name"
            required
            disabled={isSaving}
          />
        </div>

        <div>
          <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5">
            Short Code<span className="text-red-500 ml-1">*</span>
          </label>
          <input
            type="text"
            value={formData.shortCode}
            onChange={(e) =>
              !shortCodeLocked && setFormData({ ...formData, shortCode: e.target.value.toUpperCase().replace(/[^A-Z0-9_/-]/g, "") })
            }
            maxLength={20}
            className={cn(
              "w-full h-9 px-3 border border-slate-200 rounded-lg text-sm uppercase focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500",
              shortCodeLocked && "bg-slate-50 text-slate-500 cursor-not-allowed"
            )}
            placeholder="e.g., SOP, POL"
            required
            readOnly={shortCodeLocked}
            disabled={isSaving || shortCodeLocked}
          />
          <p className="mt-1 text-xs text-slate-500">
            {shortCodeLocked
              ? "Locked — a document number has already been issued for this Document Type, so the code is frozen into existing document / revision numbers."
              : "Uppercase letters and digits (hyphen, underscore, slash allowed; no spaces or dots), up to 20 characters. Appears in every document number (e.g. SOP.0006) and cannot be changed once the first document number is issued."}
          </p>
        </div>

        <div>
          <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5">
            {isEdit ? "Issued Sequence" : "Starting Sequence"}
            {!isEdit && <span className="text-red-500 ml-1">*</span>}
          </label>
          <input
            type="number"
            value={formData.currentSequence}
            onChange={(e) => setFormData({ ...formData, currentSequence: parseInt(e.target.value, 10) || 0 })}
            min={0}
            className={cn(
              "w-full h-9 px-3 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500",
              isEdit && "bg-slate-50 text-slate-500 cursor-not-allowed"
            )}
            required={!isEdit}
            disabled={isSaving || isEdit}
          />
          {isEdit && (
            <p className="mt-1 text-xs text-slate-500">
              Issued Sequence is managed automatically when a document number is allocated.
            </p>
          )}
        </div>

        <div>
          <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5">Document Number Format</label>
          <Select
            value={formData.nameFormatId ?? ""}
            onChange={(v) => setFormData({ ...formData, nameFormatId: v || null })}
            options={eligibleFormats.map((f) => ({ label: `${f.name} (e.g. ${f.previewExample})`, value: f.id }))}
            placeholder="Use default (Standard)"
            disabled={isSaving}
          />
          <p className="mt-1 text-xs text-slate-500">
            Only formats composed of Document Type + Serial Number are eligible for real numbering today. Manage the full catalog under Document Name Formats.
          </p>
        </div>

        <div>
          <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5">Description</label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            rows={3}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
            placeholder="Enter description (optional)"
            disabled={isSaving}
          />
        </div>

        <div className="flex items-center gap-3">
          <Checkbox
            id="isActive doc-type"
            checked={formData.isActive}
            onChange={(checked) => setFormData({ ...formData, isActive: checked })}
            label="Active"
            disabled={isSaving}
          />
        </div>
      </div>
    </FormModal>
  );
};
