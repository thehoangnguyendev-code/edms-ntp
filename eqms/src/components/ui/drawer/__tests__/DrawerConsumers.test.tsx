import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { VersionHistoryDrawer } from '@/features/training/materials/components/VersionHistoryDrawer';
import { LearningHistoryDrawer } from '@/features/training/records-archive/components/LearningHistoryDrawer';
import { CellDetailDrawer } from '@/features/training/compliance-tracking/components/matrix/CellDetailDrawer';
import { HeaderActionDrawer } from '@/features/training/compliance-tracking/components/matrix/HeaderActionDrawer';
import { AccessProfilePermissionSetDrawer } from '@/features/security-authorization/access-profiles/views/tabs/AccessProfilePermissionSetDrawer';
import { WorkflowRoleDrawer } from '@/features/security-authorization/access-profiles/views/tabs/accessProfileDetailShared';
import { ROUTES } from '@/app/routes.constants';

const api = vi.hoisted(() => ({
  getPermissionSet: vi.fn().mockResolvedValue({ permissionCodes: ['documents.view'] }),
  getPermissionCatalog: vi.fn().mockResolvedValue([{ name: 'Document permissions', permissions: [{ code: 'documents.view', name: 'View documents', module: 'Documents', description: 'View only', lifecycleUsages: [] }] }]),
  navigate: vi.fn(),
}));
vi.mock('@/services/api/settings', () => ({ settingsApi: api }));
vi.mock('react-router-dom', async original => ({ ...await original<typeof import('react-router-dom')>(), useNavigate: () => api.navigate }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });
const employee = { id: 'EMP001', fullName: 'Employee A', employeeCode: 'EMP001', email: 'a@example.test', department: 'QA', position: 'Reviewer', hireDate: '2026-01-01' };
const sop = { id: 'SOP001', title: 'Review procedure', documentNumber: 'SOP001', materialNumber: 'MAT001', materialName: 'Material', category: 'GMP' } as any;

describe('Non-filter drawer consumers preserve their content and handlers', () => {
  it('keeps version history and its expansion controls in the shared shell', async () => {
    const onClose = vi.fn();
    render(<VersionHistoryDrawer material={{ title: 'Material A', materialNumber: 'MAT001', versionHistory: [
      { version: '1', status: 'Effective', uploadedAt: '2026-10-01', uploadedBy: 'Author A' },
      { version: '2', status: 'Draft', uploadedAt: '2026-10-02', uploadedBy: 'Author B' },
    ] } as any} onClose={onClose} />);
    expect(screen.getByRole('dialog', { name: 'Material A' })).toHaveClass('rounded-2xl');
    expect(screen.getByText('2 Revisions')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Expand All' }));
    expect(screen.getByRole('button', { name: 'Collapse All' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^Close$/ }));
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
  });

  it('keeps learning records and does not lock scrolling for a closed Learning drawer', () => {
    const data = { employeeName: 'Employee A', employeeId: 'EMP001', completedCourses: [{
      id: 'course1', courseCode: 'SOP001', version: '1', status: 'Pass', completionDate: '2026-10-01', score: 90, passingScore: 80,
    }] } as any;
    const { rerender } = render(<LearningHistoryDrawer isOpen employee={data} onClose={vi.fn()} />);
    expect(screen.getByRole('dialog', { name: 'Employee A' })).toBeInTheDocument();
    expect(screen.getByText('Training Outcome')).toBeInTheDocument();
    rerender(<LearningHistoryDrawer isOpen employee={null} onClose={vi.fn()} />);
    expect(document.body.style.overflow).not.toBe('hidden');
    rerender(<LearningHistoryDrawer isOpen={false} employee={data} onClose={vi.fn()} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(document.body.style.overflow).not.toBe('hidden');
  });

  it('renders Training Matrix cell details and preserves employee assignment navigation', async () => {
    render(<MemoryRouter><CellDetailDrawer employee={employee} sop={sop} cell={{ employeeId: 'EMP001', sopId: 'SOP001', status: 'Required', lastTrainedDate: null, expiryDate: null, score: null, attempts: 0 }} onClose={vi.fn()} /></MemoryRouter>);
    expect(screen.getByRole('dialog', { name: 'Required' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Assign Training' }));
    await waitFor(() => expect(api.navigate).toHaveBeenCalledWith(expect.stringContaining(ROUTES.TRAINING.ASSIGNMENT_NEW)), { timeout: 1500 });
  });

  it.each(['employee', 'sop'] as const)('keeps HeaderActionDrawer %s details and assignment target', async type => {
    render(<MemoryRouter><HeaderActionDrawer type={type} data={type === 'employee' ? employee : sop} onClose={vi.fn()} /></MemoryRouter>);
    expect(screen.getByRole('dialog', { name: type === 'employee' ? 'Employee A' : 'Review procedure' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Assign Training' }));
    await waitFor(() => expect(api.navigate).toHaveBeenCalledWith(ROUTES.TRAINING.ASSIGNMENT_NEW + (type === 'employee' ? '?employeeId=EMP001' : '?courseId=SOP001')), { timeout: 1500 });
  });

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
