import { useLayoutEffect } from 'react';
import './sticky-number-column.css';

/** Match the ordinal heading, never headings such as Document No. or Issue No. */
const isNumberHeading = (cell: HTMLTableCellElement) => /^no\.?$/i.test(cell.textContent?.trim() ?? '')
  || cell.getAttribute('data-table-col') === 'no' || cell.getAttribute('data-user-column') === 'no';

/** Logical cell positions include merged headings and row-spanning editable grids. */
function cellPositions(rows: HTMLCollectionOf<HTMLTableRowElement>) {
  const spans: number[] = [];
  return Array.from(rows, row => {
    let column = 0;
    const cells = Array.from(row.cells, cell => {
      while (spans[column] > 0) column++;
      const start = column;
      for (let i = 0; i < cell.colSpan; i++) spans[column++] = Math.max(1, cell.rowSpan);
      return { cell, start };
    });
    for (let i = 0; i < spans.length; i++) spans[i] = Math.max(0, spans[i] - 1);
    return cells;
  });
}

/** Presentation only: all shared tables pin their ordinal column, including nested tables. */
export function useStickyNumberColumn(table: HTMLTableElement | null) {
  useLayoutEffect(() => {
    if (!table) return;
    let tagged = new Set<HTMLTableCellElement>();
    const originalBackground = new WeakMap<HTMLTableCellElement, string>();
    const clear = (cell: HTMLTableCellElement) => {
      delete cell.dataset.numberSticky;
      cell.style.removeProperty('--table-number-left');
      cell.style.removeProperty('--table-number-background');
    };
    const paint = (cell: HTMLTableCellElement) => {
      const row = cell.parentElement;
      const rowColor = row ? getComputedStyle(row).backgroundColor : '';
      const color = rowColor && rowColor !== 'transparent' && rowColor !== 'rgba(0, 0, 0, 0)'
        ? rowColor : originalBackground.get(cell) || '#ffffff';
      cell.style.setProperty('--table-number-background', color);
    };
    const apply = () => {
      const headerRows = table.tHead ? cellPositions(table.tHead.rows) : [];
      const heading = headerRows.flat().find(({ cell }) => cell.colSpan === 1 && isNumberHeading(cell));
      const next = new Set<HTMLTableCellElement>();
      if (heading) {
        // Every column before No. (expand, selection checkbox) is pinned with it, each one after the width of the columns before it.
        const widthOf = new Map<number, number>();
        for (const { cell, start } of headerRows.flat()) {
          if (start < heading.start && cell.colSpan === 1 && !widthOf.has(start)) widthOf.set(start, cell.getBoundingClientRect().width);
        }
        const pinned = [...widthOf.keys(), heading.start].sort((a, b) => a - b);
        const leftOf = new Map<number, number>();
        let left = 0;
        for (const start of pinned) {
          leftOf.set(start, left);
          left += widthOf.get(start) ?? 0;
        }
        for (const section of [table.tHead, ...Array.from(table.tBodies), table.tFoot]) {
          if (!section) continue;
          for (const row of cellPositions(section.rows)) {
            for (const { cell, start } of row) {
              if (cell.colSpan !== 1 || !leftOf.has(start)) continue; // expanded/group/empty rows spanning the table are never pinned
              if (!originalBackground.has(cell)) {
                const color = getComputedStyle(cell).backgroundColor;
                originalBackground.set(cell, color && color !== 'transparent' && color !== 'rgba(0, 0, 0, 0)' ? color : '#ffffff');
              }
              cell.dataset.numberSticky = cell.tagName === 'TH' ? 'header' : 'cell';
              cell.style.setProperty('--table-number-left', `${leftOf.get(start)}px`);
              paint(cell);
              next.add(cell);
            }
          }
        }
      }
      tagged.forEach(cell => { if (!next.has(cell)) clear(cell); });
      tagged = next;
    };
    apply();
    const resize = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(apply);
    resize?.observe(table);
    table.tHead?.querySelectorAll('th').forEach(cell => resize?.observe(cell));
    const mutation = new MutationObserver(() => {
      table.tHead?.querySelectorAll('th').forEach(cell => resize?.observe(cell));
      apply();
    });
    mutation.observe(table, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['class', 'colspan', 'rowspan', 'aria-selected', 'data-pinned'] });
    const appearance = new MutationObserver(apply);
    appearance.observe(document.documentElement, { attributes: true, attributeFilter: ['data-alternating-records', 'style'] });
    const hover = () => tagged.forEach(paint);
    table.addEventListener('pointerover', hover);
    table.addEventListener('pointerout', hover);
    return () => {
      mutation.disconnect(); resize?.disconnect(); appearance.disconnect();
      table.removeEventListener('pointerover', hover); table.removeEventListener('pointerout', hover);
      tagged.forEach(clear);
    };
  }, [table]);
}
