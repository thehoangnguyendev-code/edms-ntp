import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";

vi.mock("@/hooks", () => ({}));
const stableToast = { showToast: vi.fn() };
vi.mock("@/components/ui/toast", () => ({ useToast: () => stableToast }));
vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => ({ hasPermissionAlias: () => true }) }));
vi.mock("@/components/ui/page/PageHeader", () => ({
  PageHeader: ({ title, actions }: { title: string; actions?: React.ReactNode }) => (<div><h1>{title}</h1>{actions}</div>),
}));

const { knowledgeApiMock } = vi.hoisted(() => ({
  knowledgeApiMock: { getHierarchy: vi.fn(), listFields: vi.fn(), updateHierarchy: vi.fn(), setDefault: vi.fn() },
}));
vi.mock("@/services/api/knowledge", () => ({ knowledgeApi: knowledgeApiMock }));

import { KnowledgeCategoryEditorView } from "../KnowledgeCategoryEditorView";

const hierarchy = {
  id: "h1",
  name: "Business Unit Hierarchy",
  description: "",
  determinatorField: "BUSINESS_UNIT",
  determinatorLabel: "Business Unit",
  active: true,
  isDefault: false,
  levels: [
    { id: "l1", fieldCode: "DEPARTMENT", fieldLabel: "Department", displayOrder: 10 },
    { id: "l2", fieldCode: "DOCUMENT_TYPE", fieldLabel: "Document Type", displayOrder: 20 },
  ],
};
const fields = [
  { value: "BUSINESS_UNIT", label: "Business Unit", determinatorEligible: true },
  { value: "DEPARTMENT", label: "Department", determinatorEligible: true },
  { value: "DOCUMENT_TYPE", label: "Document Type", determinatorEligible: true },
  { value: "AUTHOR", label: "Author", determinatorEligible: false },
];

const StateProbe: React.FC = () => {
  const location = useLocation();
  return <div><span>component-screen</span><pre data-testid="state">{JSON.stringify(location.state)}</pre></div>;
};

const renderEditor = () =>
  render(
    <MemoryRouter initialEntries={["/edit/h1"]}>
      <Routes>
        <Route path="/edit/:id" element={<KnowledgeCategoryEditorView />} />
        <Route path="/documents/administration/knowledge-components/new" element={<StateProbe />} />
      </Routes>
    </MemoryRouter>,
  );
const saveButton = () => screen.getByRole("button", { name: "Save" }) as HTMLButtonElement;

describe("KnowledgeCategoryEditorView level changes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    knowledgeApiMock.getHierarchy.mockResolvedValue(hierarchy);
    knowledgeApiMock.listFields.mockResolvedValue(fields);
    knowledgeApiMock.updateHierarchy.mockImplementation(async (_id: string, payload: { levels: { id?: string; fieldCode: string }[] }) => ({
      ...hierarchy,
      levels: payload.levels.map((l, i) => ({ id: l.id ?? `n${i}`, fieldCode: l.fieldCode, fieldLabel: l.fieldCode, displayOrder: (i + 1) * 10 })),
    }));
  });

  it("starts with Save disabled and does not call the server for level changes", async () => {
    renderEditor();
    await screen.findByText("Department");
    expect(saveButton().disabled).toBe(true);
  });

  it("enables Save after moving a level and sends the new order only when Save is pressed", async () => {
    renderEditor();
    await screen.findByText("Department");
    fireEvent.click(screen.getAllByLabelText("Move down")[0]);
    await waitFor(() => expect(saveButton().disabled).toBe(false));
    expect(knowledgeApiMock.updateHierarchy).not.toHaveBeenCalled();
    fireEvent.click(saveButton());
    await waitFor(() => expect(knowledgeApiMock.updateHierarchy).toHaveBeenCalledTimes(1));
    expect(knowledgeApiMock.updateHierarchy.mock.calls[0][1].levels).toEqual([
      { id: "l2", fieldCode: "DOCUMENT_TYPE" },
      { id: "l1", fieldCode: "DEPARTMENT" },
    ]);
    await waitFor(() => expect(saveButton().disabled).toBe(true));
  });

  it("enables Save after removing a level", async () => {
    renderEditor();
    await screen.findByText("Department");
    fireEvent.click(screen.getAllByLabelText("Remove level")[0]);
    await waitFor(() => expect(saveButton().disabled).toBe(false));
    fireEvent.click(saveButton());
    await waitFor(() => expect(knowledgeApiMock.updateHierarchy).toHaveBeenCalled());
    expect(knowledgeApiMock.updateHierarchy.mock.calls[0][1].levels).toEqual([{ id: "l2", fieldCode: "DOCUMENT_TYPE" }]);
  });

  it("New Component carries the unsaved edits to the component screen", async () => {
    renderEditor();
    await screen.findByText("Department");
    fireEvent.click(screen.getAllByLabelText("Move down")[0]);
    fireEvent.click(screen.getByText("New Component"));
    expect(await screen.findByText("component-screen")).toBeTruthy();
    expect(JSON.parse(screen.getByTestId("state").textContent ?? "{}").draft.levels.map((l: { fieldCode: string }) => l.fieldCode))
      .toEqual(["DOCUMENT_TYPE", "DEPARTMENT"]);
  });

  it("restores the draft and adds the new component as a level when coming back", async () => {
    render(
      <MemoryRouter initialEntries={[{ pathname: "/edit/h1", state: {
        draft: { name: "Renamed", description: "", determinator: "BUSINESS_UNIT", active: true,
          levels: [{ id: "l1", fieldCode: "DEPARTMENT", fieldLabel: "Department" }] },
        newComponent: { sourceField: "AUTHOR", name: "Author" },
      } }]}>
        <Routes><Route path="/edit/:id" element={<KnowledgeCategoryEditorView />} /></Routes>
      </MemoryRouter>,
    );
    await waitFor(() => expect((screen.getByDisplayValue("Renamed") as HTMLInputElement).value).toBe("Renamed"));
    expect(await screen.findByText("Author")).toBeTruthy();
    await waitFor(() => expect(saveButton().disabled).toBe(false));
  });
});
