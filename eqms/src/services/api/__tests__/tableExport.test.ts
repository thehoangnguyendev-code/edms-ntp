import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { downloadTableExport, fetchTableExportColumns } from '../tableExport';
import { api } from '../client';
import { AxiosHeaders } from 'axios';

vi.mock('../client', () => ({ api: { get: vi.fn() } }));
const response = (data: Blob, filename: string) => ({ data, status: 200, statusText: 'OK', config: { headers: new AxiosHeaders() }, headers: { 'content-disposition': `attachment; filename="${filename}"` } });

describe('server table Excel transport', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:test'), revokeObjectURL: vi.fn() }));
  });
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); vi.clearAllMocks(); });

  it('sends the query to the server and uses its filename without constructing records in FE', async () => {
    const blob = new Blob(['xlsx']);
    vi.mocked(api.get).mockResolvedValue(response(blob, 'All_Document_14112026_1119.xlsx'));
    let filename = '';
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) { filename = this.download; });
    await downloadTableExport('documents', { search: 'SOP', status: 'EFFECTIVE', sortBy: 'documentNumber', sortDirection: 'asc' });
    expect(api.get).toHaveBeenCalledWith('/table-exports/documents', expect.objectContaining({ responseType: 'blob', params: expect.objectContaining({ search: 'SOP' }) }));
    expect(filename).toBe('All_Document_14112026_1119.xlsx');
    expect(URL.createObjectURL).toHaveBeenCalledWith(blob);
    vi.runAllTimers();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test');
    expect(document.querySelector('a')).toBeNull();
  });
  it('asks for a CSV with only the chosen columns, joined into one parameter', async () => {
    vi.mocked(api.get).mockResolvedValue(response(new Blob(['csv']), 'Users_14112026_1119.csv'));
    await downloadTableExport('users', { search: 'a' }, { format: 'csv', columns: ['Full Name', 'Email'] });
    expect(api.get).toHaveBeenCalledWith('/table-exports/users', expect.objectContaining({ params: expect.objectContaining({ search: 'a', format: 'csv', columns: 'Full Name|Email' }) }));
  });
  it('does not accept an Excel filename for a CSV request', async () => {
    vi.mocked(api.get).mockResolvedValue(response(new Blob(['x']), 'Users_14112026_1119.xlsx'));
    await expect(downloadTableExport('users', {}, { format: 'csv' })).rejects.toThrow('valid CSV filename');
    expect(HTMLAnchorElement.prototype.click).not.toHaveBeenCalled();
  });
  it('reads the column names from the server', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { columns: ['Code', 'Name'] } } as never);
    await expect(fetchTableExportColumns('permission-sets')).resolves.toEqual(['Code', 'Name']);
    expect(api.get).toHaveBeenCalledWith('/table-exports/permission-sets/columns');
  });
  it('does not download an error or an invalid server filename', async () => {
    vi.mocked(api.get).mockResolvedValue(response(new Blob(['error']), 'bad.csv'));
    await expect(downloadTableExport('users', {})).rejects.toThrow('valid Excel filename');
    expect(HTMLAnchorElement.prototype.click).not.toHaveBeenCalled();
  });
  it('propagates an authorization failure without creating a download', async () => {
    vi.mocked(api.get).mockRejectedValue(new Error('Forbidden'));
    await expect(downloadTableExport('access-profiles', {})).rejects.toThrow('Forbidden');
    expect(HTMLAnchorElement.prototype.click).not.toHaveBeenCalled();
  });
});
