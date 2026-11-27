import { StrictMode } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const auth = vi.hoisted(() => ({ user: { id: "user-a" } }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => auth }));
import { useViewState, useViewFilterChange } from "../useViewState";

function List() {
  const [page, setPage] = useViewState("test.page", 1);
  const [search, setSearch] = useViewState("test.search", "");
  useViewFilterChange(() => setPage(1), [search]);
  return <><output>{page}</output><input aria-label="Search" value={search} onChange={(e) => setSearch(e.target.value)} /><button onClick={() => setPage((p) => p + 1)}>Next</button></>;
}
const mount = (path = "/list") => render(<StrictMode><MemoryRouter initialEntries={[path]}><List /></MemoryRouter></StrictMode>);
beforeEach(() => { sessionStorage.clear(); auth.user = { id: "user-a" }; });
afterEach(cleanup);

describe("saved view state", () => {
  it("restores search and page after unmount without a mount-time page reset", async () => {
    const first = mount();
    fireEvent.change(screen.getByLabelText("Search"), { target: { value: "Tran" } });
    fireEvent.click(screen.getByText("Next"));
    fireEvent.click(screen.getByText("Next"));
    first.unmount();
    mount();
    expect((screen.getByLabelText("Search") as HTMLInputElement).value).toBe("Tran");
    expect(screen.getByText("3")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Search"), { target: { value: "Le" } });
    await waitFor(() => expect(screen.getByText("1")).toBeTruthy());
  });

  it("isolates people and record routes", () => {
    const first = mount("/detail/one");
    fireEvent.click(screen.getByText("Next"));
    first.unmount();
    const second = mount("/detail/two");
    expect(screen.getByText("1")).toBeTruthy();
    second.unmount();
    auth.user = { id: "user-b" };
    mount("/detail/one");
    expect(screen.getByText("1")).toBeTruthy();
  });

  it("switches saved state when the authenticated user changes without unmounting the component", () => {
    const view = mount();
    fireEvent.click(screen.getByText("Next"));
    auth.user = { id: "user-b" };
    view.rerender(<StrictMode><MemoryRouter initialEntries={["/list"]}><List /></MemoryRouter></StrictMode>);
    expect(screen.getByText("1")).toBeTruthy();
    fireEvent.click(screen.getByText("Next"));
    auth.user = { id: "user-a" };
    view.rerender(<StrictMode><MemoryRouter initialEntries={["/list"]}><List /></MemoryRouter></StrictMode>);
    expect(screen.getByText("2")).toBeTruthy();
  });
});
