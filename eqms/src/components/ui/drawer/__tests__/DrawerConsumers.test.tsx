import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WorkflowRoleDrawer } from '@/features/security-authorization/access-profiles/views/tabs/accessProfileDetailShared';

// The drawer leaves with a 0.35 to 0.5 second animation driven by the browser's frame clock; on a busy machine (the whole suite running in parallel) that can outlast the default 1 second of waitFor.
const EXIT_WAIT = { timeout: 4000 }; // below the 5 second limit of a test

afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe('Non-filter drawer consumers preserve their content and handlers', () => {
  it('keeps workflow policy details read-only and excludes inactive actions as before', async () => {
    const onClose = vi.fn();
    render(<WorkflowRoleDrawer role={{ code: 'REVIEWER', label: 'Reviewer', policies: [
      { active: true, actionCode: 'REVIEW', actionLabel: 'Review document', fromStatus: 'PENDING_REVIEW' },
      { active: false, actionCode: 'APPROVE', actionLabel: 'Approve document', fromStatus: 'PENDING_APPROVAL' },
    ] }} onClose={onClose} />);
    expect(screen.getByRole('dialog', { name: 'Reviewer' })).toBeInTheDocument();
    expect(screen.getByText('Review document')).toBeInTheDocument(); expect(screen.queryByText('Approve document')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^Close$/ }));
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce(), EXIT_WAIT);
  });
});
