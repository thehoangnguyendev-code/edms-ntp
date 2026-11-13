import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import React, { createRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RichTextEditor, type RichTextEditorHandle } from "../components/RichTextEditor";
import { TokenTextField, type TokenTextFieldHandle } from "../components/TokenTextField";
import { VariablePalette } from "../components/VariablePalette";
import { tokensIn } from "../components/tokenHighlight";

const toast = vi.hoisted(() => ({ showToast: vi.fn() }));
vi.mock("@/components/ui/toast/Toast", () => ({ useToast: () => toast }));

beforeEach(() => {
  toast.showToast.mockReset();
  // ProseMirror measures the page; jsdom has no layout
  Range.prototype.getBoundingClientRect = () => ({ x: 0, y: 0, top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0, toJSON: () => ({}) }) as DOMRect;
  Range.prototype.getClientRects = () => ({ length: 0, item: () => null, [Symbol.iterator]: function* () {} }) as unknown as DOMRectList;
  document.elementFromPoint = () => null;
});
afterEach(cleanup);

describe("RichTextEditor: the wording of a message", () => {
  it("shows the toolbar and the text, and sends HTML when the text changes", async () => {
    const onChange = vi.fn();
    const ref = createRef<RichTextEditorHandle>();
    render(<RichTextEditor ref={ref} value="<p>Hello</p>" onChange={onChange} ariaLabel="Email message" />);
    expect(await screen.findByRole("toolbar", { name: "Text formatting" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Bold" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Insert table" })).toBeTruthy();
    expect(screen.getByRole("textbox", { name: "Email message" }).textContent).toBe("Hello");
    act(() => ref.current?.insertText(" {{documentNumber}}"));
    await waitFor(() => expect(onChange).toHaveBeenCalled());
    expect(onChange.mock.calls.at(-1)?.[0]).toContain("{{documentNumber}}");
  });

  it("draws an offered placeholder as a chip and one the event does not offer as a mistake", async () => {
    render(<RichTextEditor value="<p>Copy {{documentNumber}} and {{nonsense}}</p>" onChange={() => undefined} allowedTokens={["documentNumber"]} />);
    await screen.findByRole("toolbar");
    await waitFor(() => expect(document.querySelectorAll(".rt-token").length).toBe(2));
    expect(document.querySelectorAll(".rt-token-unknown").length).toBe(1);
    expect(document.querySelector(".rt-token-unknown")?.textContent).toBe("{{nonsense}}");
  });

  it("cannot be changed when it is read only", async () => {
    render(<RichTextEditor value="<p>Locked</p>" onChange={() => undefined} disabled />);
    await screen.findByRole("toolbar");
    expect((screen.getByRole("button", { name: "Bold" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole("textbox").getAttribute("contenteditable")).toBe("false");
  });

  it("only accepts a web address (or a placeholder) as a link", async () => {
    render(<RichTextEditor value="<p>x</p>" onChange={() => undefined} />);
    await screen.findByRole("toolbar");
    fireEvent.click(screen.getByRole("button", { name: "Link" }));
    const box = screen.getByRole("textbox", { name: "Link address" }) as HTMLInputElement;
    fireEvent.change(box, { target: { value: "javascript:alert(1)" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(screen.getByRole("textbox", { name: "Link address" })).toBeTruthy(); // refused: the box stays open
  });
});

describe("TokenTextField", () => {
  const Harness = ({ allowed }: { allowed: string[] | null }) => {
    const [value, setValue] = React.useState("Return copy ");
    const ref = React.useRef<TokenTextFieldHandle>(null);
    return (
      <>
        <TokenTextField ref={ref} ariaLabel="Title" value={value} onChange={setValue} allowedTokens={allowed} />
        <button onClick={() => ref.current?.insertText("{{controlledCopyNumber}}")}>insert</button>
      </>
    );
  };

  it("puts a placeholder where the cursor is", () => {
    render(<Harness allowed={["controlledCopyNumber"]} />);
    const input = screen.getByRole("textbox", { name: "Title" }) as HTMLInputElement;
    input.focus();
    input.setSelectionRange(5, 5);
    fireEvent.click(screen.getByText("insert"));
    expect(input.value).toBe("Retur{{controlledCopyNumber}}n copy ");
  });

  it("says when a placeholder is not offered and stays quiet when it is", () => {
    const { rerender } = render(<TokenTextField ariaLabel="Title" value="Hello {{nope}}" onChange={() => undefined} allowedTokens={["documentNumber"]} />);
    expect(screen.getByRole("alert").textContent).toContain("{{nope}}");
    expect(screen.getByRole("textbox").getAttribute("aria-invalid")).toBe("true");
    rerender(<TokenTextField ariaLabel="Title" value="Hello {{documentNumber}}" onChange={() => undefined} allowedTokens={["documentNumber"]} />);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("keeps to its length limit", () => {
    const onChange = vi.fn();
    render(<TokenTextField ariaLabel="Title" value="abcd" onChange={onChange} maxLength={5} />);
    expect(screen.getByText("4/5")).toBeTruthy();
  });
});

describe("tokensIn", () => {
  it("lists each placeholder once, in order, whatever the spaces inside", () => {
    expect(tokensIn("{{a}} and {{ b }} and {{a}} {not} {{c d}}")).toEqual(["a", "b"]);
    expect(tokensIn(null)).toEqual([]);
  });
});

describe("VariablePalette: nothing to type or remember", () => {
  const variables = [
    { name: "documentNumber", token: "{{documentNumber}}", label: "Document number", sample: "SOP.0001" },
    { name: "recallReason", token: "{{recallReason}}", label: "Recall reason", sample: "Obsoleted" },
  ];

  it("lists every placeholder with what it stands for and an example, and inserts the one clicked", () => {
    const onInsert = vi.fn();
    render(<VariablePalette variables={variables} onInsert={onInsert} target="Email message" />);
    expect(screen.getByText("{{documentNumber}}")).toBeTruthy();
    expect(screen.getByText(/Document number/)).toBeTruthy();
    expect(screen.getByText("SOP.0001")).toBeTruthy();
    expect(screen.getByText("Email message")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Insert {{recallReason}}" }));
    expect(onInsert).toHaveBeenCalledWith("{{recallReason}}");
  });

  it("copies the token to the clipboard and says so", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    render(<VariablePalette variables={variables} onInsert={() => undefined} />);
    fireEvent.click(screen.getByRole("button", { name: "Copy {{documentNumber}}" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith("{{documentNumber}}"));
    await waitFor(() => expect(toast.showToast).toHaveBeenCalledWith(expect.objectContaining({ type: "success", title: "Copied" })));
  });

  it("says so when there is nothing to offer", () => {
    render(<VariablePalette variables={[]} onInsert={() => undefined} />);
    expect(screen.getByText("This notification offers no placeholders.")).toBeTruthy();
  });
});
