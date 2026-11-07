import React from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Select } from "../Select";

const LONG = "ACT-TEST.00121b92-e93b-4d97-ae03-b0ca3494101c - Activation Rollback Test Document";
const options = [{ value: "a", label: LONG }, { value: "b", label: "SOP.0037 - Balance calibration" }];

beforeEach(() => {
  window.matchMedia = ((query: string) => ({
    matches: true, media: query, addEventListener: () => undefined, removeEventListener: () => undefined,
    addListener: () => undefined, removeListener: () => undefined, onchange: null, dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
  window.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
});
afterEach(cleanup);

const open = () => fireEvent.click(screen.getByRole("combobox"));

describe("Select truncateOptions", () => {
  it("keeps a long option on one line and shows the full text as a tooltip when it is switched on", () => {
    render(<Select value="" onChange={() => undefined} options={options} enableSearch={false} truncateOptions />);
    open();
    const label = screen.getByText(LONG);
    expect(label.className).toContain("truncate");
    expect(label.className).toContain("min-w-0");
    expect(label.getAttribute("title")).toBe(LONG);
  });

  it("leaves the options as they were when it is not switched on", () => {
    render(<Select value="" onChange={() => undefined} options={options} enableSearch={false} />);
    open();
    const label = screen.getByText(LONG);
    expect(label.className).not.toContain("truncate");
    expect(label.getAttribute("title")).toBeNull();
  });
});
