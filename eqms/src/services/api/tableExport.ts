import { api } from './client';

export type TableExportDataset = 'documents' | 'revisions' | 'controlled-copies' | 'users' | 'notifications' | 'access-profiles' | 'permission-sets' | 'audit-trail' | 'backups' | 'backup-rehearsals' | 'production-restores';

/** The server owns authorization, the complete query, workbook contents and filename. */
export async function downloadTableExcel(dataset: TableExportDataset, params: Record<string, unknown>) {
  const response = await api.get<Blob>(`/table-exports/${dataset}`, { params, responseType: 'blob', timeout: 0 });
  const disposition = String(response.headers['content-disposition'] ?? '');
  const filename = /filename="?([^";]+)"?/i.exec(disposition)?.[1];
  if (!filename || !/^[\w-]+_\d{8}_\d{4}\.xlsx$/.test(filename)) {
    throw new Error('The server did not return a valid Excel filename');
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
