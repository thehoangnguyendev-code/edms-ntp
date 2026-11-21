import { api } from './client';

export type TableExportDataset = 'documents' | 'revisions' | 'controlled-copies' | 'users' | 'notifications' | 'access-profiles' | 'permission-sets' | 'audit-trail' | 'backups' | 'backup-rehearsals' | 'production-restores';

export type TableExportFormat = 'xlsx' | 'csv';

/** What the person chose in the Export dialog. Without a column list the file holds every column. */
export interface TableExportOptions {
  format: TableExportFormat;
  columns?: string[];
}

/** Separates the chosen column names in the request; no column name contains it. */
const COLUMN_SEPARATOR = '|';

/** The column names the server writes for a register, in file order. The server owns them, so the dialog never keeps its own copy. */
export async function fetchTableExportColumns(dataset: Exclude<TableExportDataset, 'audit-trail'>): Promise<string[]> {
  const response = await api.get<{ columns: string[] }>(`/table-exports/${dataset}/columns`);
  return response.data.columns;
}

/** The server owns authorization, the complete query, file contents and filename. */
export async function downloadTableExport(dataset: TableExportDataset, params: Record<string, unknown>, options: TableExportOptions = { format: 'xlsx' }) {
  const query: Record<string, unknown> = { ...params, format: options.format };
  if (options.columns) query.columns = options.columns.join(COLUMN_SEPARATOR);
  const response = await api.get<Blob>(`/table-exports/${dataset}`, { params: query, responseType: 'blob', timeout: 0 });
  const disposition = String(response.headers['content-disposition'] ?? '');
  const filename = /filename="?([^";]+)"?/i.exec(disposition)?.[1];
  const extension = options.format === 'csv' ? 'csv' : 'xlsx';
  if (!filename || !new RegExp(`^[\\w-]+_\\d{8}_\\d{4}\\.${extension}$`).test(filename)) {
    throw new Error(`The server did not return a valid ${options.format === 'csv' ? 'CSV' : 'Excel'} filename`);
  }
  const url = URL.createObjectURL(response.data);
  const link = document.createElement('a');
  try {
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
  } finally {
    link.remove();
    // Give the browser time to acquire the Blob before releasing its URL.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
