import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  profile: {} as Record<string, unknown>,
  getUserCapabilities: vi.fn(),
  startEdit: vi.fn(),
}));

vi.mock("../../hooks/useUserProfile", () => ({ useUserProfile: () => mocks.profile }));
vi.mock("@/services/api/settings", () => ({ settingsApi: { getUserCapabilities: mocks.getUserCapabilities } }));
vi.mock("@/features/notifications/notificationRealtime", () => ({ subscribeNotificationRealtime: () => () => undefined }));
vi.mock("@/components/ui/toast", () => ({ useToast: () => ({ showToast: vi.fn() }) }));
vi.mock("@/components/ui/page/PageHeader", () => ({
  PageHeader: ({ title, actions }: { title: string; actions?: React.ReactNode }) => <div><h1>{title}</h1>{actions}</div>,
}));
vi.mock("@/features/settings/user-profile/AvatarCropModal", () => ({ AvatarCropModal: () => null }));
vi.mock("../../components/ResetPasswordModal", () => ({ ResetPasswordModal: ({ isOpen }: { isOpen: boolean }) => (isOpen ? <div>reset password modal</div> : null) }));
vi.mock("../../components/UnlockAccountModal", () => ({ UnlockAccountModal: () => null }));
vi.mock("../../components/SuspendModal", () => ({ SuspendModal: ({ isOpen }: { isOpen: boolean }) => (isOpen ? <div>suspend modal</div> : null) }));
vi.mock("../../components/TerminateModal", () => ({ TerminateModal: () => null }));
vi.mock("../../tabs/PersonalTab", () => ({ PersonalTab: () => <div>personal fields</div> }));
vi.mock("../../tabs/EmploymentTab", () => ({ EmploymentTab: () => <div>employment fields</div> }));
vi.mock("../../tabs/QualificationsTab", () => ({ QualificationsTab: () => <div>qualification lists</div> }));
vi.mock("../../tabs/AccountStatusTab", () => ({ AccountStatusTab: () => <div>account fields</div> }));
vi.mock("../../tabs/SecurityAuthorizationTab", () => ({ SecurityAuthorizationTab: () => <div>security fields</div> }));

import { UserProfileView } from "../UserProfileView";

const baseUser = {
  id: "u1", fullName: "Nguyễn Thị Phương Thảo", employeeCode: "NTP.0042", email: "thao@example.com", position: "QA Specialist",
  department: "Quality Assurance", managerName: "Trần Văn Minh", lastLogin: "Never", status: "Active", employmentType: "Full-time",
  accountLocked: false, accessProfileNames: ["QA Manager"],
};

const setProfile = (over: Record<string, unknown> = {}) => {
  mocks.profile = {
    user: baseUser, draft: {}, isEditingProfile: false, isDraftDirty: false, certifications: [], draftDepartments: [], managerOptions: [],
    yearsOfService: "1 year", startEdit: mocks.startEdit, saveAll: vi.fn(), cancelEdit: vi.fn(), resetEdit: vi.fn(), updateField: vi.fn(),
    updateMfaRequiredByAdmin: vi.fn(), saveCert: vi.fn(), deleteCert: vi.fn(), suspendUser: vi.fn(), terminateUser: vi.fn(), reinstateUser: vi.fn(),
    setUser: vi.fn(), educationList: [], saveEdu: vi.fn(), deleteEdu: vi.fn(), lookupPositions: [], businessUnitOptions: [], languageOptions: [],
    avatarPreview: "", isAvatarSaving: false, handleAvatarChange: vi.fn(), fieldErrors: {}, isLoading: false, ...over,
  };
};

const renderView = () => render(
  <MemoryRouter initialEntries={["/users/u1"]}>
    <Routes><Route path="/users/:userId" element={<UserProfileView />} /></Routes>
  </MemoryRouter>,
);

beforeEach(() => {
  window.matchMedia = ((query: string) => ({
    matches: true, media: query, onchange: null, addEventListener: () => undefined, removeEventListener: () => undefined,
    addListener: () => undefined, removeListener: () => undefined, dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
  setProfile();
  mocks.getUserCapabilities.mockResolvedValue({
    userId: "u1",
    actions: { edit: { allowed: true }, resetPassword: { allowed: true }, suspend: { allowed: true }, terminate: { allowed: true } },
  });
});
afterEach(() => { cleanup(); mocks.getUserCapabilities.mockReset(); mocks.startEdit.mockReset(); });

describe("UserProfileView layout", () => {
  it("shows who the person is beside five tabs and opens on Personal & Identity", async () => {
    renderView();

    expect(screen.getByRole("heading", { name: "Nguyễn Thị Phương Thảo" })).toBeTruthy();
    expect(screen.getByText("NTP.0042")).toBeTruthy();
    expect(screen.getAllByRole("tab")).toHaveLength(5);
    expect(screen.getByText("personal fields")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Personal & Identity" })).toBeTruthy();
  });

  it("switches the content when another tab is pressed, and the summary stays", async () => {
    renderView();

    fireEvent.click(screen.getByRole("tab", { name: /Employment Record/ }));
    expect(screen.getByText("employment fields")).toBeTruthy();
    expect(screen.queryByText("personal fields")).toBeNull();
    fireEvent.click(screen.getByRole("tab", { name: /Training & Competency/ }));
    expect(screen.getByText("qualification lists")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Nguyễn Thị Phương Thảo" })).toBeTruthy();
  });

  it("keeps the account actions in the Account Status tab only, not as a menu in the header", async () => {
    renderView();
    await waitFor(() => expect(mocks.getUserCapabilities).toHaveBeenCalled());

    expect(await screen.findByRole("button", { name: "Edit Profile" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "More actions" })).toBeNull();
  });

  it("gives Edit as the main button and starts editing; while editing it shows Save and an Editing badge", async () => {
    const { unmount } = renderView();
    fireEvent.click(await screen.findByRole("button", { name: "Edit Profile" }));
    expect(mocks.startEdit).toHaveBeenCalledTimes(1);
    unmount();

    setProfile({ isEditingProfile: true, isDraftDirty: true });
    renderView();
    expect(await screen.findByRole("button", { name: "Save" })).toBeTruthy();
    expect(screen.getByText("Editing")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Edit Profile" })).toBeNull();
  });

  it("keeps the locked-account banner above the layout, with its own Unlock button", async () => {
    setProfile({ user: { ...baseUser, accountLocked: true } });
    mocks.getUserCapabilities.mockResolvedValue({ userId: "u1", actions: { edit: { allowed: true }, unlock: { allowed: true } } });
    renderView();

    expect(await screen.findByText("Account Locked")).toBeTruthy();
    expect(await screen.findByRole("button", { name: /Unlock Account/ })).toBeTruthy();
    expect(screen.getByText("Locked")).toBeTruthy();
  });
});
