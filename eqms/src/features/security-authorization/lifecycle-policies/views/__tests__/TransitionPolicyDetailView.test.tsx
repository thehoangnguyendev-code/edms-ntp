import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getPolicy: vi.fn(), activatePolicy: vi.fn(), deactivatePolicy: vi.fn(), resetToDefault: vi.fn(), toast: vi.fn(), canManage: { value: true }, sign: vi.fn() }));
vi.mock("@/services/api/workflowActionPolicy", () => ({
  workflowActionPolicyApi: { getPolicy: mocks.getPolicy, activatePolicy: mocks.activatePolicy, deactivatePolicy: mocks.deactivatePolicy, resetToDefault: mocks.resetToDefault },
}));
vi.mock("@/components/ui/toast/Toast", () => ({ useToast: () => ({ showToast: mocks.toast }) }));
vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => ({ hasPermissionAlias: () => mocks.canManage.value }) }));
vi.mock("@/features/security-authorization/shared/useSecurityESign", () => ({ useSecurityESign: () => ({ requestSignature: mocks.sign, signatureModal: null }) }));
import { BreadcrumbProvider } from "@/contexts/BreadcrumbContext";
import { TransitionPolicyDetailView } from "../TransitionPolicyDetailView";

const policy = (over: Record<string, unknown> = {}) => ({
  id: "p1", moduleKey: "TRAINING", moduleLabel: "Training Management", workflowKey: "TRAINING_ACTIVITY", workflowLabel: "Training Activity", objectType: "TRAINING_ACTIVITY",
  actionCode: "ADD_SESSION", actionLabel: "Add Session", fromStatus: "PLANNED", fromStatusLabel: "Planned", documentTypeId: null, documentTypeName: null,
  requiredPermissionCode: "training.activity.organize", requiredPermissionName: "Organize Training Activities", priority: 100, active: true, system: true, resettable: true, deactivatable: true,
  description: "A conductor adds a session.", actors: [{ actorType: "PERMISSION", actorTypeLabel: "Has permission", actorCode: "training.activity.organize" }],
  createdAt: "2026-11-18T11:54:21Z", updatedAt: "2026-11-18T11:54:21Z", relationMatchRule: "ANY",
  relations: [{ id: "r1", relationDefinitionId: "d1", relationCode: "PREPARER", relationDisplayName: "Preparer", resolverCode: "WORKFLOW_PARTICIPANT", priority: 100, forbidden: true }], warnings: [], ...over,
});

const renderAt = () =>
  render(
    <MemoryRouter initialEntries={["/security/lifecycle-policies/p1"]}>
      <BreadcrumbProvider>
        <Routes>
          <Route path="/security/lifecycle-policies/:id" element={<TransitionPolicyDetailView />} />
          <Route path="/security/lifecycle-policies/:id/edit" element={<div>EDIT SCREEN</div>} />
        </Routes>
      </BreadcrumbProvider>
    </MemoryRouter>,
  );

afterEach(() => { cleanup(); mocks.canManage.value = true; Object.values(mocks).forEach((m) => typeof m === "function" && (m as ReturnType<typeof vi.fn>).mockReset()); });

it("is a read-only page titled Transition Policy Details with the whole policy on it", async () => {
  mocks.getPolicy.mockResolvedValue(policy());
  renderAt();
  expect(await screen.findAllByText("Transition Policy Details")).not.toHaveLength(0);
  expect(screen.getByText("Training Management")).toBeTruthy();
  expect(screen.getByText("Add Session")).toBeTruthy();
  expect(screen.getByText("Organize Training Activities")).toBeTruthy();
  expect(screen.getByText(/Has permission/)).toBeTruthy();
  expect(screen.getByText("Preparer")).toBeTruthy(); // the person who must be different
  expect(screen.queryByRole("textbox")).toBeNull();
});

it("a person who may manage gets Edit, Override, Duplicate, Deactivate and Reset as buttons; Edit opens its own page", async () => {
  mocks.getPolicy.mockResolvedValue(policy());
  renderAt();
  await screen.findByText("Edit Policy");
  for (const name of ["Create Override", "Duplicate", "Deactivate", "Reset Default"]) expect(screen.getByText(name)).toBeTruthy();
  fireEvent.click(screen.getByText("Edit Policy"));
  expect(await screen.findByText("EDIT SCREEN")).toBeTruthy();
});

it("a person who may only view sees the details and no function", async () => {
  mocks.canManage.value = false;
  mocks.getPolicy.mockResolvedValue(policy());
  renderAt();
  await screen.findByText("Add Session");
  for (const name of ["Edit Policy", "Create Override", "Duplicate", "Deactivate", "Reset Default"]) expect(screen.queryByText(name)).toBeNull();
  expect(screen.getByText("Back")).toBeTruthy();
});

it("an inactive policy offers Activate and says it is not used", async () => {
  mocks.getPolicy.mockResolvedValue(policy({ active: false }));
  renderAt();
  await screen.findByText("Activate");
  expect(screen.queryByText("Deactivate")).toBeNull();
  expect(screen.getByText(/not used until it is activated/)).toBeTruthy();
});

it("deactivating asks to confirm, then for the signature, then calls the server", async () => {
  mocks.getPolicy.mockResolvedValue(policy());
  mocks.sign.mockResolvedValue({ signatureToken: "tok", reason: "r" });
  mocks.deactivatePolicy.mockResolvedValue({});
  renderAt();
  fireEvent.click(await screen.findByText("Deactivate"));
  fireEvent.click(await screen.findByRole("button", { name: "Deactivate" , hidden: false }).catch(() => screen.getAllByText("Deactivate").at(-1)!));
  await waitFor(() => expect(mocks.deactivatePolicy).toHaveBeenCalledWith("p1", { signatureToken: "tok", reason: "r" }));
});

it("a policy that cannot be found says so instead of an empty page", async () => {
  mocks.getPolicy.mockRejectedValue(new Error("404"));
  renderAt();
  expect(await screen.findByText("Policy not found")).toBeTruthy();
});
