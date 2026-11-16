import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { downloadTableExcel } from '../tableExport';
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
    await downloadTableExcel('documents', { search: 'SOP', status: 'EFFECTIVE', sortBy: 'documentNumber', sortDirection: 'asc' });
    expect(api.get).toHaveBeenCalledWith('/table-exports/documents', expect.objectContaining({ responseType: 'blob', params: expect.objectContaining({ search: 'SOP' }) }));
    expect(filename).toBe('All_Document_14112026_1119.xlsx');
    expect(URL.createObjectURL).toHaveBeenCalledWith(blob);
    vi.runAllTimers();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test');
    expect(document.querySelector('a')).toBeNull();
  });
  it('does not download an error or an invalid server filename', async () => {
    vi.mocked(api.get).mockResolvedValue(response(new Blob(['error']), 'bad.csv'));
    await expect(downloadTableExcel('users', {})).rejects.toThrow('valid Excel filename');
    expect(HTMLAnchorElement.prototype.click).not.toHaveBeenCalled();
  });
  it('propagates an authorization failure without creating a download', async () => {
    vi.mocked(api.get).mockRejectedValue(new Error('Forbidden'));
    await expect(downloadTableExcel('access-profiles', {})).rejects.toThrow('Forbidden');
    expect(HTMLAnchorElement.prototype.click).not.toHaveBeenCalled();
  });
});
