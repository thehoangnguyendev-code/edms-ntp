import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider, useNavigate } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import { UnsavedChangesPopGuard } from '../UnsavedChangesPopGuard';
import { allowNextLeave, useReportUnsavedChanges } from '@/hooks/useReportUnsavedChanges';

afterEach(cleanup);

const Form: React.FC<{ dirty: boolean }> = ({ dirty }) => {
  const navigate = useNavigate();
  useReportUnsavedChanges('test-form', dirty);
  return (
    <div>
      <p>form page</p>
      <button onClick={() => navigate('/other')}>push</button>
    </div>
  );
};

const mount = (dirty: boolean) => {
  const router = createMemoryRouter(
    [
      {
        path: '*',
        element: (
          <>
            <UnsavedChangesPopGuard />
            <Form dirty={dirty} />
          </>
        ),
      },
    ],
    { initialEntries: ['/list', '/form'], initialIndex: 1 },
  );
  render(<RouterProvider router={router} />);
  return router;
};

describe('the browser Back button asks while a screen holds unsaved changes', () => {
  it('goes back at once when nothing was changed', async () => {
    const router = mount(false);
    await act(async () => { await router.navigate(-1); });
    expect(router.state.location.pathname).toBe('/list');
    expect(screen.queryByText('Leave without saving?')).toBeNull();
  });

  it('asks on Back when something was changed; Stay keeps the page', async () => {
    const router = mount(true);
    await act(async () => { await router.navigate(-1); });
    expect(await screen.findByText('Leave without saving?')).toBeTruthy();
    expect(router.state.location.pathname).toBe('/form');
    fireEvent.click(screen.getByRole('button', { name: 'Stay on page' }));
    await waitFor(() => expect(screen.queryByText('Leave without saving?')).toBeNull());
    expect(router.state.location.pathname).toBe('/form');
    expect(screen.getByText('form page')).toBeTruthy();
  });

  it('Leave Anyway lets the Back happen', async () => {
    const router = mount(true);
    await act(async () => { await router.navigate(-1); });
    fireEvent.click(await screen.findByRole('button', { name: 'Leave Anyway' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/list'));
  });

  it('a link to another page (a push) is not asked here: the screens ask for those themselves', async () => {
    const router = mount(true);
    fireEvent.click(screen.getByRole('button', { name: 'push' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/other'));
    expect(screen.queryByText('Leave without saving?')).toBeNull();
  });

  it('a Back that the screen has just confirmed itself is not asked a second time', async () => {
    const router = mount(true);
    allowNextLeave();
    await act(async () => { await router.navigate(-1); });
    expect(router.state.location.pathname).toBe('/list');
    expect(screen.queryByText('Leave without saving?')).toBeNull();
  });
});
