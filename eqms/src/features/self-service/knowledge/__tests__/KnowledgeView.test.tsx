import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

vi.mock("@/hooks", () => ({ useDebounce: (value: unknown) => value }));
const stableToast = { showToast: vi.fn() };
vi.mock("@/components/ui/toast", () => ({ useToast: () => stableToast }));
vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => ({ hasPermissionAlias: () => true }) }));
vi.mock("@/components/ui/page/PageHeader", () => ({ PageHeader: ({ title }: { title: string }) => <h1>{title}</h1> }));
vi.mock("../FolderDocumentsList", () => ({ FolderDocumentsList: () => <div>documents-list</div> }));

const { knowledgeApiMock } = vi.hoisted(() => ({
  knowledgeApiMock: {
    overview: vi.fn(),
    browse: vi.fn(),
    search: vi.fn(async () => []),
    recordView: vi.fn(async () => undefined),
    giveFeedback: vi.fn(async () => undefined),
    setFeatured: vi.fn(async () => undefined),
    setSubscribed: vi.fn(async () => undefined),
  },
}));
vi.mock("@/services/api/knowledge", () => ({ knowledgeApi: knowledgeApiMock }));

import { KnowledgeView } from "../KnowledgeView";

const doc = (id: string, name: string) => ({
  document: { id, documentNumber: `NO.${id}`, documentName: name, department: "Lab" },
  views: 7,
  helpfulVotes: 3,
  featured: id === "1",
  myFeedback: null,
});

const overview = {
  hierarchies: [{ id: "h1", name: "BU", isDefault: true }],
  selectedHierarchyId: "h1",
  selectedHierarchyName: "BU",
  determinatorField: "BUSINESS_UNIT",
  determinatorLabel: "Business Unit",
  levelLabels: ["Department"],
  totalDocuments: 4,
  totalKnowledgeBases: 1,
  knowledgeBases: [{ key: "kb1", label: "Quality Unit", documentCount: 4, subscribed: false }],
  featured: [doc("1", "Featured doc")],
  mostViewed: [doc("2", "Viewed doc")],
  mostUseful: [doc("3", "Useful doc")],
};

describe("KnowledgeView portal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    knowledgeApiMock.overview.mockResolvedValue(overview);
  });

  it("fills Featured, Most Useful and Most Viewed from the API rather than fixed text", async () => {
    render(<MemoryRouter><KnowledgeView /></MemoryRouter>);
    expect(await screen.findByText("Featured doc")).toBeTruthy();
    expect(screen.getByText("Viewed doc")).toBeTruthy();
    expect(screen.getByText("Useful doc")).toBeTruthy();
    expect(screen.getByText(/7 views/)).toBeTruthy();
    expect(screen.getByText(/3 found it helpful/)).toBeTruthy();
    expect(knowledgeApiMock.overview).toHaveBeenCalledTimes(1);
  });

  it("shows the empty text for a card the server returned nothing for", async () => {
    knowledgeApiMock.overview.mockResolvedValue({ ...overview, featured: [] });
    render(<MemoryRouter><KnowledgeView /></MemoryRouter>);
    await screen.findByText("Viewed doc");
    expect(screen.getAllByText("No content to display")).toHaveLength(1);
  });

  it("sends the vote to the server and reloads the cards", async () => {
    render(<MemoryRouter><KnowledgeView /></MemoryRouter>);
    await screen.findByText("Useful doc");
    fireEvent.click(screen.getAllByTitle("This was helpful")[0]);
    await waitFor(() => expect(knowledgeApiMock.giveFeedback).toHaveBeenCalledWith("1", true));
    await waitFor(() => expect(knowledgeApiMock.overview).toHaveBeenCalledTimes(2));
  });

  it("feature toggle and subscribe call the server", async () => {
    render(<MemoryRouter><KnowledgeView /></MemoryRouter>);
    await screen.findByText("Featured doc");
    fireEvent.click(screen.getByTitle("Remove from Featured"));
    await waitFor(() => expect(knowledgeApiMock.setFeatured).toHaveBeenCalledWith("1", false));
    fireEvent.click(screen.getByText("Subscribe"));
    await waitFor(() => expect(knowledgeApiMock.setSubscribed).toHaveBeenCalledWith("BUSINESS_UNIT", "kb1", true));
  });

  it("opens a Knowledge Base and asks the server for the next level", async () => {
    knowledgeApiMock.browse.mockResolvedValue({
      path: [{ fieldLabel: "Business Unit", key: "kb1", label: "Quality Unit" }],
      nextFieldLabel: "Department",
      folders: [{ key: "d1", label: "QA", documentCount: 2 }],
      documents: [],
    });
    render(<MemoryRouter><KnowledgeView /></MemoryRouter>);
    fireEvent.click(await screen.findByText("Quality Unit"));
    await waitFor(() => expect(knowledgeApiMock.browse).toHaveBeenCalledWith("h1", "kb1", []));
    expect(await screen.findByText("QA")).toBeTruthy();
  });
});
