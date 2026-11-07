import React from 'react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { PreviewFileTab } from '../PreviewFileTab';
import type { DocumentConfig, OnlyOfficeStorageConfig } from '../../types';

beforeAll(() => { window.matchMedia = vi.fn().mockImplementation(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn() })); });

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

describe('watermark angle', () => {
  const documents = (pdfPreview: Record<string, unknown> = {}) => ({ enableWatermark: true, pdfPreview } as unknown as DocumentConfig);
  const renderTab = (config: DocumentConfig, onDocumentsChange = vi.fn()) => render(
    <PreviewFileTab documentsConfig={config} onDocumentsChange={onDocumentsChange}
      onlyOfficeConfig={{} as OnlyOfficeStorageConfig} onOnlyOfficeChange={vi.fn()} />);

  it('starts at the 45 degrees the watermark has always had, with the sample turned the same way and nothing to reset', () => {
    renderTab(documents());
    expect(screen.getByTestId('watermark-angle-value')).toHaveTextContent('45°');
    expect(screen.getByTestId('watermark-sample-mark')).toHaveStyle({ transform: 'rotate(-45deg)' });
    expect(screen.queryByRole('button', { name: 'Reset' })).toBeNull();
  });

  it('turns the sample by the saved angle at once, and offers Reset that stages 45 without dropping other settings', () => {
    const onDocumentsChange = vi.fn();
    renderTab(documents({ watermarkAngle: 30, watermarkColor: '#112233' }), onDocumentsChange);
    expect(screen.getByTestId('watermark-angle-value')).toHaveTextContent('30°');
    expect(screen.getByTestId('watermark-sample-mark')).toHaveStyle({ transform: 'rotate(-30deg)' });

    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    expect(onDocumentsChange).toHaveBeenCalledWith(expect.objectContaining({
      pdfPreview: { watermarkAngle: 45, watermarkColor: '#112233' },
    }));
  });

  it('moves the angle with the slider, and the sample follows as the parent hands the new value back', () => {
    const onDocumentsChange = vi.fn();
    const { rerender } = renderTab(documents(), onDocumentsChange);
    const slider = screen.getByRole('slider', { name: 'Watermark angle' });
    fireEvent.keyDown(slider, { key: 'ArrowLeft' });
    const staged = onDocumentsChange.mock.calls.at(-1)?.[0] as DocumentConfig;
    expect(staged.pdfPreview?.watermarkAngle).toBe(44);

    rerender(<PreviewFileTab documentsConfig={staged} onDocumentsChange={onDocumentsChange}
      onlyOfficeConfig={{} as OnlyOfficeStorageConfig} onOnlyOfficeChange={vi.fn()} />);
    expect(screen.getByTestId('watermark-angle-value')).toHaveTextContent('44°');
    expect(screen.getByTestId('watermark-sample-mark')).toHaveStyle({ transform: 'rotate(-44deg)' });
  });

  it('keeps the angle inside what the server accepts, even for a value outside it', () => {
    renderTab(documents({ watermarkAngle: 400 }));
    expect(screen.getByTestId('watermark-angle-value')).toHaveTextContent('90°');
    expect(screen.getByTestId('watermark-sample-mark')).toHaveStyle({ transform: 'rotate(-90deg)' });
  });

  it('turns every copy of the repeated grid by the same angle', () => {
    renderTab(documents({ watermarkAngle: 20, watermarkTiled: true }));
    const marks = screen.getAllByTestId('watermark-sample-mark');
    expect(marks.length).toBeGreaterThan(1);
    marks.forEach((mark) => expect(mark).toHaveStyle({ transform: 'rotate(-20deg)' }));
  });
});

