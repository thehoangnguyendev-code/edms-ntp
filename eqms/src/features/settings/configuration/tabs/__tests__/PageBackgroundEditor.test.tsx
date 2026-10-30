import { useState } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeAll, expect, it, vi } from 'vitest';
import { PageBackgroundEditor } from '../PageBackgroundEditor';
import { DEFAULT_PAGE_BACKGROUND, type PageBackground } from '@/config/page-background';
import { api } from '@/services/api/client';

vi.mock('@/components/ui/color-picker/ColorPickerInput', () => ({ ColorPickerInput: ({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) => <label>{label}<input value={value} onChange={(event) => onChange(event.target.value)} /></label> }));
beforeAll(() => { window.matchMedia = vi.fn().mockImplementation(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn() })); });

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
  vi.spyOn(api, 'post').mockResolvedValueOnce({ data: { id } } as never);
  vi.spyOn(api, 'get').mockResolvedValueOnce({ data: new Blob(['video'], { type: 'video/mp4' }) } as never);
  vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:video'), revokeObjectURL: vi.fn() }));
  function AuthExample() {
    const [value, setValue] = useState<PageBackground>(DEFAULT_PAGE_BACKGROUND);
    return <PageBackgroundEditor title="Authentication" allowImage value={value} onChange={setValue} />;
  }
  render(<AuthExample />);
  fireEvent.click(screen.getByRole('combobox', { name: 'Authentication background style' }));
  fireEvent.click(await screen.findByRole('option', { name: 'Background video' }));
  fireEvent.change(screen.getByLabelText('Authentication background video'), { target: { files: [new File(['video'], 'video.webm', { type: 'video/webm' })] } });
  await waitFor(() => expect(screen.getByRole('button', { name: /Replace video/i })).toBeTruthy());
  expect(api.post).toHaveBeenCalledWith('/settings/system/auth-background-video', expect.any(FormData), expect.any(Object));
  expect((screen.getByLabelText('Repeat video') as HTMLInputElement).checked).toBe(true);
  fireEvent.click(screen.getByLabelText('Repeat video'));
  expect((screen.getByLabelText('Repeat video') as HTMLInputElement).checked).toBe(false);
  await waitFor(() => expect(screen.getByLabelText('Video preview')).toBeTruthy());
  vi.restoreAllMocks();
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
