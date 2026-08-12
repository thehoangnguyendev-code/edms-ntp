import { useCallback, useEffect, useMemo, useState } from "react";
import { documentApi } from "@/services/api/documents";
import type { ControlledCopy } from "@/features/documents/document-detail/tabs/subtabs/types";
import { normalizeControlledCopyRecord } from "@/features/documents/controlled-copies/controlledCopyMapping";

type ControlledCopiesPagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

type HookState = {
  copies: ControlledCopy[];
  loading: boolean;
  error: string | null;
  pagination: ControlledCopiesPagination;
  refresh: () => Promise<void>;
};

type Options = {
  search?: string;
  page?: number;
  limit?: number;
  enabled?: boolean;
};

const DEFAULT_PAGE_SIZE = 10;

const firstText = (...values: Array<string | null | undefined>) => {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return "";
};

const normalizeApiResponseItems = (items: any[], documentId: string): ControlledCopy[] =>
  items.map((item, index) => {
    const normalized = normalizeControlledCopyRecord(item, item?.id || `${documentId}-${index}`);
    const created = firstText(normalized.createdDate, normalized.createdTime);
    return {
      id: normalized.id,
      controlledCopiesName: firstText(
        normalized.name,
        normalized.revisionName,
        normalized.documentName,
        normalized.documentDisplayLabel,
      ),
      copyNumber: firstText(normalized.controlledCopyNumber, normalized.controlNumber),
      created,
      status: firstText(normalized.status) as ControlledCopy["status"],
      openedBy: firstText(normalized.openedBy),
      validUntil: firstText(normalized.validUntil),
      documentRevision: firstText(normalized.revisionNumber, normalized.revisionName),
      documentNumber: firstText(normalized.documentNumber),
    };
  });

export const useDocumentControlledCopies = (
  documentId?: string,
  options?: Options,
): HookState => {
  const enabled = options?.enabled ?? Boolean(documentId);
  const page = options?.page ?? 1;
  const limit = options?.limit ?? DEFAULT_PAGE_SIZE;
  const search = options?.search?.trim() ?? "";
  const [copies, setCopies] = useState<ControlledCopy[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<ControlledCopiesPagination>({
    page,
    limit,
    total: 0,
    totalPages: 1,
  });

  const loadCopies = useCallback(async () => {
    if (!enabled || !documentId) {
      setCopies([]);
      setError(null);
      setPagination({
        page,
        limit,
        total: 0,
        totalPages: 1,
      });
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await documentApi.getControlledCopies({
        documentId,
        search: search || undefined,
        page,
        limit,
        sortBy: "createdDate",
        sortDirection: "desc",
      });

      const items = Array.isArray(response?.data) ? response.data : [];
      setCopies(normalizeApiResponseItems(items, documentId));
      setPagination({
        page: response?.pagination?.page ?? page,
        limit: response?.pagination?.limit ?? limit,
        total: response?.pagination?.total ?? items.length,
        totalPages: response?.pagination?.totalPages ?? 1,
      });
    } catch (err) {
      console.error("Failed to load controlled copies for document", err);
      setError("Failed to load controlled copies.");
      setCopies([]);
      setPagination({
        page,
        limit,
        total: 0,
        totalPages: 1,
      });
    } finally {
      setLoading(false);
    }
  }, [documentId, enabled, limit, page, search]);

  useEffect(() => {
    void loadCopies();
  }, [loadCopies]);

  return useMemo(
    () => ({
      copies,
      loading,
      error,
      pagination,
      refresh: loadCopies,
    }),
    [copies, error, loading, loadCopies, pagination],
  );
};
