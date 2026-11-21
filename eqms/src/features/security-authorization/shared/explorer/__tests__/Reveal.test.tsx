import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Reveal } from "../Reveal";

afterEach(cleanup);

describe("Reveal", () => {
  it("leaves nothing in the page while hidden", () => {
    const { container } = render(<Reveal show={false}><p>Choice</p></Reveal>);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows its children when asked to and removes them again once they have slid away", async () => {
    const { rerender, container } = render(<Reveal show={false}><p>Choice</p></Reveal>);
    rerender(<Reveal show><p>Choice</p></Reveal>);
    expect(screen.getByText("Choice")).toBeInTheDocument();
    rerender(<Reveal show={false}>{null}</Reveal>);
    // the last content stays while it leaves, then nothing is left
    await waitFor(() => expect(container).toBeEmptyDOMElement(), { timeout: 2000 });
  });

  it("draws at once, without leaving space, when it starts shown", () => {
    render(<Reveal show><p>Choice</p></Reveal>);
    expect(screen.getByText("Choice")).toBeInTheDocument();
  });
});
