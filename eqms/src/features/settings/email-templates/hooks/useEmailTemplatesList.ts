import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useToast } from "@/components/ui/toast";
import { useTranslation } from "@/i18n";
import { useDebounce } from "@/hooks";
import { formatDateNumeric } from "@/utils/format";
import { emailTemplateApi } from "@/services/api";
import type {
  EmailTemplate,
  EmailTemplateListParams,
  EmailTemplatePayload,
  EmailTemplateStatus,
  EmailTemplateType,
} from "../types";

type SortConfig = {
  key: string | null;
  direction: "asc" | "desc";
};

const DEFAULT_PAGE_SIZE = 10;

const buildQueryParams = (
  search: string,
  typeFilter: EmailTemplateType | "All",
  statusFilter: EmailTemplateStatus | "All",
  dateFrom: string,
  dateTo: string,
  updatedFrom: string,
  updatedTo: string,
  sortConfig: SortConfig,
  page: number,
  limit: number
): EmailTemplateListParams => ({
  search: search.trim() || undefined,
  type: typeFilter === "All" ? undefined : typeFilter,
  status: statusFilter === "All" ? undefined : statusFilter,
  createdFrom: dateFrom || undefined,
  createdTo: dateTo || undefined,
  updatedFrom: updatedFrom || undefined,
  updatedTo: updatedTo || undefined,
  sortBy: sortConfig.key || undefined,
  sortDirection: sortConfig.direction,
  page,
  limit,
});

const buildCsv = (rows: EmailTemplate[]) => {
  const header = ["Name", "Type", "Subject", "Status", "Usage Count", "Last Used", "Created By", "Updated Date"];
  const lines = rows.map((template) => [
    template.name,
    template.type,
    `"${template.subject.replace(/"/g, '""')}"`,
    template.status,
    String(template.usageCount ?? 0),
    template.lastUsed ? formatDateNumeric(template.lastUsed) : "",
    template.createdBy || "",
    template.updatedDate ? formatDateNumeric(template.updatedDate) : formatDateNumeric(template.createdDate),
  ].join(","));
  return [header.join(","), ...lines].join("\n");
};

