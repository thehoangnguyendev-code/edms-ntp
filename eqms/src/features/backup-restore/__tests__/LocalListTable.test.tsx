import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { LocalListTable } from "../components/LocalListTable";

type Row = { id: string; who: string };
const rows: Row[] = Array.from({ length: 12 }, (_, i) => ({ id: `T-${String(i + 1).padStart(2, "0")}`, who: i % 2 ? "Nguyen The Hoang" : "Tran Van An" }));

const show = (data: Row[] = rows) =>
  render(
    <LocalListTable
      rows={data}
      getRowKey={(r) => r.id}
      searchText={(r) => `${r.id} ${r.who}`}
      searchLabel="Search tests"
      searchPlaceholder="Test or person…"
      emptyTitle="No tests"
      emptyDescription="None yet."
      columns={[
        { id: "id", header: "Test", cell: (r) => r.id, sortValue: (r) => r.id },
        { id: "who", header: "By", cell: (r) => r.who, sortValue: (r) => r.who },
      ]}
    />,
  );
afterEach(cleanup);

describe("LocalListTable", () => {
  it("numbers the rows, shows at most 10 and turns the page", () => {
    show();
    expect(screen.getByText("T-10")).toBeTruthy();
    expect(screen.queryByText("T-11")).toBeNull();
    expect(screen.getByRole("columnheader", { name: /No\./ })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Next/ }));
    expect(screen.getByText("T-11")).toBeTruthy();
  });

  it("searches across the row from the first page after typing settles", async () => {
    show();
    fireEvent.change(screen.getByRole("textbox", { name: "Search tests" }), { target: { value: "tran van" } });
    expect(screen.getByRole("textbox", { name: "Search tests" })).toHaveValue("tran van");
    expect(screen.getAllByText("Nguyen The Hoang").length).toBeGreaterThan(0);
    await waitFor(() => expect(screen.queryByText("Nguyen The Hoang")).toBeNull());
    expect(screen.getAllByText("Tran Van An").length).toBe(6);
    expect(screen.queryByText("Nguyen The Hoang")).toBeNull();
  });

  it("sorts by a header, then reverses", () => {
    show();
    const order = () => screen.getAllByText(/^T-\d\d$/).map((n) => n.textContent);
    fireEvent.click(screen.getByRole("columnheader", { name: /Test/ }));
    expect(order()[0]).toBe("T-01");
    fireEvent.click(screen.getByRole("columnheader", { name: /Test/ }));
    expect(order()[0]).toBe("T-12");
  });

  it("says so when there is nothing", () => {
    show([]);
    expect(screen.getByText("No tests")).toBeTruthy();
  });
});
