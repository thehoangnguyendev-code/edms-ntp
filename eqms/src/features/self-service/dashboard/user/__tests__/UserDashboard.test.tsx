import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DashboardAdminStats, DashboardPendingWorkflowAction, DashboardSummary } from '@/services/api/dashboard';

const api = vi.hoisted(() => ({
  getSummary: vi.fn(),
  getPendingWorkflowActions: vi.fn(),
  getDocumentActivity: vi.fn(),
  getAdminStats: vi.fn(),
  getRecentActivity: vi.fn(),
  getEffectiveDocumentsByType: vi.fn(),
}));

const documents = vi.hoisted(() => ({ getDocumentsPage: vi.fn() }));

vi.mock('@/services/api/dashboard', () => ({ dashboardApi: api }));
vi.mock('@/services/api/documents', () => ({ documentApi: documents }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { firstName: 'Ada', lastName: 'Lovelace', username: 'ada' } }) }));
vi.mock('@/features/documents/shared/useDocumentPermissions', () => ({ useDocumentPermissions: () => ({ canCreateDocumentShell: true }) }));

import { UserDashboard } from '../UserDashboard';

const task = (id: number, taskType: 'REVIEW' | 'APPROVAL' = 'REVIEW'): DashboardPendingWorkflowAction => ({
  revisionId: `r${id}`, documentId: `d${id}`, documentNumber: `SOP-${id}`, documentName: `Procedure ${id}`,
  revisionNumber: '1', status: 'PENDING_REVIEW', taskType, createdAt: '2026-10-01T00:00:00Z',
});

// Field names mirror com.eqms.dto.dashboard.DashboardSummaryResponse.
const summary: DashboardSummary = {
  totalEffectiveDocuments: 30, pendingReview: 40, pendingApproval: 30, pendingTraining: 5, myPendingTasks: 35, totalDocuments: 100,
};

const stats: DashboardAdminStats = {
  totalUsers: 10, activeUsers: 7, inactiveUsers: 3, totalDocuments: 100,
  documentsByStatus: { ACTIVE: 60, DRAFT: 20, OBSOLETED: 5, CLOSED_CANCELLED: 5 },
  revisionsByStatus: { PENDING_REVIEW: 4, PENDING_APPROVAL: 2, PENDING_TRAINING: 1, READY_FOR_PUBLISHING: 3 },
  auditEventsLast30Days: 12, auditActivityByDay: [{ label: '01 Oct', value: 12 }],
};

const renderInRouter = (node: React.ReactNode) => render(<MemoryRouter>{node}</MemoryRouter>);

beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset());
  api.getDocumentActivity.mockResolvedValue([]);
  api.getEffectiveDocumentsByType.mockResolvedValue([]);
  documents.getDocumentsPage.mockReset();
  documents.getDocumentsPage.mockResolvedValue({ data: [], pagination: { page: 1, limit: 1, total: 0, totalPages: 0 } });
});

describe('UserDashboard figures', () => {
  it('uses the summary total, not the capped task list', async () => {
    api.getSummary.mockResolvedValue(summary);
    api.getPendingWorkflowActions.mockResolvedValue(Array.from({ length: 20 }, (_, i) => task(i)));
    renderInRouter(<UserDashboard />);

    // 35 assigned of (40 review + 30 approval) awaiting action = 50%
    expect(await screen.findByText('35 assigned to you · 50% of the 70 revisions awaiting review or approval')).toBeInTheDocument();
    expect(await screen.findByText('Showing 20 of 35 items.')).toBeInTheDocument();
    expect(screen.getAllByRole('row')).toHaveLength(1 + 20);
  });

  it('shows every action and no "showing" note when the list is complete', async () => {
    api.getSummary.mockResolvedValue({ ...summary, myPendingTasks: 2 });
    api.getPendingWorkflowActions.mockResolvedValue([task(1), task(2, 'APPROVAL')]);
    renderInRouter(<UserDashboard />);
    expect(await screen.findByText('Procedure 2')).toBeInTheDocument();
    expect(screen.queryByText(/^Showing /)).toBeNull();
  });

  it('computes workflow shares from the open items', async () => {
    api.getSummary.mockResolvedValue(summary);
    api.getPendingWorkflowActions.mockResolvedValue([]);
    renderInRouter(<UserDashboard />);
    // 40 of 75 open items
    expect(await screen.findByText('53% of open')).toBeInTheDocument();
    expect(screen.getByText('30% of all')).toBeInTheDocument();
    // 35 of the 70 revisions awaiting review or approval are assigned to this user
    expect(screen.getByText('50% of awaiting')).toBeInTheDocument();
    expect(screen.getByText('Awaiting review or approval')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Review: 40, Share of open items' })).toBeInTheDocument();
  });

  it('filters loaded actions by search and says so when nothing matches', async () => {
    api.getSummary.mockResolvedValue({ ...summary, myPendingTasks: 2 });
    api.getPendingWorkflowActions.mockResolvedValue([task(1), task(2)]);
    renderInRouter(<UserDashboard />);
    await screen.findByText('Procedure 1');
    fireEvent.change(screen.getByLabelText('Search pending work'), { target: { value: 'sop-2' } });
    expect(screen.queryByText('Procedure 1')).toBeNull();
    expect(screen.getByText('Procedure 2')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Search pending work'), { target: { value: 'zzz' } });
    expect(screen.getByText('No document matches your search')).toBeInTheDocument();
  });

  it('shows a dash and an error instead of zeros when the summary cannot be loaded', async () => {
    api.getSummary.mockRejectedValue(new Error('boom'));
    api.getPendingWorkflowActions.mockResolvedValue([]);
    renderInRouter(<UserDashboard />);
    expect(await screen.findByText('Totals could not be loaded.')).toBeInTheDocument();
    expect(screen.queryByLabelText('0')).toBeNull();
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(4);
  });
});

