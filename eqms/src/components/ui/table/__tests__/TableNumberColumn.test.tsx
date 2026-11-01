import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { expect, it } from 'vitest';
import { TableMarkup as T } from '../TablePrimitives';

it('pins the selection control before No. together with No., but not the data, action or merged detail row', () => {
  render(<T.Root aria-label="Records"><T.Head><T.Row><T.HeaderCell>Select</T.HeaderCell><T.HeaderCell>No.</T.HeaderCell><T.HeaderCell>Document No.</T.HeaderCell><T.HeaderCell>Action</T.HeaderCell></T.Row></T.Head><T.Body>
    <T.Row><T.Cell><input aria-label="Select" type="checkbox" /></T.Cell><T.Cell>1</T.Cell><T.Cell>DOC-1</T.Cell><T.Cell>View</T.Cell></T.Row>
    <T.Row><T.Cell colSpan={4}>Expanded detail</T.Cell></T.Row>
  </T.Body></T.Root>);
  expect(screen.getByRole('columnheader', { name: 'No.' })).toHaveAttribute('data-number-sticky', 'header');
  expect(screen.getByText('1')).toHaveAttribute('data-number-sticky', 'cell');
  expect(screen.getByText('1').style.getPropertyValue('--table-number-left')).toBe('0px');
  expect(screen.getByRole('columnheader', { name: 'Select' })).toHaveAttribute('data-number-sticky', 'header');
  expect(screen.getByLabelText('Select', { selector: 'input' }).closest('td')).toHaveAttribute('data-number-sticky', 'cell');
  expect(screen.getByText('DOC-1')).not.toHaveAttribute('data-number-sticky');
  expect(screen.getByText('Expanded detail')).not.toHaveAttribute('data-number-sticky');
  expect(screen.getByText('View')).not.toHaveAttribute('data-number-sticky');
});

it('tracks asynchronous rows, merged headings and nested tables independently', async () => {
  const Grid = ({ loaded }: { loaded: boolean }) => <T.Root aria-label="Outer"><T.Head>
    <T.Row><T.HeaderCell rowSpan={2}>NO</T.HeaderCell><T.HeaderCell colSpan={2}>Details</T.HeaderCell></T.Row>
    <T.Row><T.HeaderCell>Name</T.HeaderCell><T.HeaderCell>Status</T.HeaderCell></T.Row>
  </T.Head><T.Body>{loaded && <T.Row><T.Cell>7</T.Cell><T.Cell>Alpha</T.Cell><T.Cell>Active</T.Cell></T.Row>}
    <T.Row><T.Cell colSpan={3}><T.Root aria-label="Nested"><T.Head><T.Row><T.HeaderCell>Document No.</T.HeaderCell></T.Row></T.Head><T.Body><T.Row><T.Cell>DOC-7</T.Cell></T.Row></T.Body></T.Root></T.Cell></T.Row>
  </T.Body></T.Root>;
  const { rerender } = render(<Grid loaded={false} />);
  rerender(<Grid loaded />);
  await waitFor(() => expect(screen.getByText('7')).toHaveAttribute('data-number-sticky', 'cell'));
  expect(screen.getByText('Alpha')).not.toHaveAttribute('data-number-sticky');
  expect(screen.getByText('DOC-7')).not.toHaveAttribute('data-number-sticky');
});

it('uses the measured width of preceding frozen controls and retains the row background', async () => {
  const { container } = render(<T.Root><T.Head><T.Row>
    <T.HeaderCell style={{ position: 'sticky', left: 0 }} ref={cell => { if (cell) cell.getBoundingClientRect = () => ({ width: 36 } as DOMRect); }}>Expand</T.HeaderCell>
    <T.HeaderCell>No.</T.HeaderCell><T.HeaderCell>Name</T.HeaderCell>
  </T.Row></T.Head><T.Body><T.Row style={{ backgroundColor: 'rgb(240, 250, 240)' }}><T.Cell>+</T.Cell><T.Cell>9</T.Cell><T.Cell>Record</T.Cell></T.Row></T.Body></T.Root>);
  const number = screen.getByText('9');
  expect(number.style.getPropertyValue('--table-number-left')).toBe('36px');
  expect(number.style.getPropertyValue('--table-number-background')).toBe('rgb(240, 250, 240)');
  container.querySelectorAll('tr').forEach((row) => row.firstElementChild!.remove());
  await waitFor(() => expect(number.style.getPropertyValue('--table-number-left')).toBe('0px'));
});
