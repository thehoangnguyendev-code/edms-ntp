import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { PreviewFileTab } from '../PreviewFileTab';
import type { DocumentConfig, OnlyOfficeStorageConfig } from '../../types';

describe('PDF annotation policy editor', () => {
  it('defaults to disabled and stages the change without dropping other PDF settings', () => {
    const onDocumentsChange = vi.fn();
    const documentsConfig = {
      enableWatermark: true,
      pdfPreview: { defaultZoom: 'page-width', showInsertTools: true },
    } as DocumentConfig;
    render(<PreviewFileTab documentsConfig={documentsConfig} onDocumentsChange={onDocumentsChange}
      onlyOfficeConfig={{} as OnlyOfficeStorageConfig} onOnlyOfficeChange={vi.fn()} />);
    const checkbox = screen.getByRole('checkbox', { name: 'Allow annotations and comments' });
    expect(checkbox).not.toBeChecked();
    fireEvent.click(checkbox);
    expect(onDocumentsChange).toHaveBeenCalledWith({
      ...documentsConfig,
      pdfPreview: { ...documentsConfig.pdfPreview, allowAnnotations: true },
    });
    // The editor is controlled: only the parent's saved/draft state changes the checkbox.
    expect(checkbox).not.toBeChecked();
  });
});
