import { useState } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, expect, it, vi } from 'vitest';
import { PageBackgroundEditor } from '../PageBackgroundEditor';
import { DEFAULT_PAGE_BACKGROUND, type PageBackground } from '@/config/page-background';
import { api } from '@/services/api/client';

vi.mock('@/components/ui/color-picker/ColorPickerInput', () => ({ ColorPickerInput: ({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) => <label>{label}<input value={value} onChange={(event) => onChange(event.target.value)} /></label> }));
beforeAll(() => { window.matchMedia = vi.fn().mockImplementation(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn() })); });
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function Example() {
  const [value, setValue] = useState<PageBackground>(DEFAULT_PAGE_BACKGROUND);
  return <PageBackgroundEditor title="Main Layout" value={value} onChange={setValue} />;
}

it('chooses a gradient, changes colors and angle, adds and removes stops', async () => {
  render(<Example />);
  fireEvent.click(screen.getByRole('combobox', { name: 'Main Layout background style' }));
  fireEvent.click(await screen.findByRole('option', { name: 'Linear gradient' }));
  fireEvent.change(screen.getByLabelText('Color 1'), { target: { value: '#123456' } });
  fireEvent.change(screen.getByLabelText('Angle (0–360°)'), { target: { value: '45' } });
  fireEvent.change(screen.getByRole('slider', { name: 'Color 1 position' }), { target: { value: '20' } });
  expect((screen.getByRole('slider', { name: 'Color 1 position' }) as HTMLInputElement).value).toBe('20');
  fireEvent.click(screen.getByRole('button', { name: 'Move color 1 right' }));
  expect((screen.getByLabelText('Color 2') as HTMLInputElement).value).toBe('#123456');
  fireEvent.click(screen.getByRole('button', { name: /Add color/i }));
  expect(screen.getByLabelText('Color 3')).toBeTruthy();
  expect(screen.getByLabelText('Main Layout background preview').getAttribute('style')).toContain('45deg');
  fireEvent.click(screen.getByRole('button', { name: 'Remove color 3' }));
  await waitFor(() => expect(screen.queryByLabelText('Color 3')).toBeNull());
});

it('uploads video to the server and enables repeat', async () => {
  const id = '12345678-1234-1234-1234-123456789abc';
  const videoPath = `/settings/system/auth-background-video/${id}`;
  const uploadedFile = new File(['video'], 'video.webm', { type: 'video/webm' });
  vi.spyOn(api, 'post').mockResolvedValueOnce({ data: { id } } as never);
  // Shared loading indicators may read Branding while upload is pending. Only the
  // authenticated video endpoint returns a Blob; unrelated GETs cannot consume it.
  vi.spyOn(api, 'get').mockImplementation(async (path) => {
    if (path === videoPath) return { data: new Blob(['video'], { type: 'video/mp4' }) } as never;
    if (path === '/branding') return { data: { systemDisplayName: 'EQMS', systemLogo: '', systemFavicon: '' } } as never;
    throw new Error(`Unexpected GET in video preview test: ${path}`);
  });
  const createObjectURL = vi.fn(() => 'blob:video');
  const revokeObjectURL = vi.fn();
  vi.stubGlobal('URL', Object.assign(class extends URL {}, { createObjectURL, revokeObjectURL }));
  function AuthExample() {
    const [value, setValue] = useState<PageBackground>(DEFAULT_PAGE_BACKGROUND);
    return <PageBackgroundEditor title="Authentication" allowImage value={value} onChange={setValue} />;
  }
  const { unmount } = render(<AuthExample />);
  fireEvent.click(screen.getByRole('combobox', { name: 'Authentication background style' }));
  fireEvent.click(await screen.findByRole('option', { name: 'Background video' }));
  fireEvent.change(screen.getByLabelText('Authentication background video'), { target: { files: [uploadedFile] } });
  await waitFor(() => expect(screen.getByRole('button', { name: /Replace video/i })).toBeTruthy());
  expect(api.post).toHaveBeenCalledWith('/settings/system/auth-background-video', expect.any(FormData), { timeout: 150000 });
  const uploadBody = vi.mocked(api.post).mock.calls[0][1];
  expect(uploadBody).toBeInstanceOf(FormData);
  expect((uploadBody as FormData).get('video')).toBe(uploadedFile);
  expect(api.get).toHaveBeenCalledWith(videoPath, { responseType: 'blob' });
  const preview = await screen.findByLabelText('Video preview');
  expect(preview).toHaveAttribute('src', 'blob:video');
  expect(preview).toHaveProperty('loop', true);
  expect((screen.getByLabelText('Repeat video') as HTMLInputElement).checked).toBe(true);
  fireEvent.click(screen.getByLabelText('Repeat video'));
  expect((screen.getByLabelText('Repeat video') as HTMLInputElement).checked).toBe(false);
  expect(preview).toHaveProperty('loop', false);
  fireEvent.click(screen.getByLabelText('Repeat video'));
  expect(preview).toHaveProperty('loop', true);
  expect(api.post).toHaveBeenCalledOnce();
  expect(vi.mocked(api.get).mock.calls.filter(([path]) => path === videoPath)).toHaveLength(1);
  unmount();
  expect(revokeObjectURL).toHaveBeenCalledWith('blob:video');
});

