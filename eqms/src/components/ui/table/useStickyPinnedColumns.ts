import { useLayoutEffect } from "react";

/**
 * Keeps the given columns fixed while the table scrolls horizontally.
 *
 * `pinnedIds` lists the pinned column ids from left to right. Each pinned column's `left` offset is
 * the sum of the widths of the pinned columns before it, measured from the real header cells, so
 * the layout follows column widths rather than fixed pixel values. Cells are found through the
 * `attr` data attribute (default `data-user-column`), so a table only needs to tag its cells.
 *
 * Columns that drop out of `pinnedIds` are released, which lets a user unpin a column.
 *
 * `root` is the scrolling element itself, passed as state rather than a ref. A table that only renders
 * after its data arrives mounts its scroller later; a ref would not re-run the effect at that point,
 * and the pinning would silently never apply.
 */
export function useStickyPinnedColumns(
  root: HTMLElement | null,
  pinnedIds: string[],
  attr = "data-user-column",
) {
  const key = pinnedIds.join("|");

  useLayoutEffect(() => {
    if (!root) return;

    const apply = () => {
      let left = 0;
      const lastId = pinnedIds[pinnedIds.length - 1];
      pinnedIds.forEach((id) => {
        const cells = root.querySelectorAll<HTMLElement>(`[${attr}="${id}"]`);
        cells.forEach((cell) => {
          const isHeader = cell.tagName === "TH";
          cell.style.position = "sticky";
          cell.style.left = `${left}px`;
          cell.style.zIndex = isHeader ? "40" : "20";
          cell.style.backgroundColor = isHeader ? "#f8fafc" : "#ffffff";
          // The divider marks the edge of the fixed block: the last pinned column carries it.
          // box-shadow sits inside the cell, so it shows whatever the table's border model is.
          cell.style.boxShadow = id === lastId ? "inset -1px 0 0 #e2e8f0" : "";
          cell.dataset.pinned = "true";
        });
        const header = root.querySelector<HTMLElement>(`thead [${attr}="${id}"]`);
        left += header?.offsetWidth ?? 0;
      });

      root.querySelectorAll<HTMLElement>("[data-pinned='true']").forEach((cell) => {
        const id = cell.getAttribute(attr);
        if (id && pinnedIds.includes(id)) return;
        cell.style.position = "";
        cell.style.left = "";
        cell.style.zIndex = "";
        cell.style.backgroundColor = "";
        cell.style.boxShadow = "";
        delete cell.dataset.pinned;
      });
    };

    apply();
    // Rows and headers change size with their content, and the table re-renders on column changes.
    // Header widths decide every offset, so each header cell is observed, not only the scroller.
    const observeHeaders = () => root.querySelectorAll("thead th").forEach((header) => resize.observe(header));
    const resize = new ResizeObserver(apply);
    resize.observe(root);
    observeHeaders();
    const mutation = new MutationObserver(() => {
      observeHeaders();
      apply();
    });
    mutation.observe(root, { childList: true, subtree: true });
    return () => {
      resize.disconnect();
      mutation.disconnect();
    };
  }, [root, key, attr]); // eslint-disable-line react-hooks/exhaustive-deps -- key encodes pinnedIds
}
