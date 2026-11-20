import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { NotificationInboxLayoutSection } from "../NotificationInboxLayoutSection";
import type { GeneralConfig } from "../../types";

afterEach(cleanup);

const config = (appearance: object = {}) => ({ appearance }) as unknown as GeneralConfig;

/** NOTIFICATION-INBOX-LAYOUT-2026-11-20: the administrator chooses priority tabs or the timeline for the Notifications page. */
it("offers the two layouts, the priority tabs being the one chosen when nothing was", () => {
  render(<NotificationInboxLayoutSection config={config()} onChange={vi.fn()} />);
  expect(screen.getByRole("radiogroup", { name: "Notifications inbox layout" }).querySelectorAll("input[type=radio]")).toHaveLength(2);
  expect(screen.getByRole("radio", { name: /Priority tabs/ })).toBeChecked();
});

it("sends the machine value of the layout that was chosen", () => {
  const onChange = vi.fn();
  render(<NotificationInboxLayoutSection config={config({ notificationInboxLayout: "TABS" })} onChange={onChange} />);
  fireEvent.click(screen.getByRole("radio", { name: /Timeline/ }));
  expect(onChange).toHaveBeenCalledWith("notificationInboxLayout", "TIMELINE");
});

it("shows the timeline as chosen when it was saved", () => {
  render(<NotificationInboxLayoutSection config={config({ notificationInboxLayout: "TIMELINE" })} onChange={vi.fn()} />);
  expect(screen.getByRole("radio", { name: /Timeline/ })).toBeChecked();
});
