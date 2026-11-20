import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ searchNavigation: vi.fn() }));
vi.mock("@/services/api", () => ({ navigationApi: api }));
import { SearchDropdown } from "../SearchDropdown";

const Where = () => <p data-testid="where">{useLocation().pathname}</p>;
const renderSearch = (onCloseSidebar = vi.fn()) => render(<MemoryRouter><SearchDropdown onCloseSidebar={onCloseSidebar} /><Where /></MemoryRouter>);
const type = (value: string) => {
  const input = screen.getByPlaceholderText("Search features, pages...");
  fireEvent.focus(input);
  fireEvent.change(input, { target: { value } });
};

afterEach(() => { cleanup(); api.searchNavigation.mockReset(); });

describe("Global search: Enter", () => {
  it("opens the first result of the search, as a click on it would, and closes the sidebar", async () => {
    api.searchNavigation.mockResolvedValue([
      { id: "a", label: "Access Profiles", icon: null, path: "/security/access-profiles", fullPath: "Security > Access Profiles" },
      { id: "b", label: "Access Review", icon: null, path: "/security/access-review", fullPath: "Security > Access Review" },
    ]);
    const closeSidebar = vi.fn();
    renderSearch(closeSidebar);
    type("access");
    await screen.findByText("Access Review"); // the results are in
    fireEvent.keyDown(document, { key: "Enter" });
    await waitFor(() => expect(screen.getByTestId("where").textContent).toBe("/security/access-profiles"));
    expect(closeSidebar).toHaveBeenCalled();
  });

  it("does nothing when the search found nothing", async () => {
    api.searchNavigation.mockResolvedValue([]);
    renderSearch();
    type("zzzz");
    await waitFor(() => expect(api.searchNavigation).toHaveBeenCalledWith("zzzz"));
    fireEvent.keyDown(document, { key: "Enter" });
    expect(screen.getByTestId("where").textContent).toBe("/");
  });
});
