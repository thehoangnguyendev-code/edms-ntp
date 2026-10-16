import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ROUTES } from '@/app/routes.constants';
import { MemoryRouter } from 'react-router-dom';
import { AccessProfilePermissionSetDrawer } from '@/features/security-authorization/access-profiles/views/tabs/AccessProfilePermissionSetDrawer';
import { WorkflowRoleDrawer } from '@/features/security-authorization/access-profiles/views/tabs/accessProfileDetailShared';

const api = vi.hoisted(() => ({
  getPermissionSet: vi.fn().mockResolvedValue({ permissionCodes: ['documents.view'] }),
  getPermissionCatalog: vi.fn().mockResolvedValue([{ name: 'Document permissions', permissions: [{ code: 'documents.view', name: 'View documents', module: 'Documents', description: 'View only', lifecycleUsages: [] }] }]),
  navigate: vi.fn(),
}));
vi.mock('@/services/api/settings', () => ({ settingsApi: api }));
vi.mock('react-router-dom', async original => ({ ...await original<typeof import('react-router-dom')>(), useNavigate: () => api.navigate }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe('Non-filter drawer consumers preserve their content and handlers', () => {
  it('loads only the selected permission set with the existing API and preserves its destination', async () => {
    render(<MemoryRouter><AccessProfilePermissionSetDrawer ps={{ id: 'set-a', name: 'Read only', description: 'Assigned permissions' } as any} onClose={vi.fn()} /></MemoryRouter>);
    expect(screen.getByRole('dialog', { name: 'Read only' })).toBeInTheDocument();
    await screen.findByText('View documents');
    expect(api.getPermissionSet).toHaveBeenCalledWith('set-a');
    fireEvent.click(screen.getByRole('button', { name: 'Open Permission Sets' }));
    expect(api.navigate).toHaveBeenCalledWith(ROUTES.SECURITY.PERMISSION_SETS);
  });

  it('keeps workflow policy details read-only and excludes inactive actions as before', async () => {
    const onClose = vi.fn();
    render(<WorkflowRoleDrawer role={{ code: 'REVIEWER', label: 'Reviewer', policies: [
      { active: true, actionCode: 'REVIEW', actionLabel: 'Review document', fromStatus: 'PENDING_REVIEW' },
      { active: false, actionCode: 'APPROVE', actionLabel: 'Approve document', fromStatus: 'PENDING_APPROVAL' },
    ] }} onClose={onClose} />);
    expect(screen.getByRole('dialog', { name: 'Reviewer' })).toBeInTheDocument();
    expect(screen.getByText('Review document')).toBeInTheDocument(); expect(screen.queryByText('Approve document')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^Close$/ }));
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
  });
});