it('keeps the draft unchanged when the server refuses an uploaded video', async () => {
  const onChange = vi.fn();
  vi.spyOn(api, 'post').mockRejectedValueOnce(new Error('VIDEO_TOO_LONG'));
  vi.spyOn(api, 'get').mockImplementation(async (path) => {
    if (path === '/branding') return { data: { systemDisplayName: 'EQMS', systemLogo: '', systemFavicon: '' } } as never;
    throw new Error(`Unexpected GET after refused video upload: ${path}`);
  });
  render(<PageBackgroundEditor title="Authentication" allowImage value={{ ...DEFAULT_PAGE_BACKGROUND, mode: 'video' }} onChange={onChange} />);
  fireEvent.change(screen.getByLabelText('Authentication background video'), { target: { files: [new File(['video'], 'long.webm', { type: 'video/webm' })] } });
  expect(await screen.findByRole('alert')).toHaveTextContent('Video could not be processed. Check the file and the 15-second limit, then try again.');
  expect(onChange).not.toHaveBeenCalled();
  expect(screen.queryByLabelText('Video preview')).toBeNull();
  expect(screen.getByRole('button', { name: /Upload video/i })).toBeEnabled();
  expect(api.post).toHaveBeenCalledOnce();
});

it('uploads a supported auth image and rejects unsupported files', async () => {
  function AuthExample() {
    const [value, setValue] = useState<PageBackground>(DEFAULT_PAGE_BACKGROUND);
    return <PageBackgroundEditor title="Authentication" allowImage value={value} onChange={setValue} />;
  }
  render(<AuthExample />);
  fireEvent.click(screen.getByRole('combobox', { name: 'Authentication background style' }));
  fireEvent.click(await screen.findByRole('option', { name: 'Background image' }));
  const input = screen.getByLabelText('Authentication background image');
  fireEvent.change(input, { target: { files: [new File(['bad'], 'bad.svg', { type: 'image/svg+xml' })] } });
  expect(screen.getByRole('alert').textContent).toContain('PNG');
  fireEvent.change(input, { target: { files: [new File(['image'], 'sample.png', { type: 'image/png' })] } });
  await waitFor(() => expect(screen.getByRole('button', { name: /Replace image/i })).toBeTruthy());
  expect(screen.queryByRole('alert')).toBeNull();
});

it('shows Remove as an icon only, and the move arrows as bordered buttons', async () => {
  render(<Example />);
  fireEvent.click(screen.getByRole('combobox', { name: 'Main Layout background style' }));
  fireEvent.click(await screen.findByRole('option', { name: 'Linear gradient' }));
  fireEvent.click(screen.getByRole('button', { name: /Add color/i }));

  const remove = screen.getByRole('button', { name: 'Remove color 3' });
  expect(remove.textContent?.trim()).toBe(''); // no word, only the icon
  expect(remove).toHaveAttribute('title', 'Remove color 3');
  expect(remove.querySelector('svg')).not.toBeNull();
  expect(screen.queryByText('Remove')).toBeNull();

  for (const name of ['Move color 1 right', 'Move color 2 left']) {
    const arrow = screen.getByRole('button', { name });
    expect(arrow.className).toContain('border'); // the outline variant: a border, not a bare icon
    expect(arrow.className).not.toContain('hover:bg-transparent');
    expect(arrow.querySelector('svg')).not.toBeNull();
  }
});

it('shows System default as the light grey bg-gray-100/50, for the sign-in page and for the main layout', () => {
  const noop = () => undefined;
  const { rerender } = render(<PageBackgroundEditor title="Authentication" allowImage value={{ ...DEFAULT_PAGE_BACKGROUND, mode: 'default' }} onChange={noop} />);
  expect(screen.getByLabelText('Authentication background preview').getAttribute('style')).toContain('rgba(243, 244, 246, 0.5)'); // bg-gray-100/50
  expect(screen.getByText('The built-in Authentication background: light grey (bg-gray-100/50). Choose another style to replace it.')).toBeTruthy();

  rerender(<PageBackgroundEditor title="Main Layout" value={{ ...DEFAULT_PAGE_BACKGROUND, mode: 'default' }} onChange={noop} />);
  expect(screen.getByLabelText('Main Layout background preview').getAttribute('style')).toContain('rgba(243, 244, 246, 0.5)'); // bg-gray-100/50
  expect(screen.getByText('The built-in Main Layout background: light grey (bg-gray-100/50). Choose another style to replace it.')).toBeTruthy();
});
