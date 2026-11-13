import React, { useState } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Collapsible } from "../Collapsible";

const Harness: React.FC<{ start?: boolean }> = ({ start = false }) => {
  const [open, setOpen] = useState(start);
  return (
    <>
      <button aria-expanded={open} onClick={() => setOpen((v) => !v)}>toggle</button>
      <Collapsible open={open}><p>details</p></Collapsible>
    </>
  );
};

describe("Collapsible", () => {
  it("shows nothing while closed and the content once opened", async () => {
    render(<Harness />);
    expect(screen.queryByText("details")).toBeNull();
    fireEvent.click(screen.getByRole("button"));
    expect(await screen.findByText("details")).toBeTruthy();
  });

  it("is open from the start when it starts open, and removes the content after closing", async () => {
    render(<Harness start />);
    expect(screen.getByText("details")).toBeTruthy();
    fireEvent.click(screen.getByRole("button"));
    await waitFor(() => expect(screen.queryByText("details")).toBeNull());
  });
});
