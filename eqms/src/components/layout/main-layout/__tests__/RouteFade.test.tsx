import React, { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RouteFade } from "../RouteFade";

const Counter: React.FC = () => {
  const [n, setN] = useState(0);
  return <button onClick={() => setN((v) => v + 1)}>count {n}</button>;
};

describe("RouteFade", () => {
  it("shows the page and keeps its state when the route changes (the page is not remounted)", () => {
    const view = render(<RouteFade routeKey="/a"><Counter /></RouteFade>);
    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByRole("button").textContent).toBe("count 1");

    view.rerender(<RouteFade routeKey="/b"><Counter /></RouteFade>);

    expect(screen.getByRole("button").textContent).toBe("count 1");
  });
});
