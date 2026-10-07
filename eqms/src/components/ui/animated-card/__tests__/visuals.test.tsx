import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AnimatedCard, AnimatedStatCard, BarsVisual, CardVisual, DonutVisual, TrendVisual } from "..";

const inCard = (node: React.ReactNode) =>
  render(
    <AnimatedCard>
      <CardVisual>{node}</CardVisual>
    </AnimatedCard>,
  );

describe("animated card visuals draw only the data they are given", () => {
  it("BarsVisual scales bar heights to the largest real value", () => {
    inCard(<BarsVisual bars={[{ label: "Effective", value: 40, accent: true }, { label: "Draft", value: 10 }]} />);
    expect(screen.getByRole("img")).toHaveAttribute("aria-label", "Effective: 40, Draft: 10");
    expect(screen.getByTitle("Effective: 40").querySelector("[style*=\"height\"]")).toHaveStyle({ height: "100%" });
    expect(screen.getByTitle("Draft: 10").querySelector("[style*=\"height\"]")).toHaveStyle({ height: "25%" });
  });

  it("BarsVisual shows the empty label instead of inventing bars", () => {
    inCard(<BarsVisual bars={[{ label: "A", value: 0 }]} emptyLabel="Nothing is waiting" />);
    expect(screen.getByText("Nothing is waiting")).toBeInTheDocument();
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("TrendVisual reports the real peak and range", () => {
    inCard(<TrendVisual points={[{ label: "Jan 1", value: 2 }, { label: "Jan 2", value: 9 }, { label: "Jan 3", value: 4 }]} />);
    expect(screen.getByRole("img")).toHaveAttribute("aria-label", "Trend from Jan 1 to Jan 3, peak 9 on Jan 2");
  });

  it("TrendVisual needs a real series with at least two points", () => {
    inCard(<TrendVisual points={[{ label: "Jan 1", value: 5 }]} emptyLabel="No audit events" />);
    expect(screen.getByText("No audit events")).toBeInTheDocument();
  });

  it("DonutVisual clamps the ring and labels it with the real percent", () => {
    inCard(<DonutVisual percent={140} />);
    expect(screen.getByText("100%")).toBeInTheDocument();
  });

  it("AnimatedStatCard exposes its ratio only when one is supplied", () => {
    const { rerender } = render(<AnimatedStatCard icon={<span />} label="Effective" value="4" progress={37.6} />);
    expect(screen.getByRole("img", { name: "Effective: 38%" })).toBeInTheDocument();
    rerender(<AnimatedStatCard icon={<span />} label="Effective" value="4" />);
    expect(screen.queryByRole("img")).toBeNull();
  });
});
