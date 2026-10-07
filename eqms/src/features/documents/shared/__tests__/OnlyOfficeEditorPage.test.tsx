import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { OnlyOfficeEditorPage } from '../pages/OnlyOfficeEditorPage';
vi.mock('../components/OnlyOfficeEditorFrame', () => ({
  OnlyOfficeEditorFrame: ({ revisionId }: { revisionId: string }) => <div data-testid="docx-editor">{revisionId}</div>,
}));
const open = (query = '') => render(<MemoryRouter initialEntries={['/revisions/rev-1' + query]}>
  <Routes><Route path="/revisions/:revisionId" element={<OnlyOfficeEditorPage />} /></Routes>
</MemoryRouter>);
describe('Online editor after eForm retirement', () => {
  it.each(['', '?format=docx'])('keeps DOCX authoring/review URLs working: %s', query => {
    open(query);
    expect(screen.getByTestId('docx-editor')).toHaveTextContent('rev-1');
  });
  it.each(['?format=docxf', '?format=pdf'])('blocks retired or unsupported formats: %s', query => {
    open(query);
    expect(screen.getByRole('alert')).toHaveTextContent('Electronic Forms have been retired');
    expect(screen.queryByTestId('docx-editor')).not.toBeInTheDocument();
  });
});
