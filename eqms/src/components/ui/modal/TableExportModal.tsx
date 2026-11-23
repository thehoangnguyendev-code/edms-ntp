import React, { useEffect, useMemo, useState } from 'react';
import { IconFileTypeCsv, IconFileTypeXls } from '@tabler/icons-react';
import { FormModal } from './FormModal';
import { Checkbox } from '../checkbox';
import { VisibilityOptions } from '../radio/VisibilityOptions';
import { fetchTableExportColumns, type TableExportDataset, type TableExportFormat, type TableExportOptions } from '@/services/api/tableExport';
import { tr, trFormat } from "@/i18n";

export interface TableExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** The register being exported; the server tells which columns its file can hold. */
  dataset: Exclude<TableExportDataset, 'audit-trail'>;
  /** Name of the screen's records, shown in the title and the size line ("Documents"). */
  title?: string;
  /** How many records the current filters match, for the size estimate. Leave out when it is not known. */
  totalRecords?: number;
  /** Makes and downloads the file with the screen's current filters. The dialog closes when it returns. */
  onExport: (options: TableExportOptions) => Promise<void>;
}

const FORMATS: { value: TableExportFormat; label: string; description: string; icon: React.ReactNode }[] = [
  { value: 'xlsx', label: 'Excel', description: '.xlsx workbook', icon: <IconFileTypeXls className="h-5 w-5" /> },
  { value: 'csv', label: 'CSV', description: '.csv text file', icon: <IconFileTypeCsv className="h-5 w-5" /> },
];

/** A rough size per cell: an Excel file is zipped, a CSV is plain text (measured on DEV: Excel 5-8 bytes, CSV 12-13 bytes per cell). Only for the "About ..." line; the server makes the real file. */
const BYTES_PER_CELL: Record<TableExportFormat, number> = { xlsx: 7, csv: 13 };
const FIXED_BYTES: Record<TableExportFormat, number> = { xlsx: 6000, csv: 3 };

export function estimateExportBytes(format: TableExportFormat, records: number, columns: number): number {
  // the "No." column is always written
  return FIXED_BYTES[format] + records * (columns + 1) * BYTES_PER_CELL[format];
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes < 10 * 1024 ? 1 : 0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

export const TableExportModal: React.FC<TableExportModalProps> = ({ isOpen, onClose, dataset, title, totalRecords, onExport }) => {
  const [format, setFormat] = useState<TableExportFormat>('xlsx');
  const [allColumns, setAllColumns] = useState<string[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loadError, setLoadError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setFormat('xlsx');
    setLoadError(false);
    setLoading(true);
    fetchTableExportColumns(dataset)
      .then((names) => {
        if (cancelled) return;
        setAllColumns(names);
        setSelected(new Set(names));
      })
      .catch(() => { if (!cancelled) setLoadError(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [isOpen, dataset]);

  const chosen = useMemo(() => allColumns.filter((name) => selected.has(name)), [allColumns, selected]);
  const allChosen = allColumns.length > 0 && chosen.length === allColumns.length;

  const toggle = (name: string, on: boolean) => setSelected((previous) => {
    const next = new Set(previous);
    if (on) next.add(name); else next.delete(name);
    return next;
  });

  const run = async () => {
    setBusy(true);
    try {
      await onExport({ format, columns: allChosen ? undefined : chosen });
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const formatLabel = FORMATS.find((item) => item.value === format)?.label ?? '';
  const sizeLine = totalRecords === undefined
    ? 'The file size is known once it is made'
    : `About ${formatBytes(estimateExportBytes(format, totalRecords, chosen.length))} · ${new Intl.NumberFormat('en-US').format(totalRecords)} ${totalRecords === 1 ? 'record' : 'records'}`;

  return (
    <FormModal
      isOpen={isOpen}
      onClose={() => { if (!busy) onClose(); }}
      onConfirm={() => void run()}
      title={title ? `Export ${title}` : 'Export'}
      description={tr("The file holds every record that matches the filters on the screen.")}
      confirmText={`Export ${formatLabel}`}
      confirmDisabled={loading || loadError || chosen.length === 0}
      isLoading={busy}
      size="lg"
      footerLeft={<span className="text-xs text-slate-500">{sizeLine}</span>}
    >
      <div className="space-y-5">
        <div>
          <p className="mb-2 text-xs font-medium text-slate-500">{tr("Format")}</p>
          <VisibilityOptions name="export-format" value={format} options={FORMATS} onChange={(value) => setFormat(value as TableExportFormat)} />
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="text-xs font-medium text-slate-500">{tr("Columns")}</p>
            {!loading && !loadError && (
              <span className="text-xs text-slate-500">{trFormat("{chosen} of {total} columns", { chosen: chosen.length, total: allColumns.length })}</span>
            )}
          </div>
          {loading && <p className="py-6 text-center text-sm text-slate-500">{tr("Loading columns...")}</p>}
          {loadError && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{tr("The columns could not be loaded. Close this window and try again.")}</p>}
          {!loading && !loadError && (
            <div className="overflow-hidden rounded-xl border border-slate-200">
              <div className="border-b border-slate-200 bg-slate-50 px-3 py-1.5">
                <Checkbox
                  checked={allChosen}
                  indeterminate={chosen.length > 0 && !allChosen}
                  onChange={(on) => setSelected(new Set(on ? allColumns : []))}
                  label={tr("Select all")}
                />
              </div>
              <ul className="max-h-64 divide-y divide-slate-100 overflow-y-auto" aria-label={tr("Columns to export")}>
                {allColumns.map((name) => (
                  <li key={name} className="px-3 py-1.5">
                    <Checkbox checked={selected.has(name)} onChange={(on) => toggle(name, on)} label={name} labelClassName="normal-case" />
                  </li>
                ))}
              </ul>
            </div>
          )}
          {!loading && !loadError && chosen.length === 0 && (
            <p className="mt-2 text-xs text-amber-700">{tr("Select at least one column.")}</p>
          )}
        </div>
      </div>
    </FormModal>
  );
};
