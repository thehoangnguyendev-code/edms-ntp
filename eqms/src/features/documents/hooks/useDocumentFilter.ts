/**
 * useDocumentFilter
 * 
 * Reusable hook for filtering document/revision lists with common patterns:
 * - Search across multiple fields
 * - Status, type, department filtering
 * - Date range filtering (dd/MM/yyyy format)
 * - Boolean filters (hasRelatedDocuments, etc.)
 * 
 * Supports composition via customFilterFn for view-specific logic.
 * Used for client-side filtering on datasets that have already been loaded from the API.
 */

import { useMemo, useState } from 'react';
import { parseDMYStart, parseDMYEnd } from '@/lib/date';

export interface FilterConfig {
  status?: string | null;
  type?: string | null;
  businessUnit?: string | null;
  department?: string | null;
  author?: string | null;
  createdFromDate?: string;
  createdToDate?: string;
  effectiveFromDate?: string;
  effectiveToDate?: string;
  validFromDate?: string;
  validToDate?: string;
  relatedDocument?: string | null;
  correlatedDocument?: string | null;
  template?: string | null;
  [key: string]: unknown; // Allow custom filters
}

interface FilterItem {
  [key: string]: unknown;
  created?: string;
  effectiveDate?: string;
  validUntil?: string;
  status?: string;
  type?: string;
  businessUnit?: string;
  department?: string;
  author?: string;
  hasRelatedDocuments?: boolean;
  hasCorrelatedDocuments?: boolean;
  isTemplate?: boolean;
}

type CustomFilterFn<T> = (
  item: T,
  searchQuery: string,
  config: FilterConfig
) => boolean;

export function useDocumentFilter<T extends Record<string, any>>(
  data: T[],
  config: {
    searchFields: (keyof T)[];
    searchQuery: string;
    filters: FilterConfig;
    customFilterFn?: CustomFilterFn<T>;
  }
): T[] {
  const { searchFields, searchQuery, filters, customFilterFn } = config;

  const filteredData = useMemo(() => {
    return data.filter((item) => {
      // Custom filter (for view-specific logic like reviewer checks)
      if (customFilterFn && !customFilterFn(item, searchQuery, filters)) {
        return false;
      }

      // Search query across specified fields
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch = searchFields.some((field) => {
        const value = item[field];
        if (value === null || value === undefined) return false;
        return String(value).toLowerCase().includes(searchLower);
      });

      if (!matchesSearch) return false;

      // Status filter
      if (filters.status && filters.status !== 'All') {
          const itemStatus = item.status ?? item.state;
          if (itemStatus !== filters.status) return false;
      }

      // Type filter
      if (filters.type && filters.type !== 'All') {
        if (item.type !== filters.type) return false;
      }

      // Business unit filter
      if (filters.businessUnit && filters.businessUnit !== 'All') {
        if (item.businessUnit !== filters.businessUnit) return false;
      }

      // Department filter
      if (filters.department && filters.department !== 'All') {
        if (item.department !== filters.department) return false;
      }

      // Author filter
      if (filters.author && filters.author !== 'All') {
        if (item.author !== filters.author) return false;
      }

      // Date range filtering
      if (filters.createdFromDate || filters.createdToDate) {
        const itemDate = item.created ? new Date(item.created) : null;
        if (!itemDate) return false;

        if (filters.createdFromDate) {
          const from = parseDMYStart(filters.createdFromDate);
          if (from && itemDate < from) return false;
        }

        if (filters.createdToDate) {
          const to = parseDMYEnd(filters.createdToDate);
          if (to && itemDate > to) return false;
        }
      }

      if (filters.effectiveFromDate || filters.effectiveToDate) {
        const itemDate = item.effectiveDate ? new Date(item.effectiveDate) : null;
        if (!itemDate) return false;

        if (filters.effectiveFromDate) {
          const from = parseDMYStart(filters.effectiveFromDate);
          if (from && itemDate < from) return false;
        }

        if (filters.effectiveToDate) {
          const to = parseDMYEnd(filters.effectiveToDate);
          if (to && itemDate > to) return false;
        }
      }

      if (filters.validFromDate || filters.validToDate) {
        const itemDate = item.validUntil ? new Date(item.validUntil) : null;
        if (!itemDate) return false;

        if (filters.validFromDate) {
          const from = parseDMYStart(filters.validFromDate);
          if (from && itemDate < from) return false;
        }

        if (filters.validToDate) {
          const to = parseDMYEnd(filters.validToDate);
          if (to && itemDate > to) return false;
        }
      }

      // Boolean filters (hasRelatedDocuments, etc.)
      if (filters.relatedDocument && filters.relatedDocument !== 'All') {
        const hasRelated = !!item.hasRelatedDocuments;
        const filterYes = filters.relatedDocument === 'yes';
        if (filterYes !== hasRelated) return false;
      }

      if (filters.correlatedDocument && filters.correlatedDocument !== 'All') {
        const hasCorrelated = !!item.hasCorrelatedDocuments;
        const filterYes = filters.correlatedDocument === 'yes';
        if (filterYes !== hasCorrelated) return false;
      }

      if (filters.template && filters.template !== 'All') {
        const isTemplate = !!item.isTemplate;
        const filterYes = filters.template === 'yes';
        if (filterYes !== isTemplate) return false;
      }

      return true;
    });
  }, [data, searchQuery, filters, searchFields, customFilterFn]);

  return filteredData;
}
