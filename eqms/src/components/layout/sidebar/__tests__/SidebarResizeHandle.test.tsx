import React from "react";
import { act, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SidebarResizeHandle } from "../SidebarResizeHandle";
import { SIDEBAR_WIDTH_STORAGE_KEY, resetSidebarWidthCache, useSidebarWidth } from "../useSidebarWidth";
import {
  APP_SIDEBAR_KEYBOARD_STEP,
  APP_SIDEBAR_MAX_WIDTH,
  APP_SIDEBAR_MIN_WIDTH,
  APP_SIDEBAR_WIDTH,
  clampSidebarWidth,
} from "../sidebarWidths";

beforeEach(() => {
  window.localStorage.clear();
  resetSidebarWidthCache();
});

describe("sidebar width", () => {
  it("keeps any value inside the allowed range", () => {
    expect(clampSidebarWidth(10)).toBe(APP_SIDEBAR_MIN_WIDTH);
    expect(clampSidebarWidth(5000)).toBe(APP_SIDEBAR_MAX_WIDTH);
    expect(clampSidebarWidth(333.4)).toBe(333);
    expect(clampSidebarWidth(Number.NaN)).toBe(APP_SIDEBAR_WIDTH);
  });

  it("starts at the default, stores a committed width, and forgets it on reset", () => {
    const { result } = renderHook(() => useSidebarWidth());
    expect(result.current.width).toBe(APP_SIDEBAR_WIDTH);

    act(() => result.current.setWidth(380));
    expect(result.current.width).toBe(380);
    expect(window.localStorage.getItem(SIDEBAR_WIDTH_STORAGE_KEY)).toBeNull(); // live change only

    act(() => result.current.commit());
    expect(window.localStorage.getItem(SIDEBAR_WIDTH_STORAGE_KEY)).toBe("380");

    act(() => result.current.reset());
    expect(result.current.width).toBe(APP_SIDEBAR_WIDTH);
    expect(window.localStorage.getItem(SIDEBAR_WIDTH_STORAGE_KEY)).toBeNull();
  });

  it("ignores a stored value outside the range", () => {
    window.localStorage.setItem(SIDEBAR_WIDTH_STORAGE_KEY, "9999");
    resetSidebarWidthCache();
    const { result } = renderHook(() => useSidebarWidth());
    expect(result.current.width).toBe(APP_SIDEBAR_MAX_WIDTH);
  });
});

describe("SidebarResizeHandle", () => {
  const setup = (width = APP_SIDEBAR_WIDTH) => {
    const onResize = vi.fn();
    const onCommit = vi.fn();
    const onReset = vi.fn();
    const onDraggingChange = vi.fn();
    render(
      <SidebarResizeHandle width={width} getLeft={() => 0} onResize={onResize} onCommit={onCommit} onReset={onReset} onDraggingChange={onDraggingChange} />,
    );
    return { handle: screen.getByRole("separator", { name: "Resize sidebar" }), onResize, onCommit, onReset, onDraggingChange };
  };

  it("announces the range and the current width", () => {
    const { handle } = setup(300);
    expect(handle).toHaveAttribute("aria-valuemin", String(APP_SIDEBAR_MIN_WIDTH));
    expect(handle).toHaveAttribute("aria-valuemax", String(APP_SIDEBAR_MAX_WIDTH));
    expect(handle).toHaveAttribute("aria-valuenow", "300");
  });

  it("moves by one step with the arrow keys and never leaves the range", () => {
    const { handle, onResize, onCommit } = setup(APP_SIDEBAR_MAX_WIDTH);
    fireEvent.keyDown(handle, { key: "ArrowRight" });
    expect(onResize).toHaveBeenLastCalledWith(APP_SIDEBAR_MAX_WIDTH);
    fireEvent.keyDown(handle, { key: "ArrowLeft" });
    expect(onResize).toHaveBeenLastCalledWith(APP_SIDEBAR_MAX_WIDTH - APP_SIDEBAR_KEYBOARD_STEP);
    expect(onCommit).toHaveBeenLastCalledWith(APP_SIDEBAR_MAX_WIDTH - APP_SIDEBAR_KEYBOARD_STEP);
    fireEvent.keyDown(handle, { key: "Home" });
    expect(onResize).toHaveBeenLastCalledWith(APP_SIDEBAR_MIN_WIDTH);
  });

  it("restores the default with Enter or a double click", () => {
    const { handle, onReset } = setup();
    fireEvent.keyDown(handle, { key: "Enter" });
    fireEvent.doubleClick(handle);
    expect(onReset).toHaveBeenCalledTimes(2);
  });
});
