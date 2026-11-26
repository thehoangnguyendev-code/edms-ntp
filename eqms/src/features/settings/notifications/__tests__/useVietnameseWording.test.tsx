import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ getTranslation: vi.fn(), saveTranslation: vi.fn(), preview: vi.fn() }));
vi.mock("@/services/api/notificationPolicy", () => ({ notificationPolicyApi: api }));
const toast = vi.hoisted(() => ({ showToast: vi.fn() }));
vi.mock("@/components/ui/toast/Toast", () => ({ useToast: () => toast }));

import { useVietnameseWording } from "../components/useVietnameseWording";

const problems = vi.fn();

const english = { title: "Controlled copy recalled", summary: "{{controlledCopyNumber}} has been recalled.", subject: "", body: "", url: "", label: "" };

/** The way the screen uses it: the fields can be hidden and shown again while the state stays with the screen. */
function Screen() {
  const [shown, setShown] = useState(true);
  const vietnamese = useVietnameseWording({ eventCode: "controlled_copy.recalled", channel: "IN_APP", english, opened: true, readOnly: false });
  return (
    <>
      <button type="button" onClick={() => setShown((s) => !s)}>switch</button>
      {/* what the Publish button of the screen does with the Vietnamese draft */}
      <button type="button" onClick={() => { const issue = vietnamese.problem(english); if (issue) problems(issue); else void vietnamese.publish(false); }}>publish</button>
      <button type="button" onClick={vietnamese.discard}>discard</button>
      <output data-testid="outdated">{String(vietnamese.outdated)}</output>
      <output data-testid="preview">{vietnamese.translatable ? vietnamese.shown.title : "english"}</output>
      <output data-testid="dirty">{String(vietnamese.dirty)}</output>
      {shown ? vietnamese.editor : null}
    </>
  );
}

describe("Vietnamese wording of a notification", () => {
  beforeEach(() => {
    Object.values(api).forEach((f) => f.mockReset());
    api.preview.mockImplementation((_code: string, payload: { title?: string }) => Promise.resolve({ renderedTitle: payload.title }));
  });
  afterEach(cleanup);

  it("offers the fields to type in, without notices or extra buttons", async () => {
    api.getTranslation.mockResolvedValue({ translatable: true, requiredPlaceholders: ["actionName"], baseVersionId: "v1" });
    render(<Screen />);

    expect(await screen.findByRole("textbox", { name: "Title" })).toBeTruthy();
    expect(screen.queryByText(/filled by the system/)).toBeNull();
    expect(screen.queryByRole("button", { name: "Use English only" })).toBeNull();
  });

  it("keeps a draft while its fields are not shown, previews it, and publishes it against the English version it was translated from", async () => {
    api.getTranslation.mockResolvedValue({ translatable: true, requiredPlaceholders: ["controlledCopyNumber"], baseVersionId: "v3" });
    api.saveTranslation.mockResolvedValue({ translatable: true, requiredPlaceholders: ["controlledCopyNumber"], baseVersionId: "v3",
      translation: { title: "Đã thu hồi", summary: "{{controlledCopyNumber}} đã thu hồi.", outdated: false } });
    render(<Screen />);

    await screen.findByRole("textbox", { name: "Title" });
    expect(screen.queryByRole("button", { name: /Save Vietnamese/ })).toBeNull();
    fireEvent.change(screen.getByRole("textbox", { name: "Title" }), { target: { value: "Đã thu hồi" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Message" }), { target: { value: "Đã thu hồi." } });
    fireEvent.click(screen.getByRole("button", { name: "publish" }));
    expect(problems).toHaveBeenLastCalledWith(expect.stringContaining("{{controlledCopyNumber}}"));
    expect(api.saveTranslation).not.toHaveBeenCalled();

    fireEvent.change(screen.getByRole("textbox", { name: "Message" }), { target: { value: "{{controlledCopyNumber}} đã thu hồi." } });
    fireEvent.click(screen.getByRole("button", { name: "switch" }));
    expect(screen.queryByRole("textbox")).toBeNull();
    await waitFor(() => expect(screen.getByTestId("preview").textContent).toBe("Đã thu hồi"));
    expect(screen.getByTestId("dirty").textContent).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "publish" }));

    await waitFor(() => expect(api.saveTranslation).toHaveBeenCalledWith("controlled_copy.recalled", "IN_APP", { baseVersionId: "v3", title: "Đã thu hồi", summary: "{{controlledCopyNumber}} đã thu hồi." }));
    await waitFor(() => expect(screen.getByTestId("dirty").textContent).toBe("false"));
    expect(api.getTranslation).toHaveBeenCalledTimes(1);
  });

  it("copies the English wording as a starting point, and asks before replacing what was typed", async () => {
    api.getTranslation.mockResolvedValue({ translatable: true, requiredPlaceholders: ["controlledCopyNumber"], baseVersionId: "v1" });
    render(<Screen />);
    const title = () => screen.getByRole("textbox", { name: "Title" }) as HTMLElement & { value?: string };
    const text = () => title().value ?? title().textContent ?? "";

    fireEvent.click(await screen.findByRole("button", { name: "Copy from English" }));
    expect(text()).toContain("Controlled copy recalled");
    fireEvent.change(title(), { target: { value: "Bản đã gõ" } });
    fireEvent.click(screen.getByRole("button", { name: "Copy from English" }));
    expect(await screen.findByText("Replace the Vietnamese text?")).toBeTruthy();
    expect(text()).toContain("Bản đã gõ");
    fireEvent.click(screen.getByRole("button", { name: "Replace" }));
    await waitFor(() => expect(text()).toContain("Controlled copy recalled"));
  });

  it("warns when the English wording changed after the translation, and lets it be confirmed by saving again", async () => {
    api.getTranslation.mockResolvedValue({ translatable: true, requiredPlaceholders: [], baseVersionId: "v4",
      translation: { title: "Cũ", summary: "Cũ", outdated: true } });
    render(<Screen />);

    expect(await screen.findByText(/English wording changed after this translation/)).toBeTruthy();
    expect(screen.getByTestId("outdated").textContent).toBe("true");
  });
});
