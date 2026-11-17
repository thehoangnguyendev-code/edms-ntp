import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ showToast: vi.fn(), createUser: vi.fn() }));

vi.mock("@/services/api/settings", () => ({
  settingsApi: {
    getUserFilters: vi.fn().mockResolvedValue({ roles: [], genders: [], employmentTypes: [], statuses: [], businessUnits: [], departments: [], positions: [] }),
    listAllAccessProfiles: vi.fn().mockResolvedValue([]),
    getUserManagerOptions: vi.fn().mockResolvedValue([]),
    getNextEmployeeCode: vi.fn().mockResolvedValue("NTP.0043"),
    suggestUsername: vi.fn().mockResolvedValue(""),
    getUsers: vi.fn().mockResolvedValue({ data: [] }),
    createUser: mocks.createUser,
  },
}));
vi.mock("@/services/api", () => ({
  dictionaryApi: {
    getBusinessUnits: vi.fn().mockResolvedValue([]),
    getDepartments: vi.fn().mockResolvedValue([]),
    getPositions: vi.fn().mockResolvedValue([]),
    getLanguages: vi.fn().mockResolvedValue([]),
  },
}));
vi.mock("@/components/ui/toast", () => ({ useToast: () => ({ showToast: mocks.showToast }) }));
vi.mock("@/components/ui/page/PageHeader", () => ({
  PageHeader: ({ title, actions }: { title: string; actions?: React.ReactNode }) => <div><h1>{title}</h1>{actions}</div>,
}));
vi.mock("@/features/security-authorization/shared/useSodAccessProfileCheck", () => ({ useSodAccessProfileCheck: () => ({ checking: false, hasBlockingViolation: false }) }));
vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => ({ hasPermission: () => true }) }));
vi.mock("../../components/CredentialsModal", () => ({ CredentialsModal: () => null }));
vi.mock("../../tabs/PersonalTab", () => ({
  PersonalTab: ({ onDraftChange }: { onDraftChange: (key: string, value: string) => void }) => (
    <div>
      personal fields
      <button type="button" onClick={() => { onDraftChange("fullName", "Lê Thư"); onDraftChange("username", "thu.le"); onDraftChange("email", "thu@example.com"); }}>fill personal</button>
    </div>
  ),
}));
vi.mock("../../tabs/EmploymentTab", () => ({ EmploymentTab: () => <div>employment fields</div> }));
vi.mock("../../tabs/QualificationsTab", () => ({ QualificationsTab: () => <div>qualification lists</div> }));
vi.mock("../../tabs/AccountStatusTab", () => ({ AccountStatusTab: () => <div>account fields</div> }));
vi.mock("../../tabs/SecurityAuthorizationTab", () => ({ SecurityAuthorizationTab: () => <div>security fields</div> }));

import { AddUserView } from "../AddUserView";

beforeEach(() => {
  window.matchMedia = ((query: string) => ({
    matches: true, media: query, onchange: null, addEventListener: () => undefined, removeEventListener: () => undefined,
    addListener: () => undefined, removeListener: () => undefined, dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
});
afterEach(() => { cleanup(); mocks.showToast.mockReset(); mocks.createUser.mockReset(); });

const renderView = () => render(<MemoryRouter><AddUserView /></MemoryRouter>);
// "1" is bold inside the line, so the sentence is spread over two text nodes
const done = (n: number) => (_content: string, el: Element | null) => el?.tagName === "SPAN" && el.textContent === `${n} of 11 done`;

describe("AddUserView layout", () => {
  it("shows how many required fields are done and, per tab, how many are left", async () => {
    renderView();

    // the Employee ID is suggested by the server as soon as the screen opens
    expect(await screen.findByText(done(1))).toBeTruthy();
    expect(screen.getByRole("tab", { name: /Personal & Identity/ })).toBeTruthy();
    expect(screen.getByText("3 required left")).toBeTruthy();
    expect(screen.getByText("5 required left")).toBeTruthy();
    expect(screen.getAllByText("1 required left")).toHaveLength(2);
    expect(screen.getByText("Optional")).toBeTruthy();
    expect(screen.getByRole("progressbar")).toBeTruthy();
  });

  it("counts a field as done as soon as it is filled", async () => {
    renderView();
    await screen.findByText(done(1));

    fireEvent.click(screen.getByRole("button", { name: "fill personal" }));

    expect(await screen.findByText(done(4))).toBeTruthy();
    expect(screen.getByText("Complete")).toBeTruthy();
  });

  it("takes the admin to the first tab with an error when Create User is pressed with fields missing", async () => {
    renderView();
    await screen.findByText(done(1));
    fireEvent.click(screen.getByRole("button", { name: "fill personal" }));
    await screen.findByText(done(4));
    expect(screen.getByText("personal fields")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Create User/ }));

    await waitFor(() => expect(screen.getByText("employment fields")).toBeTruthy());
    expect(screen.getByRole("tab", { name: /Employment Record/ })).toHaveAttribute("aria-selected", "true");
    expect(mocks.showToast).toHaveBeenCalledWith(expect.objectContaining({ type: "error" }));
    expect(mocks.createUser).not.toHaveBeenCalled();
  });

  it("stays on the tab it is on when that tab itself has the error", async () => {
    renderView();
    await screen.findByText(done(1));

    fireEvent.click(screen.getByRole("button", { name: /Create User/ }));

    await waitFor(() => expect(mocks.showToast).toHaveBeenCalled());
    expect(screen.getByText("personal fields")).toBeTruthy();
    expect(screen.getByRole("tab", { name: /Personal & Identity/ })).toHaveAttribute("aria-selected", "true");
  });
});
