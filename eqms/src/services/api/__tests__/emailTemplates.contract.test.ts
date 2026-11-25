import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EmailTemplatePayload } from '@/features/settings/notifications/emailTemplateTypes';

const http = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() }));
vi.mock('../client', () => ({ api: http }));
import { emailTemplateApi } from '../emailTemplates';

beforeEach(() => {
  vi.resetAllMocks();
  Object.values(http).forEach(method => method.mockResolvedValue({ data: { id: 'message-id' } }));
});

describe('email API contract after moving shared definitions', () => {
  const base = '/settings/email-templates';
  it('keeps the server endpoint and all list filters unchanged', async () => {
    const params = { search: 'review', page: 2, limit: 10, status: 'Active' as const };
    await emailTemplateApi.getEmailTemplates(params);
    expect(http.get).toHaveBeenCalledWith(base, { params });
    await emailTemplateApi.getEmailTemplate('message-id');
    expect(http.get).toHaveBeenLastCalledWith(`${base}/message-id`);
  });

  it('forwards wording, variables, signature and concurrency fields without modification', async () => {
    const payload: EmailTemplatePayload = {
      name: 'Review request', type: 'document-review', status: 'Draft',
      subject: 'Review {{documentNumber}}', content: '<p>{{userName}}</p>', variables: ['documentNumber', 'userName'],
      reason: 'Updated wording', signatureToken: 'test-signature', expectedUpdatedDate: '2026-11-25T01:00:00Z',
    };
    await emailTemplateApi.updateEmailTemplate('message-id', payload);
    expect(http.put).toHaveBeenCalledWith(`${base}/message-id`, payload);
    expect(http.put.mock.calls[0][1]).toBe(payload);
    await emailTemplateApi.previewDraftEmailTemplate({ ...payload, sampleVariables: { userName: 'Reviewer' } });
    expect(http.post).toHaveBeenLastCalledWith(`${base}/preview-draft`, { ...payload, sampleVariables: { userName: 'Reviewer' } });
  });

  it('preserves explicit test-send, publish and version restore requests', async () => {
    const testSend = { to: 'reviewer@example.test', variables: { documentNumber: 'SOP.0001' } };
    await emailTemplateApi.testSendEmailTemplate('message-id', testSend);
    expect(http.post).toHaveBeenLastCalledWith(`${base}/message-id/test-send`, testSend);
    await emailTemplateApi.publishEmailTemplate('message-id', { changeSummary: 'Approved' });
    expect(http.post).toHaveBeenLastCalledWith(`${base}/message-id/publish`, { changeSummary: 'Approved' });
    await emailTemplateApi.restoreEmailTemplateVersion('message-id', 'version-id', { changeSummary: 'Restore wording' });
    expect(http.post).toHaveBeenLastCalledWith(`${base}/message-id/versions/version-id/restore`, { changeSummary: 'Restore wording' });
  });

  it('propagates server refusal without sending another request', async () => {
    const denied = new Error('Forbidden');
    http.post.mockRejectedValueOnce(denied);
    await expect(emailTemplateApi.testSendEmailTemplate('message-id', { to: 'reviewer@example.test' })).rejects.toBe(denied);
    expect(http.post).toHaveBeenCalledTimes(1);
  });
});