const downloadCsv = (csv: string, fileName: string) => {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export function useEmailTemplatesList(options?: { autoFetch?: boolean }) {
  const autoFetch = options?.autoFetch ?? true;
  const { showToast } = useToast();
  const { t } = useTranslation();
  const requestSeqRef = useRef(0);

  const [emailTemplates, setEmailTemplates] = useState<EmailTemplate[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<EmailTemplateType | "All">("All");
  const [statusFilter, setStatusFilter] = useState<EmailTemplateStatus | "All">("All");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [updatedFrom, setUpdatedFrom] = useState("");
  const [updatedTo, setUpdatedTo] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(DEFAULT_PAGE_SIZE);
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    key: "createdDate",
    direction: "desc",
  });

  const debouncedSearch = useDebounce(searchQuery, 300);

  const fetchTemplates = useCallback(async () => {
    const requestId = ++requestSeqRef.current;
    setIsLoading(true);

    try {
      const response = await emailTemplateApi.getEmailTemplates(
        buildQueryParams(
          debouncedSearch,
          typeFilter,
          statusFilter,
          dateFrom,
          dateTo,
          updatedFrom,
          updatedTo,
          sortConfig,
          currentPage,
          itemsPerPage
        )
      );

      if (requestId !== requestSeqRef.current) {
        return;
      }

      if (response.pagination.totalPages > 0 && currentPage > response.pagination.totalPages) {
        setCurrentPage(response.pagination.totalPages);
        return;
      }

      setEmailTemplates(response.data);
      setTotalItems(response.pagination.total);
      setTotalPages(Math.max(response.pagination.totalPages || 0, 1));
    } catch (error) {
      if (requestId !== requestSeqRef.current) {
        return;
      }
      setEmailTemplates([]);
      setTotalItems(0);
      setTotalPages(1);
      showToast({ type: "error", title: t("emailTemplates.loadFailedTitle"), message: t("emailTemplates.loadFailedMessage") });
    } finally {
      if (requestId === requestSeqRef.current) {
        setIsLoading(false);
      }
    }
  }, [
    currentPage,
    dateFrom,
    dateTo,
    debouncedSearch,
    itemsPerPage,
    showToast,
    sortConfig,
    statusFilter,
    typeFilter,
    updatedFrom,
    updatedTo,
    t,
  ]);

  useEffect(() => {
    if (autoFetch) {
      void fetchTemplates();
    }
  }, [autoFetch, fetchTemplates]);

  const handleSort = (key: string) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));
    setCurrentPage(1);
  };

  const refreshAfterMutation = useCallback(async () => {
    if (autoFetch) {
      await fetchTemplates();
    }
  }, [autoFetch, fetchTemplates]);

  const createEmailTemplate = async (payload: EmailTemplatePayload) => {
    try {
      const newTemplate = await emailTemplateApi.createEmailTemplate(payload);
      await refreshAfterMutation();
      showToast({ type: "success", title: t("emailTemplates.createdTitle"), message: t("emailTemplates.createdMessage", { name: payload.name }) });
      return newTemplate;
    } catch (error) {
      showToast({ type: "error", title: t("emailTemplates.createFailedTitle"), message: t("emailTemplates.createFailedMessage") });
      throw error;
    }
  };

  const updateEmailTemplate = async (id: string, payload: Partial<EmailTemplatePayload>) => {
    try {
      const updated = await emailTemplateApi.updateEmailTemplate(id, payload);
      await refreshAfterMutation();
      showToast({ type: "success", title: t("emailTemplates.updatedTitle"), message: t("emailTemplates.updatedMessage") });
      return updated;
    } catch (error) {
      showToast({ type: "error", title: t("emailTemplates.updateFailedTitle"), message: t("emailTemplates.updateFailedMessage") });
      throw error;
    }
  };

  const deleteEmailTemplate = async (id: string, templateName: string) => {
    try {
      await emailTemplateApi.deleteEmailTemplate(id);
      await refreshAfterMutation();
      showToast({ type: "success", title: t("emailTemplates.deletedTitle"), message: t("emailTemplates.deletedMessage", { name: templateName }) });
    } catch (error) {
      showToast({ type: "error", title: t("emailTemplates.deleteFailedTitle"), message: t("emailTemplates.deleteFailedMessage") });
      throw error;
    }
  };

  const duplicateEmailTemplate = async (id: string) => {
    try {
      const duplicatedTemplate = await emailTemplateApi.duplicateEmailTemplate(id);
      await refreshAfterMutation();
      showToast({ type: "success", title: t("emailTemplates.duplicatedTitle"), message: t("emailTemplates.duplicatedMessage", { name: duplicatedTemplate.name }) });
      return duplicatedTemplate;
    } catch (error) {
      showToast({ type: "error", title: t("emailTemplates.duplicateFailedTitle"), message: t("emailTemplates.duplicateFailedMessage") });
      throw error;
    }
  };

  const toggleTemplateStatus = async (id: string) => {
    try {
      const updated = await emailTemplateApi.toggleTemplateStatus(id);
      await refreshAfterMutation();
      showToast({ type: "success", title: t("emailTemplates.statusUpdatedTitle"), message: t("emailTemplates.statusUpdatedMessage") });
      return updated;
    } catch (error) {
      showToast({ type: "error", title: t("emailTemplates.statusUpdateFailedTitle"), message: t("emailTemplates.statusUpdateFailedMessage") });
      throw error;
    }
  };

  const exportEmailTemplates = useCallback(async () => {
    setIsExporting(true);
    try {
      const rows = await emailTemplateApi.exportEmailTemplates(
        buildQueryParams(
          debouncedSearch,
          typeFilter,
          statusFilter,
          dateFrom,
          dateTo,
          updatedFrom,
          updatedTo,
          sortConfig,
          1,
          Math.max(totalItems, 1)
        )
      );
      downloadCsv(buildCsv(rows), "email-templates.csv");
      return rows;
    } catch (error) {
      showToast({ type: "error", title: t("emailTemplates.exportFailedTitle"), message: t("emailTemplates.exportFailedMessage") });
      throw error;
    } finally {
      setIsExporting(false);
    }
  }, [
    dateFrom,
    dateTo,
    debouncedSearch,
    showToast,
    sortConfig,
    statusFilter,
    totalItems,
    typeFilter,
    updatedFrom,
    updatedTo,
    t,
  ]);

  const clearFilters = () => {
    setSearchQuery("");
    setTypeFilter("All");
    setStatusFilter("All");
    setDateFrom("");
    setDateTo("");
    setUpdatedFrom("");
    setUpdatedTo("");
    setCurrentPage(1);
  };

  const draftCount = useMemo(
    () => emailTemplates.filter((t) => t.status === "Draft").length,
    [emailTemplates]
  );

  const inactiveCount = useMemo(
    () => emailTemplates.filter((t) => t.status === "Inactive").length,
    [emailTemplates]
  );

  return {
    emailTemplates,
    filteredEmailTemplates: emailTemplates,
    currentEmailTemplates: emailTemplates,
    totalItems,
    totalPages,
    startIndex: (currentPage - 1) * itemsPerPage,
    isLoading,
    isExporting,
    searchQuery,
    setSearchQuery,
    typeFilter,
    setTypeFilter,
    statusFilter,
    setStatusFilter,
    dateFrom,
    setDateFrom,
    dateTo,
    setDateTo,
    updatedFrom,
    setUpdatedFrom,
    updatedTo,
    setUpdatedTo,
    currentPage,
    setCurrentPage,
    itemsPerPage,
    setItemsPerPage,
    sortConfig,
    handleSort,
    draftCount,
    inactiveCount,
    createEmailTemplate,
    updateEmailTemplate,
    deleteEmailTemplate,
    duplicateEmailTemplate,
    toggleTemplateStatus,
    clearFilters,
    exportEmailTemplates,
    refreshTemplates: fetchTemplates,
  };
}
