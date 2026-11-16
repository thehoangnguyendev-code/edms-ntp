import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { AuditTabViewSection } from "../AuditTabViewSection";
import type { GeneralConfig } from "../../types";

afterEach(cleanup);

const config = (appearance: object = {}) => ({ appearance }) as unknown as GeneralConfig;

/** AUDIT-TAB-TIMELINE-2026-11-15: the administrator chooses the table or the timeline for the Audit Trail tab of a record, and one of four looks for the timeline. */
it("offers the table and the timeline, and no look until the timeline is chosen", () => {
  const onChange = vi.fn();
  render(<AuditTabViewSection config={config()} onChange={onChange} />);
  expect(screen.getByRole("radio", { name: /Table/ })).toBeChecked();
  expect(screen.queryByRole("radiogroup", { name: "Timeline look" })).toBeNull();
  fireEvent.click(screen.getByRole("radio", { name: /Timeline/ }));
  expect(onChange).toHaveBeenCalledWith("auditTabView", "TIMELINE");
});

it("offers the four looks of the timeline, the compact log being the one chosen when nothing was", () => {
  const onChange = vi.fn();
  render(<AuditTabViewSection config={config({ auditTabView: "TIMELINE" })} onChange={onChange} />);
  const looks = screen.getByRole("radiogroup", { name: "Timeline look" });
  expect(looks.querySelectorAll("input[type=radio]")).toHaveLength(4);
  expect(screen.getByRole("radio", { name: /Compact log/ })).toBeChecked();
  fireEvent.click(screen.getByRole("radio", { name: /Date column/ }));
  expect(onChange).toHaveBeenCalledWith("auditTabTimelineStyle", "SCROLL_LIT");
  fireEvent.click(screen.getByRole("radio", { name: /Centre spine/ }));
  expect(onChange).toHaveBeenCalledWith("auditTabTimelineStyle", "CENTER");
  fireEvent.click(screen.getByRole("radio", { name: /Rail and cards/ }));
  expect(onChange).toHaveBeenCalledWith("auditTabTimelineStyle", "RAIL");
});

it("says that the Audit Trail module is not affected", () => {
  render(<AuditTabViewSection config={config()} onChange={vi.fn()} />);
  expect(screen.getByText(/The Audit Trail module and the export of the audit trail are not affected/)).toBeInTheDocument();
});
