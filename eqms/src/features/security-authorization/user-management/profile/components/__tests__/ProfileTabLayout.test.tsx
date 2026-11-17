import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ProfileTabLayout, profileTabItems } from "../ProfileTabLayout";
import { UserProfileSummary } from "../UserProfileSummary";
import type { User } from "../../../types";

const setWide = (wide: boolean) => {
  window.matchMedia = ((query: string) => ({
    matches: wide, media: query, onchange: null, addEventListener: () => undefined, removeEventListener: () => undefined,
    addListener: () => undefined, removeListener: () => undefined, dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
};

beforeEach(() => setWide(true));
afterEach(cleanup);

const user = {
  id: "u1", fullName: "Nguyễn Thị Phương Thảo", employeeCode: "NTP.0042", email: "thao.nguyen@ntp-pharma.example",
  position: "QA Specialist", department: "Quality Assurance", managerName: "Trần Văn Minh", lastLogin: "Never",
  status: "Active", employmentType: "Full-time", accountLocked: true, accessProfileNames: ["QA Manager", "Document Controller"],
} as unknown as User;

describe("ProfileTabLayout", () => {
  it("lists the five areas, shows the active one inside a titled card and switches on press", () => {
    const onTabChange = vi.fn();
    render(
      <ProfileTabLayout summary={<div>summary</div>} tabs={profileTabItems()} activeTab="employment" onTabChange={onTabChange}>
        <p>employment fields</p>
      </ProfileTabLayout>,
    );

    expect(screen.getAllByRole("tab")).toHaveLength(5);
    expect(screen.getByRole("tab", { name: /Employment Record/ })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("heading", { name: "Employment Record" })).toBeTruthy();
    expect(screen.queryByText("Where they work, who they report to, and since when.")).toBeNull();
    expect(screen.getByText("employment fields")).toBeTruthy();

    fireEvent.click(screen.getByRole("tab", { name: /Security & Compliance/ }));
    expect(onTabChange).toHaveBeenCalledWith("security");
  });

  it("does not wrap Training & Competency in a card, since its lists are cards already", () => {
    render(
      <ProfileTabLayout summary={null} tabs={profileTabItems()} activeTab="qualifications" onTabChange={vi.fn()}>
        <p>education list</p>
      </ProfileTabLayout>,
    );

    expect(screen.getByText("education list")).toBeTruthy();
    expect(screen.queryByText("Education, expertise and certificates.")).toBeNull();
  });

  it("shows a description and a count under a tab when asked, and keeps one tab list on a narrow screen", () => {
    setWide(false);
    render(
      <ProfileTabLayout
        summary={null}
        tabs={profileTabItems((id) => ({ description: id === "employment" ? "5 required left" : "Complete", count: id === "employment" ? 5 : undefined }))}
        activeTab="personal"
        onTabChange={vi.fn()}
        compactNav={false}
      >
        <p>x</p>
      </ProfileTabLayout>,
    );

    expect(screen.getAllByRole("tab")).toHaveLength(5);
    expect(screen.getByText("5")).toBeTruthy();
  });

  it("puts the panel badge in the header of the card", () => {
    render(
      <ProfileTabLayout summary={null} tabs={profileTabItems()} activeTab="personal" onTabChange={vi.fn()} panelBadge={<span>Editing</span>}>
        <p>x</p>
      </ProfileTabLayout>,
    );
    expect(screen.getByText("Editing")).toBeTruthy();
  });
});

describe("UserProfileSummary", () => {
  it("shows who the person is, their state and the facts an admin looks for first", () => {
    render(<UserProfileSummary user={user} avatar={<span>avatar</span>} />);

    expect(screen.getByRole("heading", { name: "Nguyễn Thị Phương Thảo" })).toBeTruthy();
    expect(screen.getByText("QA Specialist")).toBeTruthy();
    expect(screen.getByText("Active")).toBeTruthy();
    expect(screen.getByText("Locked")).toBeTruthy();
    expect(screen.getByText("NTP.0042")).toBeTruthy();
    expect(screen.getByText("thao.nguyen@ntp-pharma.example")).toBeTruthy();
    expect(screen.getByText("Trần Văn Minh")).toBeTruthy();
    expect(screen.getByText("Never logged in")).toBeTruthy();
    expect(screen.getByText("2 assigned")).toBeTruthy();
  });

  it("says so when nothing is assigned or known, instead of showing a blank", () => {
    render(<UserProfileSummary user={{ ...user, accessProfileNames: [], managerName: undefined, accountLocked: false } as unknown as User} avatar={null} />);

    expect(screen.getByText("None assigned")).toBeTruthy();
    expect(screen.queryByText("Locked")).toBeNull();
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
  });
});
