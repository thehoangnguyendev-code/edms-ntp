import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ getComponents: vi.fn(), createComponent: vi.fn(), updateComponent: vi.fn(), toast: vi.fn() }));
vi.mock('@/services/api/documentNameFormat', () => ({ documentNameFormatApi: { getComponents: mocks.getComponents, createComponent: mocks.createComponent, updateComponent: mocks.updateComponent } }));
vi.mock('@/components/ui/toast', () => ({ useToast: () => ({ showToast: mocks.toast }) }));
vi.mock('@/components/ui/page/PageHeader', () => ({
  PageHeader: ({ title, actions }: any) => (<header><h1>{title}</h1>{actions}</header>),
}));
vi.mock('@/components/ui/modal/NavigationGuardModal', () => ({
  NavigationGuardModal: ({ isOpen, onClose, onConfirm }: any) =>
    isOpen ? <div role="dialog">Leave without saving?<button onClick={onClose}>Stay</button><button onClick={onConfirm}>Leave</button></div> : null,
}));

import { DocumentComponentEditorView } from '../DocumentComponentEditorView';

const Where = () => {
  const location = useLocation();
  return <p data-testid="where" data-state={JSON.stringify(location.state)}>{location.pathname}</p>;
};
const mount = (state?: unknown) =>
  render(
    <MemoryRouter initialEntries={[{ pathname: '/documents/administration/document-components/new', state }]}>
      <Routes>
        <Route path="/documents/administration/document-components/new" element={<DocumentComponentEditorView />} />
        <Route path="*" element={<p>elsewhere</p>} />
      </Routes>
      <Where />
    </MemoryRouter>,
  );

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getComponents.mockResolvedValue([]);
});
afterEach(cleanup);

describe('the document component form, opened from the name format editor, asks before it gives the draft back', () => {
  it('an untouched form hands the draft straight back, with the state the editor sent', async () => {
    mount({ returnTo: '/documents/administration/name-formats/new', draft: { name: 'A format in progress' } });
    fireEvent.click(await screen.findByRole('button', { name: /Back/ }));
    expect(screen.getByTestId('where').textContent).toBe('/documents/administration/name-formats/new');
    expect(screen.getByTestId('where').getAttribute('data-state')).toBe('{"draft":{"name":"A format in progress"}}');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('a typed name makes Back ask, and the draft still goes back after the confirmation', async () => {
    mount({ returnTo: '/documents/administration/name-formats/new', draft: { name: 'A format in progress' } });
    const inputs = await screen.findAllByRole('textbox');
    fireEvent.change(inputs[0], { target: { value: 'Typed component' } });
    fireEvent.click(screen.getByRole('button', { name: /Back/ }));
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByTestId('where').textContent).toBe('/documents/administration/document-components/new');
    fireEvent.click(screen.getByRole('button', { name: 'Leave' }));
    expect(screen.getByTestId('where').textContent).toBe('/documents/administration/name-formats/new');
    expect(screen.getByTestId('where').getAttribute('data-state')).toBe('{"draft":{"name":"A format in progress"}}');
  });
});
