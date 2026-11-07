import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

// These tests exercise navigation and server requests, not animation timing.
// Wait-mode exit animations otherwise depend on RAF scheduling under suite load.
vi.mock("framer-motion", async (importOriginal) => {
  const actual = await importOriginal<typeof import("framer-motion")>();
  return {
    ...actual,
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    useReducedMotion: () => true,
  };
});

const stableToast = { showToast: vi.fn() };
vi.mock("@/components/ui/toast", () => ({ useToast: () => stableToast }));
vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => ({ hasPermissionAlias: () => true }) }));
const brandingState = vi.hoisted(() => ({ names: "FULL" as "FULL" | "ABBREVIATION", sidebar: undefined as "FULL" | "ABBREVIATION" | undefined }));
vi.mock("@/components/branding/BrandLogo", () => ({
  useBranding: () => ({ systemDisplayName: "EQMS Test", systemLogo: "", knowledgeFolderNames: brandingState.names, knowledgeSidebarFolderNames: brandingState.sidebar }),
  BrandLogo: ({ className }: { className?: string }) => <img alt="EQMS Test logo" className={className} />,
}));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { fullName: "Test User" } }) }));

const { knowledgeApiMock } = vi.hoisted(() => ({
  knowledgeApiMock: {
    overview: vi.fn(),
    browse: vi.fn(),
    search: vi.fn(),
    queryDocuments: vi.fn(),
    suggest: vi.fn(async () => []),
    recordView: vi.fn(async () => undefined),
    giveFeedback: vi.fn(async () => undefined),
    setFeatured: vi.fn(async () => undefined),
    setSubscribed: vi.fn(async () => undefined),
    folderStyles: vi.fn(async () => [{ id: "mfg", name: "Manufacturing", abbreviation: "MFG", color: "#e11d48" }]),
    documentTypeIcons: vi.fn(async () => [{ name: "SOP", shortCode: "SOP", iconLabel: "PROC", iconColor: "#e11d48" }]),
    sharingManaged: vi.fn(async () => ({ departmentIds: [] as string[], businessUnitIds: [] as string[] })),
    sharingFolder: vi.fn(),
    sharingAccess: vi.fn(),
    sharingOptions: vi.fn(async () => ({ positions: [], departments: [] })),
    sharingUsers: vi.fn(async () => []),
    sharingGrant: vi.fn(),
    sharingRevoke: vi.fn(async () => undefined),
    sharingPeople: vi.fn(async () => ({ items: [] as unknown[], total: 0 })),
    sharingRevokeGrantee: vi.fn(async () => undefined),
    sharingLinks: vi.fn(async () => ({ items: [] as unknown[], total: 0 })),
    sharingDelegates: vi.fn(async () => ({ items: [] as unknown[], total: 0 })),
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
  totalDocuments: 2,
  page: 1,
  limit: 20,
  path: [
    { fieldLabel: "Business Unit", key: "mfg", label: "Manufacturing" },
    { fieldLabel: "Department", key: "lab", label: "QC Laboratory" },
  ],
  nextFieldLabel: null,
  folders: [],
  documents: [doc("d1", "Balance calibration"), doc("d2", "HPLC dissolution testing")],
};


const renderPage = () =>
  render(
    <MemoryRouter initialEntries={["/explorer"]}>
      <Routes>
        <Route path="/explorer" element={<KnowledgeExplorerPage />} />
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
    knowledgeApiMock.queryDocuments.mockImplementation(async (options) => {
      const current = await knowledgeApiMock.overview();
      const documents = options.collection === "viewed" ? current.mostViewed : options.collection === "featured" ? current.featured
        : options.collection === "useful" ? current.mostUseful : await knowledgeApiMock.search();
      return { documents, totalDocuments: documents.length, page: options.page, limit: options.limit, folders: [], path: [] };
    });
    openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
  });

  afterEach(() => openSpy.mockRestore());

  it("shows the knowledge bases as folders with their document counts and the widgets", async () => {
    renderPage();
    expect(await screen.findByRole("option", { name: /Manufacturing/ })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Welcome to Knowledge , Test User" })).toBeTruthy();
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
    await waitFor(() => expect(knowledgeApiMock.browse).toHaveBeenCalledWith("h1", "mfg", [], expect.objectContaining({ page: 1, limit: 20 })));
    fireEvent.doubleClick(await screen.findByRole("option", { name: /QC Laboratory/ }));
    await waitFor(() => expect(knowledgeApiMock.browse).toHaveBeenCalledWith("h1", "mfg", ["lab"], expect.objectContaining({ page: 1, limit: 20 })));
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

  // "View Details" of the right-click menu opens the details in a modal (there is no panel on the right any more)
  const viewDetails = async (name: RegExp) => {
    fireEvent.contextMenu(await screen.findByRole("option", { name }), { clientX: 30, clientY: 30 });
    fireEvent.click(await within(await screen.findByRole("menu", { name: "Actions" })).findByText("View Details"));
    return screen.findByRole("dialog", { name: "Document Details" });
  };

  it("shows the details of a document in a modal from the right-click menu and opens the preview in a new tab", async () => {
    renderPage();
    fireEvent.doubleClick(await screen.findByRole("option", { name: /Manufacturing/ }));
    fireEvent.doubleClick(await screen.findByRole("option", { name: /QC Laboratory/ }));
    expect(screen.queryByRole("complementary", { name: "Details" })).toBeNull();
    const dialog = await viewDetails(/HPLC dissolution testing/);
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
    const dialog = await viewDetails(/Balance calibration/);
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
    expect(knowledgeApiMock.queryDocuments).not.toHaveBeenCalled();
    fireEvent.change(input, { target: { value: "devi" } });
    await waitFor(() => expect(knowledgeApiMock.queryDocuments).toHaveBeenCalledWith(expect.objectContaining({ search: "devi", page: 1, limit: 20 })));
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
    fireEvent.click(within(sidebar).getByRole("button", { name: /Most Viewed/ }));
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
      "Open Document", "View Details", "Mark As Helpful", "Feature This document", "Copy Document Number",
    ]);
    fireEvent.click(within(menu).getByText("Mark As Helpful"));
    await waitFor(() => expect(knowledgeApiMock.giveFeedback).toHaveBeenCalledWith("d1", true));
    await waitFor(() => expect(screen.queryByRole("menu", { name: "Actions" })).toBeNull());
  });

  describe("sharing, for a Department Head only", () => {
    const access = (extra: Record<string, unknown> = {}) => ({
      node: {
        shareable: true, reason: null, kind: "DOCUMENT", businessUnitId: "bu1", businessUnitName: "Quality Unit", departmentId: "dep1", departmentName: "QC Laboratory",
        documentTypeId: null, documentId: "d1", label: "SOP.d1 - Balance calibration", canManage: true, level: "DEPARTMENT_HEAD", canExclude: true, canManageDelegates: true, ...extra,
      },
      entries: [],
    });

    it("does not offer Share to a user who heads no Department", async () => {
      renderPage();
      fireEvent.doubleClick(await screen.findByRole("option", { name: /Manufacturing/ }));
      fireEvent.doubleClick(await screen.findByRole("option", { name: /QC Laboratory/ }));
      fireEvent.contextMenu(await screen.findByRole("option", { name: /Balance calibration/ }), { clientX: 40, clientY: 40 });
      const menu = await screen.findByRole("menu", { name: "Actions" });
      expect(within(menu).queryByText(/^Share/)).toBeNull();
    });

    it("offers Share on a document, opens the dialog and asks the server who has access", async () => {
      knowledgeApiMock.sharingManaged.mockResolvedValue({ departmentIds: ["dep1"], businessUnitIds: [] });
      knowledgeApiMock.sharingAccess.mockResolvedValue(access({ kind: "DOCUMENT" }));
      renderPage();
      fireEvent.doubleClick(await screen.findByRole("option", { name: /Manufacturing/ }));
      fireEvent.doubleClick(await screen.findByRole("option", { name: /QC Laboratory/ }));
      await waitFor(() => expect(knowledgeApiMock.sharingManaged).toHaveBeenCalled());
      fireEvent.contextMenu(await screen.findByRole("option", { name: /Balance calibration/ }), { clientX: 40, clientY: 40 });
      const menu = await screen.findByRole("menu", { name: "Actions" });
      fireEvent.click(await within(menu).findByText("Share"));
      await waitFor(() => expect(knowledgeApiMock.sharingAccess).toHaveBeenCalledWith(expect.objectContaining({ kind: "DOCUMENT", documentId: "d1" })));
      expect(await screen.findByText("Who has access")).toBeTruthy();
      expect(screen.getByText("Nobody except the Heads can see this yet.")).toBeTruthy();
    });

    it("asks the server what a folder is, with the Knowledge Base and the keys of the levels down to the folder", async () => {
      knowledgeApiMock.sharingManaged.mockResolvedValue({ departmentIds: ["dep1"], businessUnitIds: [] });
      knowledgeApiMock.sharingFolder.mockResolvedValue({ shareable: false, reason: "Open a Department folder to share it.", kind: null, businessUnitId: null, businessUnitName: null, departmentId: null, departmentName: null, documentTypeId: null, documentId: null, label: null, canManage: false, level: "NONE", canExclude: false, canManageDelegates: false });
      renderPage();
      fireEvent.doubleClick(await screen.findByRole("option", { name: /Manufacturing/ }));
      const lab = await screen.findByRole("option", { name: /QC Laboratory/ });
      await waitFor(() => expect(knowledgeApiMock.sharingManaged).toHaveBeenCalled());
      fireEvent.contextMenu(lab, { clientX: 20, clientY: 20 });
      const menu = await screen.findByRole("menu", { name: "Actions" });
      fireEvent.click(await within(menu).findByText("Share..."));
      await waitFor(() => expect(knowledgeApiMock.sharingFolder).toHaveBeenCalledWith("h1", "mfg", ["lab"]));
      expect(await screen.findByText("Open a Department folder to share it.")).toBeTruthy();
      expect(knowledgeApiMock.sharingAccess).not.toHaveBeenCalled();
    });

    it("shows the shares an item inherits and removes one that is on the item itself", async () => {
      knowledgeApiMock.sharingManaged.mockResolvedValue({ departmentIds: ["dep1"], businessUnitIds: [] });
      const entries = [
        { ruleId: "r1", effect: "ALLOW", scopeKind: "DOCUMENT", scopeLabel: "Document: SOP.d1", inherited: false, removable: true, grantees: ["Position: QC Staff"], chips: [{ label: "Position: QC Staff", canShare: false }], createdBy: "Head", createdByLevel: "DEPARTMENT_HEAD", createdAt: "03/11/2026 10:00", createdByMe: true },
        { ruleId: "r2", effect: "ALLOW", scopeKind: "DEPARTMENT", scopeLabel: "Whole Department", inherited: true, removable: false, grantees: ["Everyone"], chips: [{ label: "Everyone", canShare: false }], createdBy: null, createdByLevel: "DEPARTMENT_HEAD", createdAt: null, createdByMe: false },
      ];
      knowledgeApiMock.sharingAccess.mockResolvedValueOnce({ ...access(), entries }).mockResolvedValue({ ...access(), entries: [entries[1]] });
      const rows = [
        { ruleId: "r1", effect: "ALLOW", granteeType: "POSITION", granteeId: "p1", label: "Position: QC Staff", detail: null, canShare: false, inherited: false, removable: true, scopeLabel: "Document: SOP.d1", createdBy: "Head", createdByLevel: "DEPARTMENT_HEAD", createdAt: "03/11/2026 10:00", createdByMe: true },
        { ruleId: "r2", effect: "ALLOW", granteeType: "EVERYONE", granteeId: null, label: "Everyone", detail: null, canShare: false, inherited: true, removable: false, scopeLabel: "Whole Department", createdBy: null, createdByLevel: "DEPARTMENT_HEAD", createdAt: null, createdByMe: false },
      ];
      knowledgeApiMock.sharingPeople.mockResolvedValue({ items: rows, total: 2 });
      renderPage();
      fireEvent.doubleClick(await screen.findByRole("option", { name: /Manufacturing/ }));
      fireEvent.doubleClick(await screen.findByRole("option", { name: /QC Laboratory/ }));
      await waitFor(() => expect(knowledgeApiMock.sharingManaged).toHaveBeenCalled());
      fireEvent.contextMenu(await screen.findByRole("option", { name: /Balance calibration/ }), { clientX: 40, clientY: 40 });
      fireEvent.click(await within(await screen.findByRole("menu", { name: "Actions" })).findByText("Share"));
      expect(await screen.findByText("Position: QC Staff")).toBeTruthy();
      expect(screen.getByText(/From Whole Department/)).toBeTruthy();
      expect(screen.getByText("Inherited")).toBeTruthy();
      fireEvent.click(screen.getByRole("button", { name: "Remove Position: QC Staff" }));
      // the confirmation dialog has its own Remove button, the last one in the page
      const removeButtons = await screen.findAllByRole("button", { name: "Remove" });
      expect(removeButtons.length).toBeGreaterThan(0);
      fireEvent.click(removeButtons[removeButtons.length - 1]);
      await waitFor(() => expect(knowledgeApiMock.sharingRevokeGrantee).toHaveBeenCalledWith("r1", "POSITION", "p1"));
    });
  });

  it("opens straight at the folder a link points to", async () => {
    // a link made by a Head leads here: ?kb=<key>&kbLabel=<name>&path=<key>&hierarchyId=<id>
    render(
      <MemoryRouter initialEntries={["/documents/knowledge/explorer?kb=mfg&kbLabel=Manufacturing&path=lab&hierarchyId=h1"]}>
        <Routes>
          <Route path="/documents/knowledge/explorer" element={<KnowledgeExplorerPage />} />
        </Routes>
      </MemoryRouter>,
    );
    await waitFor(() => expect(knowledgeApiMock.browse).toHaveBeenCalledWith("h1", "mfg", ["lab"], expect.objectContaining({ page: 1 })));
    expect(await screen.findByRole("option", { name: /Balance calibration/ })).toBeTruthy();
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

describe("KnowledgeExplorerPage document table", () => {
  const manyDocs = {
    ...browseDocs,
    documents: [
      doc("d1", "Balance calibration", { sizeBytes: 2_621_440, myLastOpenedAt: "2026-10-05T10:30:00Z" }),
      doc("d2", "HPLC dissolution testing", { sizeBytes: null, myLastOpenedAt: null }),
    ],
    totalDocuments: 45,
    page: 1,
    limit: 20,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    window.localStorage.setItem("eqms.knowledgeExplorer.view", "list");
    knowledgeApiMock.overview.mockResolvedValue(overview);
    knowledgeApiMock.browse.mockImplementation(async (_h: unknown, _kb: string, path: string[]) => (path.length === 0 ? browseFolders : manyDocs));
    vi.spyOn(window, "open").mockImplementation(() => null);
  });

  const openLab = async () => {
    fireEvent.doubleClick(await screen.findByRole("option", { name: /Manufacturing/ }));
    fireEvent.doubleClick(await screen.findByRole("option", { name: /QC Laboratory/ }));
    await screen.findByText("Balance calibration");
  };

  it("shows each document's size and when you last opened it, and says so when you never did", async () => {
    renderPage();
    await openLab();

    expect(screen.getByText("2.5 MB")).toBeTruthy();
    expect(screen.getByText("Never opened")).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: /Last update/i })).toBeTruthy();
  });

  it("asks the server to sort when a column header is pressed, flipping the direction on a second press", async () => {
    renderPage();
    await openLab();
    const lastCall = () => knowledgeApiMock.browse.mock.calls.filter((call) => call[2]?.length === 1).at(-1);

    fireEvent.click(within(screen.getByRole("columnheader", { name: /^Size/i })).getByRole("button"));
    await waitFor(() => expect(lastCall()?.[3]).toMatchObject({ sortBy: "size", sortDirection: "desc", page: 1, limit: 20 }));
    fireEvent.click(within(screen.getByRole("columnheader", { name: /^Size/i })).getByRole("button"));
    await waitFor(() => expect(lastCall()?.[3]).toMatchObject({ sortBy: "size", sortDirection: "asc" }));
  });

  it("pages the number of documents the user chose (up to 100) and remembers it", async () => {
    window.localStorage.setItem("eqms.knowledgeExplorer.pageSize", "100");
    try {
      renderPage();
      await openLab();
      const lastCall = () => knowledgeApiMock.browse.mock.calls.filter((call) => call[2]?.length === 1).at(-1);
      expect(lastCall()?.[3]).toMatchObject({ page: 1, limit: 100 });
    } finally {
      window.localStorage.removeItem("eqms.knowledgeExplorer.pageSize");
    }
  });

  it("draws the folder of a Business Unit in the colour it was given and the others in an automatic one", async () => {
    renderPage();
    const mfg = await screen.findByRole("option", { name: /Manufacturing/ });
    await waitFor(() => expect(mfg.querySelector("svg rect")?.getAttribute("fill")).toBe("#e11d48"));
    const quality = screen.getByRole("option", { name: /Quality/ });
    expect(quality.querySelector("svg rect")?.getAttribute("fill")).not.toBe("#e11d48");
  });

  it("shakes the icon of a Quick access button once when it is pressed", async () => {
    renderPage();
    const sidebar = await screen.findByRole("navigation", { name: "Knowledge Base navigation" });
    const button = within(sidebar).getByRole("button", { name: /Most Viewed/ });
    const before = button.querySelector("span.inline-flex");
    fireEvent.click(button);
    // a new element for each press: the animation starts again
    await waitFor(() => expect(within(sidebar).getByRole("button", { name: /Most Viewed/ }).querySelector("span.inline-flex")).not.toBe(before));
  });

  it("names the folders by their abbreviation when the administrator chose that, and keeps the full name as the tooltip", async () => {
    brandingState.names = "ABBREVIATION";
    try {
      renderPage();
      const mfg = await screen.findByRole("option", { name: /MFG/ });
      expect(mfg.querySelector("[title='Manufacturing']")).not.toBeNull();
      // a folder without an abbreviation keeps its name
      expect(screen.getByRole("option", { name: /Quality/ })).toBeTruthy();
    } finally {
      brandingState.names = "FULL";
    }
  });

  it("names the folders of the sidebar on their own: abbreviated in the sidebar while the layout keeps the full name", async () => {
    brandingState.names = "FULL";
    brandingState.sidebar = "ABBREVIATION";
    try {
      renderPage();
      expect(await screen.findByRole("option", { name: /Manufacturing/ })).toBeTruthy();
      const sidebar = await screen.findByRole("navigation", { name: "Knowledge Base navigation" });
      await waitFor(() => expect(within(sidebar).getByText("MFG")).toBeTruthy());
      expect(within(sidebar).queryByText("Manufacturing")).toBeNull();
    } finally {
      brandingState.sidebar = undefined;
    }
  });

  it("names the folders by their full name by default", async () => {
    renderPage();
    expect(await screen.findByRole("option", { name: /Manufacturing/ })).toBeTruthy();
    expect(screen.queryByRole("option", { name: /MFG/ })).toBeNull();
  });

  it("asks once for the icons the Document Types were designed with", async () => {
    renderPage();
    await openLab();
    expect(knowledgeApiMock.documentTypeIcons).toHaveBeenCalledTimes(1);
  });

  it("pages twenty at a time from the server and starts again from page one after a sort", async () => {
    renderPage();
    await openLab();
    const lastCall = () => knowledgeApiMock.browse.mock.calls.filter((call) => call[2]?.length === 1).at(-1);
    expect(lastCall()?.[3]).toMatchObject({ page: 1, limit: 20 });

    fireEvent.click(screen.getByRole("button", { name: /Next/i }));
    await waitFor(() => expect(lastCall()?.[3]).toMatchObject({ page: 2, limit: 20 }));

    fireEvent.click(within(screen.getByRole("columnheader", { name: /^Name/i })).getByRole("button"));
    await waitFor(() => expect(lastCall()?.[3]).toMatchObject({ sortBy: "name", page: 1 }));
  });
});
