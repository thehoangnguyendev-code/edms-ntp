import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { Select } from './Select';

afterEach(cleanup);
const options = [{ label: 'Document Register', value: 'register' }];

it('keeps ordinary dropdowns at their existing layer and selects an option', () => {
  const onChange = vi.fn();
  render(<Select value="" onChange={onChange} options={options} enableSearch={false} />);
  fireEvent.click(screen.getByRole('combobox'));
  expect(screen.getByRole('listbox')).toHaveStyle({ zIndex: '50' });
  fireEvent.click(screen.getByRole('option', { name: 'Document Register' }));
  expect(onChange).toHaveBeenCalledExactlyOnceWith('register');
  expect(screen.getByRole('combobox')).toHaveAttribute('aria-expanded', 'false');
});

it('places a body-portaled dropdown above its owning drawer without changing selection', () => {
  const onChange = vi.fn();
  render(<div data-drawer-overlay style={{ zIndex: 60 }}><Select value="" onChange={onChange} options={options} enableSearch={false} /></div>);
  fireEvent.click(screen.getByRole('combobox'));
  const list = screen.getByRole('listbox');
  expect(list).toHaveStyle({ zIndex: '61' });
  expect(list.closest('[data-drawer-overlay]')).toBeNull();
  fireEvent.click(screen.getByRole('option', { name: 'Document Register' }));
  expect(onChange).toHaveBeenCalledExactlyOnceWith('register');
});

it('retains disabled behaviour inside a drawer', () => {
  const onChange = vi.fn();
  render(<div data-drawer-overlay style={{ zIndex: 60 }}><Select value="" disabled onChange={onChange} options={options} /></div>);
  fireEvent.click(screen.getByRole('combobox'));
  expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  expect(onChange).not.toHaveBeenCalled();
});
