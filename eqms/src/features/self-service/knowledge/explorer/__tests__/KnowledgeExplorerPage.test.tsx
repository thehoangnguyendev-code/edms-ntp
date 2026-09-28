import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

const stableToast = { showToast: vi.fn() };
vi.mock("@/components/ui/toast", () => ({ useToast: () => stableToast }));
vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => ({ hasPermissionAlias: () => true }) }));
vi.mock("@/components/branding/BrandLogo", () => ({
  useBranding: () => ({ systemDisplayName: "EQMS Test", systemLogo: "" }),
  BrandLogo: ({ className }: { className?: string }) => <img alt="EQMS Test logo" className={className} />,
}));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { fullName: "Test User" } }) }));

const { knowledgeApiMock } = vi.hoisted(() => ({
  knowledgeApiMock: {
    overview: vi.fn(),
    browse: vi.fn(),
    search: vi.fn(),
    recordView: vi.fn(async () => undefined),
    giveFeedback: vi.fn(async () => undefined),
    setFeatured: vi.fn(async () => undefined),
    setSubscribed: vi.fn(async () => undefined),
  },
}));
vi.mock("@/services/api/knowledge", () => ({ knowledgeApi: knowledgeApiMock }));

import { KnowledgeExplorerPage } from "../KnowledgeExplorerPage";

const doc = (id: string, name: string, extra: Record<string, unknown> = {}) => ({
  document: { id, documentNumber: `SOP.${id}`, documentName: name, documentType: "SOP", department: "Lab", revisionNumber: "1.0", businessUnit: "Manufacturing", effectiveDate: "03/09/2026" },
  views: 12,
  helpfulVotes: 4,
  featured: false,
  myFeedback: null,
  ...extra,
});

const overview = {
  hierarchies: [{ id: "h1", name: "BU Hierarchy", isDefault: true }],
  selectedHierarchyId: "h1",
  selectedHierarchyName: "BU Hierarchy",
  determinatorField: "BUSINESS_UNIT",
  determinatorLabel: "Business Unit",
  levelLabels: ["Department"],
  totalDocuments: 5,
  totalKnowledgeBases: 2,
  knowledgeBases: [
    { key: "mfg", label: "Manufacturing", documentCount: 3, subscribed: false },
    { key: "qa", label: "Quality", documentCount: 2, subscribed: true },
  ],
  featured: [doc("f1", "Featured cleaning SOP", { featured: true })],
  mostViewed: [doc("v1", "Most viewed SOP", { views: 90 })],
  mostUseful: [doc("u1", "Most useful SOP", { helpfulVotes: 30 })],
};

const browseFolders = {
  path: [{ fieldLabel: "Business Unit", key: "mfg", label: "Manufacturing" }],
  nextFieldLabel: "Department",
  folders: [{ key: "lab", label: "QC Laboratory", documentCount: 2 }],
  documents: [],
};
const browseDocs = {
  path: [
    { fieldLabel: "Business Unit", key: "mfg", label: "Manufacturing" },
    { fieldLabel: "Department", key: "lab", label: "QC Laboratory" },
  ],
  nextFieldLabel: null,
  folders: [],
  documents: [doc("d1", "Balance calibration"), doc("d2", "HPLC dissolution testing")],
};

const LocationProbe: React.FC = () => <div>classic-view</div>;

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={["/explorer"]}>
      <Routes>
        <Route path="/explorer" element={<KnowledgeExplorerPage />} />
        <Route path="/self-service/knowledge" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
  );

const folder = (name: string) => screen.getByRole("option", { name: new RegExp(name) });

