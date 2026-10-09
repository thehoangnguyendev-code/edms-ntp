import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AnnouncementDialogContent } from "../AnnouncementDialogContent";
import { AnnouncementModal } from "../AnnouncementModal";

beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }));
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  document.body.style.overflow = "";
});

const content = { title: "Planned maintenance", message: "The system will be unavailable from 22:00.", onClose: () => undefined };

// ---- the card --------------------------------------------------------------------------------------------------------

it("shows the severity as text and an icon, the title and the message", () => {
  render(<AnnouncementDialogContent {...content} severity="WARNING" />);
  expect(screen.getByText("Warning")).toBeTruthy();
  expect(screen.getByText("Planned maintenance")).toBeTruthy();
  expect(screen.getByText("The system will be unavailable from 22:00.")).toBeTruthy();
});

it("labels each severity", () => {
  const { rerender } = render(<AnnouncementDialogContent {...content} severity="INFO" />);
  expect(screen.getByText("Information")).toBeTruthy();
  rerender(<AnnouncementDialogContent {...content} severity="CRITICAL" />);
  expect(screen.getByText("Critical")).toBeTruthy();
});

it("calls onClose from the Close button, and the label can be changed", () => {
  const onClose = vi.fn();
  const { rerender } = render(<AnnouncementDialogContent {...content} onClose={onClose} />);
  fireEvent.click(screen.getByRole("button", { name: "Close" }));
  expect(onClose).toHaveBeenCalledTimes(1);
  rerender(<AnnouncementDialogContent {...content} onClose={onClose} closeLabel="Đóng" />);
  expect(screen.getByRole("button", { name: "Đóng" })).toBeTruthy();
});

it("shows the position only when more than one announcement is waiting", () => {
  const { rerender } = render(<AnnouncementDialogContent {...content} position={1} total={1} />);
  expect(screen.queryByText(/ of /)).toBeNull();
  rerender(<AnnouncementDialogContent {...content} position={2} total={3} />);
  expect(screen.getByText("2 of 3")).toBeTruthy();
});

it("renders the content as text, never as markup", () => {
  const { container } = render(
    <AnnouncementDialogContent {...content} title="<b>bold</b>" message={'<img src=x onerror="alert(1)"><script>alert(2)</script>'} />,
  );
  expect(container.querySelector("img")).toBeNull();
  expect(container.querySelector("script")).toBeNull();
  expect(container.querySelector("b")).toBeNull();
  expect(screen.getByText("<b>bold</b>")).toBeTruthy();
});

it("shows the period note when given", () => {
  render(<AnnouncementDialogContent {...content} footnote="Shown until tomorrow." />);
  expect(screen.getByText("Shown until tomorrow.")).toBeTruthy();
});

// ---- the modal -------------------------------------------------------------------------------------------------------

it("renders nothing while it is closed", () => {
  render(<AnnouncementModal open={false} {...content} />);
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(screen.queryByRole("alertdialog")).toBeNull();
});

it("is a labelled, modal dialog; a critical one is an alert dialog", () => {
  const { rerender } = render(<AnnouncementModal open {...content} severity="INFO" />);
  const dialog = screen.getByRole("dialog");
  expect(dialog.getAttribute("aria-modal")).toBe("true");
  expect(dialog.getAttribute("aria-labelledby")).toBeTruthy();
  expect(document.getElementById(dialog.getAttribute("aria-labelledby")!)?.textContent).toBe("Planned maintenance");
  expect(document.getElementById(dialog.getAttribute("aria-describedby")!)?.textContent).toBe("The system will be unavailable from 22:00.");
  rerender(<AnnouncementModal open {...content} severity="CRITICAL" />);
  expect(screen.getByRole("alertdialog")).toBeTruthy();
});

it("puts focus on Close, locks the page behind, and gives both back when it closes", () => {
  const opener = document.createElement("button");
  document.body.appendChild(opener);
  opener.focus();
  const { rerender } = render(<AnnouncementModal open {...content} />);
  act(() => {
    vi.advanceTimersByTime(100);
  });
  expect(document.activeElement).toBe(screen.getByRole("button", { name: "Close" }));
  expect(document.body.style.overflow).toBe("hidden");
  rerender(<AnnouncementModal open={false} {...content} />);
  expect(document.body.style.overflow).toBe("");
  expect(document.activeElement).toBe(opener);
  opener.remove();
});

it("closes with Escape", () => {
  const onClose = vi.fn();
  render(<AnnouncementModal open {...content} onClose={onClose} />);
  fireEvent.keyDown(document, { key: "Escape" });
  expect(onClose).toHaveBeenCalledTimes(1);
});

it("is not closed by a click on the backdrop, so a notice is not dismissed by accident", () => {
  const onClose = vi.fn();
  render(<AnnouncementModal open {...content} onClose={onClose} />);
  const backdrop = screen.getByRole("dialog").parentElement!.firstElementChild as HTMLElement;
  fireEvent.click(backdrop);
  fireEvent.click(screen.getByRole("dialog").parentElement!);
  expect(onClose).not.toHaveBeenCalled();
});

it("keeps Tab inside the dialog", () => {
  render(<AnnouncementModal open {...content} message={"line\n".repeat(50)} />);
  const close = screen.getByRole("button", { name: "Close" });
  close.focus();
  const event = new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true });
  document.dispatchEvent(event);
  expect(event.defaultPrevented).toBe(true); // Close is the last stop, so Tab wraps to the first one
  expect(document.activeElement).not.toBe(close);
});
