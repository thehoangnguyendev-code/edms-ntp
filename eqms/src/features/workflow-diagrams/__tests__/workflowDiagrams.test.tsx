import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({ list: vi.fn(), get: vi.fn(), remove: vi.fn(), toast: vi.fn() }));
vi.mock('@/services/api/workflowDiagrams', () => ({ workflowDiagramApi: api }));
vi.mock('@/components/ui/toast/Toast', () => ({ useToast: () => ({ showToast: api.toast }) }));
vi.mock('@/components/ui/page/PageHeader', () => ({ PageHeader: ({ title, actions }: { title: string; actions?: React.ReactNode }) => <header><h1>{title}</h1>{actions}</header> }));

import { DrawioFrame } from '../DrawioFrame';
import { WorkflowDiagramsView } from '../WorkflowDiagramsView';
import { textOfDataUri, workflowError } from '../workflowDiagramModel';

const summary = { id: 'w1', name: 'Revision flow', description: null, version: 2, updatedByName: 'An', updatedAt: '27/11/2026 08:00:00' };

beforeEach(() => {
  api.list.mockResolvedValue({ data: [summary], canManage: false });
  api.get.mockResolvedValue({ ...summary, module: 'DOCUMENT_CONTROL', svg: '<svg xmlns="http://www.w3.org/2000/svg"/>', xml: '<mxfile/>', canManage: false });
});
afterEach(cleanup);

describe('Workflow diagrams', () => {
  it('shows a person without the edit permission the picture and no way to change it', async () => {
    render(<MemoryRouter><WorkflowDiagramsView module="DOCUMENT_CONTROL" /></MemoryRouter>);
    const view = (await screen.findByTitle('Revision flow')) as HTMLIFrameElement;
    // the frame of the editor without its panels and buttons, drawn light
    expect(view.src).toContain('sidebar=0&format=0&noSaveBtn=1');
    expect(view.src).toContain('dark=0');
    for (const name of ['New Diagram', 'Edit', 'Rename', 'Delete']) expect(screen.queryByRole('button', { name })).toBeNull();
    expect(screen.getByRole('button', { name: 'History' })).toBeInTheDocument();
  });

  it('listens only to its own editor, and gives back the drawing with its picture on Save', () => {
    const onSave = vi.fn();
    const onChange = vi.fn();
    render(<DrawioFrame xml="<mxfile/>" onChange={onChange} onSave={onSave} onExit={vi.fn()} />);
    const frame = screen.getByTitle('Diagram editor') as HTMLIFrameElement;
    const origin = new URL(frame.src).origin;
    const say = (data: object, from: string, source: Window | null = frame.contentWindow) =>
      window.dispatchEvent(new MessageEvent('message', { data: JSON.stringify(data), origin: from, source }));

    say({ event: 'autosave' }, 'https://elsewhere.example');
    say({ event: 'autosave' }, origin, window);
    expect(onChange).not.toHaveBeenCalled();

    say({ event: 'save', xml: '<mxfile><diagram/></mxfile>' }, origin);
    say({ event: 'export', data: `data:image/svg+xml;base64,${btoa('<svg/>')}` }, origin);
    expect(onSave).toHaveBeenCalledWith({ xml: '<mxfile><diagram/></mxfile>', svg: '<svg/>' });
  });

  it('saves from the page as Save inside the editor does', () => {
    const onSave = vi.fn();
    const handle = React.createRef<{ save: () => void }>();
    render(<DrawioFrame ref={handle} xml="" onChange={vi.fn()} onSave={onSave} onExit={vi.fn()} />);
    const frame = screen.getByTitle('Diagram editor') as HTMLIFrameElement;
    const sent = vi.spyOn(frame.contentWindow!, 'postMessage');
    handle.current!.save();
    // the editor's own Save is pressed; it then answers exactly as when pressed inside the editor
    expect(JSON.parse(sent.mock.calls[0][0] as string)).toEqual({ action: 'invokeAction', actionName: 'save' });
  });

  it('does not open the deleted diagram again, and says only that it was deleted', async () => {
    api.toast.mockClear();
    api.get.mockClear();
    api.list.mockResolvedValueOnce({ data: [summary], canManage: true }).mockResolvedValue({ data: [], canManage: true });
    api.get.mockResolvedValue({ ...summary, module: 'DOCUMENT_CONTROL', svg: null, xml: '', canManage: true });
    api.remove.mockResolvedValue(undefined);
    render(<MemoryRouter><WorkflowDiagramsView module="DOCUMENT_CONTROL" /></MemoryRouter>);

    fireEvent.click(await screen.findByRole('button', { name: 'Delete' }));
    fireEvent.change(screen.getByLabelText(/Reason/), { target: { value: 'Not used' } });
    const confirms = screen.getAllByRole('button', { name: 'Delete' });
    fireEvent.click(confirms[confirms.length - 1]);

    await waitFor(() => expect(api.toast).toHaveBeenCalledWith({ type: 'success', message: 'The diagram was deleted.' }));
    expect(api.get).toHaveBeenCalledTimes(1);
    expect(api.toast).toHaveBeenCalledTimes(1);
  });

  it('never shows a diagram of another module, even when the address names it', async () => {
    api.list.mockResolvedValue({ data: [], canManage: false });
    api.get.mockResolvedValue({ ...summary, module: 'DOCUMENT_CONTROL', svg: null, xml: '<mxfile/>', canManage: false });
    render(<MemoryRouter initialEntries={['/training-management/workflow?diagram=w1']}><WorkflowDiagramsView module="TRAINING" /></MemoryRouter>);
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('w1'));
    expect(screen.queryByTitle('Revision flow')).toBeNull();
  });

  it('says why the server refused', () => {
    const refusal = { response: { data: { error: { code: 'RESOURCE_NOT_FOUND', message: '409 CONFLICT "WORKFLOW_DIAGRAM_NAME_TAKEN"' } } } };
    expect(workflowError(refusal)).toBe('A diagram with this name already exists.');
  });

  it('reads the text of an exported picture with Vietnamese words', () => {
    const bytes = new TextEncoder().encode('<svg>Phê duyệt</svg>');
    expect(textOfDataUri(`data:image/svg+xml;base64,${btoa(String.fromCharCode(...bytes))}`)).toBe('<svg>Phê duyệt</svg>');
  });
});
