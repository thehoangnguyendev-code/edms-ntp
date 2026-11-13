import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ReviewerSelect } from "../ReviewerSelect";

afterEach(cleanup);

describe("the reviewer of a review campaign", () => {
  it("offers the creator first and then the people the server says may review", async () => {
    const load = vi.fn().mockResolvedValue([{ id: "u1", name: "Nguyen Van A" }, { id: "u2", name: "Tran Thi B" }]);
    const onChange = vi.fn();
    render(<ReviewerSelect load={load} value="" onChange={onChange} />);
    await waitFor(() => expect(load).toHaveBeenCalledTimes(1));
    expect(screen.getByText("Reviewer")).toBeTruthy();
    expect(screen.getByText("Me (the person creating the campaign)")).toBeTruthy();
    fireEvent.click(screen.getByRole("combobox", { name: "Reviewer" }));
    fireEvent.click(await screen.findByText("Tran Thi B"));
    expect(onChange).toHaveBeenCalledWith("u2");
  });

  it("leaves the creator as the reviewer when the list cannot be read", async () => {
    const load = vi.fn().mockRejectedValue(new Error("network"));
    render(<ReviewerSelect load={load} value="" onChange={vi.fn()} />);
    await waitFor(() => expect(load).toHaveBeenCalled());
    expect(screen.getByText("Me (the person creating the campaign)")).toBeTruthy();
  });
});
