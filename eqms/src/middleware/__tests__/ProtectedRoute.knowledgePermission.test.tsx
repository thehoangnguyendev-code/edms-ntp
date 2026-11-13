import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { ProtectedRoute } from "../ProtectedRoute";

const authState = vi.hoisted(() => ({ permissions: [] as string[] }));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    isAuthenticated: true,
    loading: false,
    user: { id: "u1", permissions: authState.permissions, mfaSetupRequired: false, maintenanceMode: false },
  }),
}));

import appRoutesSource from "../../app/AppRoutes.tsx?raw";

// The guard of the Knowledge Base Explorer route in AppRoutes: its own permission only.
const KNOWLEDGE_ROUTE_PERMISSIONS = ["self_service.knowledge.view"];

const renderGuard = (permissions: string[]) => {
  authState.permissions = permissions;
  render(
    <MemoryRouter>
      <ProtectedRoute requiredPermissions={KNOWLEDGE_ROUTE_PERMISSIONS}>
        <div>Explorer</div>
      </ProtectedRoute>
    </MemoryRouter>,
  );
};

describe("Knowledge Base route permission", () => {
  it("AppRoutes guards the Explorer route with the Knowledge permission alone", () => {
    const start = appRoutesSource.indexOf("path={ROUTES.DOCUMENTS.KNOWLEDGE_EXPLORER}");
    expect(start).toBeGreaterThan(-1);
    const block = appRoutesSource.slice(start, appRoutesSource.indexOf("<KnowledgeExplorerPage />", start));
    expect(block).toContain('requiredPermissions={["self_service.knowledge.view"]}');
    expect(block).not.toContain("documents.module.view");
  });

  it("opens for a reader who has the Knowledge permission and no Document Control permission", () => {
    renderGuard(["self_service.knowledge.view"]);
    expect(screen.getByText("Explorer")).toBeInTheDocument();
  });

  it("stays closed for a Document Control user without the Knowledge permission", () => {
    renderGuard(["documents.module.view", "documents.document.view"]);
    expect(screen.queryByText("Explorer")).not.toBeInTheDocument();
    expect(screen.getByText("Access Denied")).toBeInTheDocument();
  });
});
