import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ browse: vi.fn() }));
vi.mock("@/services/api/knowledge", () => ({ knowledgeApi: api }));

import { ExplorerLibraryTree } from "../ExplorerLibraryTree";

const overview = {
  selectedHierarchyId: "h1",
  knowledgeBases: [
    { key: "mfg", label: "Manufacturing", documentCount: 3, subscribed: true },
    { key: "qa", label: "Quality", documentCount: 2, subscribed: false },
  ],
} as never;

const folders = (...names: string[]) => ({ path: [], folders: names.map((name) => ({ key: name.toLowerCase(), label: name, documentCount: 1 })), documents: [] });

beforeEach(() => api.browse.mockReset());
afterEach(cleanup);

describe("ExplorerLibraryTree", () => {
  it("reads a Knowledge Base's folders only when it is opened, then opens a folder in the main pane", async () => {
    api.browse.mockResolvedValue(folders("QC Laboratory"));
    const onGo = vi.fn();
    render(<ExplorerLibraryTree overview={overview} nav={{ kind: "home" }} onGo={onGo} />);
    expect(api.browse).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Toggle Manufacturing" }));
    expect(api.browse).toHaveBeenCalledWith("h1", "mfg", []);
    fireEvent.click(await screen.findByRole("button", { name: /^QC Laboratory/ }));

    expect(onGo).toHaveBeenCalledWith({ kind: "kb", kb: { key: "mfg", label: "Manufacturing" }, path: ["qc laboratory"] });
  });

  it("opens by itself down to the current folder and marks it", async () => {
    api.browse.mockImplementation(async (...args: unknown[]) => { const path = (args[2] as string[] | undefined) ?? []; return (path.length === 0 ? folders("Labs") : folders("HPLC")); });
    render(<ExplorerLibraryTree overview={overview} nav={{ kind: "kb", kb: { key: "mfg", label: "Manufacturing" }, path: ["labs"] }} onGo={vi.fn()} />);

    const labs = await screen.findByRole("button", { name: /^Labs/ });
    expect(labs).toHaveAttribute("aria-current", "page");
    expect(await screen.findByRole("button", { name: /^HPLC/ })).toBeInTheDocument();
    expect(api.browse).toHaveBeenCalledTimes(2);
  });

  it("says so when a level cannot be read, and tries again on request", async () => {
    api.browse.mockRejectedValueOnce(new Error("x")).mockResolvedValueOnce(folders("Labs"));
    render(<ExplorerLibraryTree overview={overview} nav={{ kind: "home" }} onGo={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Toggle Quality" }));
    fireEvent.click(await screen.findByRole("button", { name: /Could not load/ }));
    await waitFor(() => expect(within(screen.getByRole("tree")).getByRole("button", { name: /^Labs/ })).toBeInTheDocument());
  });
});