describe('OnlyOffice Preview: stages and watermark', () => {
  const baseDocuments = { enableWatermark: false, pdfPreview: {} } as unknown as DocumentConfig;
  const renderTab = (viewer: Record<string, unknown> = {}, onOnlyOfficeChange = vi.fn(), documents: DocumentConfig = baseDocuments) => render(
    <PreviewFileTab documentsConfig={documents} onDocumentsChange={vi.fn()}
      onlyOfficeConfig={{ viewer } as unknown as OnlyOfficeStorageConfig} onOnlyOfficeChange={onOnlyOfficeChange} />);

  it('shows Pending Review as Review Mode and Pending Approval as Comment Only until they are set, as it was', () => {
    renderTab();
    expect(screen.getByRole('combobox', { name: 'Pending Review' })).toHaveTextContent('Review Mode');
    expect(screen.getByRole('combobox', { name: 'Pending Approval' })).toHaveTextContent('Comment Only');
    expect(screen.getByText(/Review Mode: the person suggests changes/)).toBeTruthy();
    expect(screen.getByText(/Comment Only: the person can only add comments/)).toBeTruthy();
  });

  it('stages the mode of one stage without dropping the other viewer settings', async () => {
    const onChange = vi.fn();
    renderTab({ showFileName: false, pendingApprovalMode: 'REVIEW' }, onChange);

    fireEvent.click(screen.getByRole('combobox', { name: 'Pending Review' }));
    fireEvent.click(await screen.findByRole('option', { name: 'Comment Only' }));

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      viewer: { showFileName: false, pendingApprovalMode: 'REVIEW', pendingReviewMode: 'COMMENT_ONLY' },
    }));
    expect(screen.getByRole('combobox', { name: 'Pending Approval' })).toHaveTextContent('Review Mode'); // follows the saved value
  });

  it('has its own watermark switch, off by default, and does not open the PDF watermark with it', () => {
    renderTab();
    const switches = screen.getAllByRole('checkbox', { name: 'Enable watermarking' });
    expect(switches).toHaveLength(2); // the OnlyOffice viewer, then the PDF preview
    expect(switches[0]).not.toBeChecked();
    expect(switches[1]).not.toBeChecked();
    expect(screen.queryByTestId('watermark-sample-mark')).toBeNull();
  });

  it('stages the watermark switch of the viewer under the viewer settings, not under the documents', () => {
    const onOnlyOffice = vi.fn();
    renderTab({ showFileName: true }, onOnlyOffice);
    const switches = screen.getAllByRole('checkbox', { name: 'Enable watermarking' });
    expect(switches).toHaveLength(2); // the OnlyOffice viewer and the PDF preview
    fireEvent.click(switches[0]);
    expect(onOnlyOffice).toHaveBeenCalledWith(expect.objectContaining({ viewer: { showFileName: true, watermarkEnabled: true } }));
  });

  it('shows the same editor for the viewer as for the PDF: the text, the angle, what is printed and the grid, with a sample that turns', () => {
    renderTab({ watermarkEnabled: true, watermarkAngle: 20, watermarkText: 'CONTROLLED', watermarkShowViewerName: true });
    expect(screen.getByDisplayValue('CONTROLLED')).toBeTruthy();
    expect(screen.getByTestId('watermark-angle-value')).toHaveTextContent('20°');
    expect(screen.getByTestId('watermark-sample-mark')).toHaveStyle({ transform: 'rotate(-20deg)' });
    expect(screen.getByRole('checkbox', { name: 'Viewer Employee Name' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Repeat the watermark as a grid' })).toBeTruthy();
    expect(screen.getByText(/Example values\. The viewer is filled in when the file is opened\./)).toBeTruthy();
  });

  it('keeps the two editors apart: a change in one does not move the other', () => {
    const onOnlyOffice = vi.fn();
    const onDocuments = vi.fn();
    render(
      <PreviewFileTab
        documentsConfig={{ enableWatermark: true, pdfPreview: { watermarkText: 'PDF TEXT' } } as unknown as DocumentConfig}
        onDocumentsChange={onDocuments}
        onlyOfficeConfig={{ viewer: { watermarkEnabled: true, watermarkText: 'VIEWER TEXT' } } as unknown as OnlyOfficeStorageConfig}
        onOnlyOfficeChange={onOnlyOffice}
      />,
    );
    fireEvent.change(screen.getByDisplayValue('VIEWER TEXT'), { target: { value: 'VIEWER TEXT 2' } });
    expect(onOnlyOffice).toHaveBeenCalledWith(expect.objectContaining({ viewer: expect.objectContaining({ watermarkText: 'VIEWER TEXT 2' }) }));
    expect(onDocuments).not.toHaveBeenCalled();

    fireEvent.change(screen.getByDisplayValue('PDF TEXT'), { target: { value: 'PDF TEXT 2' } });
    expect(onDocuments).toHaveBeenCalledWith(expect.objectContaining({ pdfPreview: expect.objectContaining({ watermarkText: 'PDF TEXT 2' }) }));
  });
});

describe('OnlyOffice Preview: download and print of an editing session', () => {
  const documents = { enableWatermark: false, pdfPreview: {} } as unknown as DocumentConfig;
  const renderTab = (viewer: Record<string, unknown>, onChange = vi.fn()) => render(
    <PreviewFileTab documentsConfig={documents} onDocumentsChange={vi.fn()}
      onlyOfficeConfig={{ viewer } as unknown as OnlyOfficeStorageConfig} onOnlyOfficeChange={onChange} />);

  it('are allowed until they are turned off, as before', () => {
    renderTab({});
    expect(screen.getByRole('checkbox', { name: 'Allow download' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Allow print' })).toBeChecked();
  });

  it('stages each switch alone, without dropping the other viewer settings', () => {
    const onChange = vi.fn();
    renderTab({ showFileName: true }, onChange);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Allow print' }));
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ viewer: { showFileName: true, editorAllowPrint: false } }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Allow download' }));
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ viewer: { showFileName: true, editorAllowDownload: false } }));
  });

  it('shows what is saved, and says it does not stop a photograph of the screen', () => {
    renderTab({ editorAllowDownload: false, editorAllowPrint: false });
    expect(screen.getByRole('checkbox', { name: 'Allow download' })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Allow print' })).not.toBeChecked();
    expect(screen.getByText(/not a photograph or a screenshot of the screen/)).toBeTruthy();
  });
});

describe('the watermark sample uses the face of the watermark', () => {
  it('draws every line in bold Helvetica (Arial), the text, the viewer line and the time, as the PDF and the OnlyOffice viewer do', () => {
    render(
      <PreviewFileTab
        documentsConfig={{ enableWatermark: false, pdfPreview: {} } as unknown as DocumentConfig}
        onDocumentsChange={vi.fn()}
        onlyOfficeConfig={{ viewer: { watermarkEnabled: true, watermarkShowEmployeeCode: true, watermarkShowViewerName: true, watermarkShowOpenedAt: true } } as unknown as OnlyOfficeStorageConfig}
        onOnlyOfficeChange={vi.fn()}
      />,
    );
    const mark = screen.getByTestId('watermark-sample-mark');
    expect(mark.style.fontFamily).toContain('Helvetica');
    const lines = Array.from(mark.querySelectorAll('span'));
    expect(lines).toHaveLength(3);
    lines.forEach((line) => expect(line.className).toContain('font-bold'));
  });
});