describe("KnowledgeExplorerPage", () => {
  let openSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    knowledgeApiMock.overview.mockResolvedValue(overview);
    knowledgeApiMock.browse.mockImplementation(async (_h: unknown, _kb: string, path: string[]) => (path.length === 0 ? browseFolders : browseDocs));
    knowledgeApiMock.search.mockResolvedValue([doc("s1", "Deviation handling")]);
    openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
  });

  afterEach(() => openSpy.mockRestore());

  it("shows the knowledge bases as folders with their document counts and the widgets", async () => {
    renderPage();
    expect(await screen.findByRole("option", { name: /Manufacturing/ })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Welcome back, Test User" })).toBeTruthy();
    expect(within(folder("Manufacturing")).getByText("3 documents")).toBeTruthy();
    expect(within(folder("Quality")).getByText("2 documents")).toBeTruthy();
    for (const title of ["Most viewed", "Most helpful", "Featured", "Subscriptions", "At a glance"]) {
      expect(screen.getByRole("region", { name: title })).toBeTruthy();
    }
    expect(screen.getByText("Most viewed SOP")).toBeTruthy();
    expect(document.title).toBe("EQMS Test · Knowledge Base");
  });

  it("opens a folder on double-click, walks down the hierarchy and back up", async () => {
    renderPage();
    fireEvent.doubleClick(await screen.findByRole("option", { name: /Manufacturing/ }));
    await waitFor(() => expect(knowledgeApiMock.browse).toHaveBeenCalledWith("h1", "mfg", []));
    fireEvent.doubleClick(await screen.findByRole("option", { name: /QC Laboratory/ }));
    await waitFor(() => expect(knowledgeApiMock.browse).toHaveBeenCalledWith("h1", "mfg", ["lab"]));
    expect(await screen.findByText("Balance calibration")).toBeTruthy();
    const location = screen.getByRole("navigation", { name: "Location" });
    expect(within(location).getByText("QC Laboratory").getAttribute("aria-current")).toBe("page");

    fireEvent.click(screen.getByLabelText("Up one level"));
    expect(await screen.findByRole("option", { name: /QC Laboratory/ })).toBeTruthy();
    // Up is a navigation step of its own, so Back returns to the folder that was left.
    fireEvent.click(screen.getByLabelText("Back"));
    expect(await screen.findByText("Balance calibration")).toBeTruthy();
    fireEvent.click(screen.getByLabelText("Forward"));
    expect(await screen.findByRole("option", { name: /QC Laboratory/ })).toBeTruthy();
  });

  it("selects a document to show its details and opens the preview in a new tab", async () => {
    renderPage();
    fireEvent.doubleClick(await screen.findByRole("option", { name: /Manufacturing/ }));
    fireEvent.doubleClick(await screen.findByRole("option", { name: /QC Laboratory/ }));
    fireEvent.click(await screen.findByRole("option", { name: /HPLC dissolution testing/ }));
    const dialog = await screen.findByRole("dialog", { name: "Details" });
    expect(within(dialog).getByText("HPLC dissolution testing")).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: /Open document/ }));
    expect(knowledgeApiMock.recordView).toHaveBeenCalledWith("d2");
    const url = String(openSpy.mock.calls[0][0]);
    expect(url).toContain("/documents/knowledge/preview/d2");
    expect(url).toContain("number=SOP.d2");
    expect(openSpy.mock.calls[0][1]).toBe("_blank");
  });

  it("marks a document helpful and can feature it", async () => {
    renderPage();
    fireEvent.doubleClick(await screen.findByRole("option", { name: /Manufacturing/ }));
    fireEvent.doubleClick(await screen.findByRole("option", { name: /QC Laboratory/ }));
    fireEvent.click(await screen.findByRole("option", { name: /Balance calibration/ }));
    const dialog = await screen.findByRole("dialog", { name: "Details" });
    fireEvent.click(within(dialog).getByRole("button", { name: /Mark helpful/ }));
    await waitFor(() => expect(knowledgeApiMock.giveFeedback).toHaveBeenCalledWith("d1", true));
    fireEvent.click(within(dialog).getByRole("button", { name: /^Feature$/ }));
    await waitFor(() => expect(knowledgeApiMock.setFeatured).toHaveBeenCalledWith("d1", true));
  });

  it("subscribes and unsubscribes from a knowledge base with the determinator of the hierarchy", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Subscribe to Manufacturing" }));
    await waitFor(() => expect(knowledgeApiMock.setSubscribed).toHaveBeenCalledWith("BUSINESS_UNIT", "mfg", true));
    fireEvent.click(screen.getByRole("button", { name: "Unsubscribe from Quality", hidden: false, pressed: true }));
    await waitFor(() => expect(knowledgeApiMock.setSubscribed).toHaveBeenCalledWith("BUSINESS_UNIT", "qa", false));
    expect(stableToast.showToast).toHaveBeenCalledWith(expect.objectContaining({ type: "success", title: "Subscribed" }));
  });

  it("searches all documents after three characters and clears the search", async () => {
    renderPage();
    await screen.findByRole("option", { name: /Manufacturing/ });
    const input = screen.getByLabelText("Search all documents");
    fireEvent.change(input, { target: { value: "de" } });
    expect(await screen.findByText("Keep typing")).toBeTruthy();
    expect(knowledgeApiMock.search).not.toHaveBeenCalled();
    fireEvent.change(input, { target: { value: "devi" } });
    await waitFor(() => expect(knowledgeApiMock.search).toHaveBeenCalledWith("devi"));
    expect(await screen.findByRole("option", { name: /Deviation handling/ })).toBeTruthy();
    fireEvent.click(screen.getByLabelText("Clear search"));
    expect(await screen.findByRole("option", { name: /Manufacturing/ })).toBeTruthy();
  });

  it("says so when a search finds nothing", async () => {
    knowledgeApiMock.search.mockResolvedValue([]);
    renderPage();
    await screen.findByRole("option", { name: /Manufacturing/ });
    fireEvent.change(screen.getByLabelText("Search all documents"), { target: { value: "zzzz" } });
    expect(await screen.findByText('No documents match "zzzz"')).toBeTruthy();
  });

  it("lists a ranked smart folder from the sidebar without re-sorting it", async () => {
    knowledgeApiMock.overview.mockResolvedValue({
      ...overview,
      mostViewed: [doc("v1", "Zulu most viewed", { views: 90 }), doc("v2", "Alpha second", { views: 10 })],
    });
    renderPage();
    await screen.findByRole("option", { name: /Manufacturing/ });
    const sidebar = screen.getByRole("navigation", { name: "Knowledge Base navigation" });
    fireEvent.click(within(sidebar).getByRole("button", { name: /Most viewed/ }));
    await waitFor(() => {
      const items = Array.from(document.querySelectorAll("[data-item]"));
      expect(items.map((o) => o.textContent)).toEqual([expect.stringContaining("Zulu most viewed"), expect.stringContaining("Alpha second")]);
    });
  });

  it("switches to the list view and remembers it", async () => {
    renderPage();
    fireEvent.doubleClick(await screen.findByRole("option", { name: /Manufacturing/ }));
    fireEvent.doubleClick(await screen.findByRole("option", { name: /QC Laboratory/ }));
    await screen.findByText("Balance calibration");
    fireEvent.click(screen.getByLabelText("List view"));
    expect(await screen.findByRole("columnheader", { name: "Name" })).toBeTruthy();
    expect(window.localStorage.getItem("eqms.knowledgeExplorer.view")).toBe("list");
  });

  it("hides the widgets on request", async () => {
    renderPage();
    await screen.findByRole("region", { name: "Most viewed" });
    fireEvent.click(screen.getByLabelText("Show widgets"));
    await waitFor(() => expect(screen.queryByRole("region", { name: "Most viewed" })).toBeNull());
    expect(window.localStorage.getItem("eqms.knowledgeExplorer.widgets")).toBe("off");
  });

  it("explains an unconfigured hierarchy instead of showing a blank page", async () => {
    knowledgeApiMock.overview.mockResolvedValue({ ...overview, selectedHierarchyId: null, hierarchies: [], knowledgeBases: [], totalKnowledgeBases: 0, totalDocuments: 0 });
    renderPage();
    expect((await screen.findAllByText(/No hierarchy/)).length).toBeGreaterThan(0);
  });

  it("offers a retry when loading fails", async () => {
    knowledgeApiMock.overview.mockRejectedValueOnce(new Error("boom"));
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: /Try again/ }));
    expect(await screen.findByRole("option", { name: /Manufacturing/ })).toBeTruthy();
  });

  it("offers the actions of a document on right-click and runs the chosen one", async () => {
    renderPage();
    fireEvent.doubleClick(await screen.findByRole("option", { name: /Manufacturing/ }));
    fireEvent.doubleClick(await screen.findByRole("option", { name: /QC Laboratory/ }));
    fireEvent.contextMenu(await screen.findByRole("option", { name: /Balance calibration/ }), { clientX: 40, clientY: 40 });
    const menu = await screen.findByRole("menu", { name: "Actions" });
    expect(within(menu).getAllByRole("button").map((i) => i.textContent)).toEqual([
      "Open document", "Mark as helpful", "Feature this document", "Copy document number",
    ]);
    fireEvent.click(within(menu).getByText("Mark as helpful"));
    await waitFor(() => expect(knowledgeApiMock.giveFeedback).toHaveBeenCalledWith("d1", true));
    await waitFor(() => expect(screen.queryByRole("menu", { name: "Actions" })).toBeNull());
  });

  it("offers subscribe on a knowledge base folder and closes the menu with Escape", async () => {
    renderPage();
    fireEvent.contextMenu(await screen.findByRole("option", { name: /Manufacturing/ }), { clientX: 10, clientY: 10 });
    const menu = await screen.findByRole("menu", { name: "Actions" });
    expect(within(menu).getByText("Subscribe to new documents")).toBeTruthy();
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("menu", { name: "Actions" })).toBeNull());
  });

  it("shows the configured application logo in the sidebar header, like the main menu", async () => {
    renderPage();
    const nav = await screen.findByRole("navigation", { name: "Knowledge Base navigation" });
    expect(within(nav).getByAltText("EQMS Test logo")).toBeTruthy();
    expect(within(nav).getByRole("heading", { name: "Knowledge Base" })).toBeTruthy();
  });

  it("links back to the classic view", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: /Open classic view/ }));
    expect(await screen.findByText("classic-view")).toBeTruthy();
  });

  it("opens a folder with a single tap on touch devices", async () => {
    const original = window.matchMedia;
    window.matchMedia = ((query: string) => ({
      matches: query.includes("pointer: coarse"),
      media: query, addEventListener: () => undefined, removeEventListener: () => undefined,
      addListener: () => undefined, removeListener: () => undefined, onchange: null, dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;
    try {
      renderPage();
      fireEvent.click(await screen.findByRole("option", { name: /Manufacturing/ }));
      await waitFor(() => expect(knowledgeApiMock.browse).toHaveBeenCalledWith("h1", "mfg", []));
    } finally {
      window.matchMedia = original;
    }
  });
});
