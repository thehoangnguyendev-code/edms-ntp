/**
 * useTableSort
 * 
 * Reusable hook for table sorting with support for:
 * - String fields (case-insensitive)
 * - Numeric fields
 * - Date fields (ISO or dd/MM/yyyy format)
 * - Ascending/descending order
 *
 * Used for client-side sorting on datasets that have already been loaded from the API.
 */

import { useMemo, useState } from 'react';

export interface SortConfig {
  key: string;
  direction: 'asc' | 'desc';
}

/**
 * Parse date string (ISO or dd/MM/yyyy format) into comparable number (milliseconds)
 */
function parseDate(dateStr: unknown): number {
  if (!dateStr || typeof dateStr !== 'string') return 0;
  
  // Try ISO format first
  const isoDate = new Date(dateStr);
  if (!isNaN(isoDate.getTime())) {
    return isoDate.getTime();
  }
  
  // Try dd/MM/yyyy format
  const dmy = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (dmy) {
    const parsed = new Date(+dmy[3], +dmy[2] - 1, +dmy[1]);
    return parsed.getTime();
  }
  
  return 0;
}

/**
 * Compare two values for sorting
 */
function compareValues(
  a: unknown,
  b: unknown,
  direction: 'asc' | 'desc',
  dateFields?: string[]
): number {
  const isDateField = dateFields?.length && dateFields.length > 0;
  
  // Date comparison
  if (isDateField) {
    const aTime = parseDate(a);
    const bTime = parseDate(b);
    const result = aTime - bTime;
    return direction === 'asc' ? result : -result;
  }
  
  // Number comparison
  if (typeof a === 'number' && typeof b === 'number') {
    const result = a - b;
    return direction === 'asc' ? result : -result;
  }
  
  // String comparison (case-insensitive)
  const aStr = String(a ?? '').toLowerCase();
  const bStr = String(b ?? '').toLowerCase();
  const result = aStr.localeCompare(bStr);
  return direction === 'asc' ? result : -result;
}

export function useTableSort<T extends Record<string, any>>(
  data: T[],
  config: {
    sortConfig: SortConfig;
    dateFields?: string[]; // Names of fields that contain dates
  }
): T[] {
  const { sortConfig, dateFields } = config;

  const sortedData = useMemo(() => {
    if (!sortConfig.key || data.length === 0) {
      return data;
    }

    const sorted = [...data].sort((a, b) => {
      const aVal = a[sortConfig.key];
      const bVal = b[sortConfig.key];
      return compareValues(aVal, bVal, sortConfig.direction, dateFields);
    });

    return sorted;
  }, [data, sortConfig, dateFields]);

  return sortedData;
}
