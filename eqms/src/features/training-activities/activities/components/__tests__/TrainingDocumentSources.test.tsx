import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { TrainingDocumentSources } from "../TrainingDocumentSources";

describe("Documents from Document Control", () => {
  it("lists the document and every related document, and opens a document that has a revision", () => {
    render(
      <MemoryRouter>
        <TrainingDocumentSources documents={[
          { role: "MAIN", documentId: "d1", revisionId: "r1", documentNumber: "SOP.0101", documentName: "Gowning", revisionNumber: "01", revisionStatus: "DRAFT", approved: false },
          { role: "RELATED", documentId: "d2", revisionId: "r2", documentNumber: "SOP.0102", documentName: "Cleaning", revisionNumber: "03", revisionStatus: "EFFECTIVE", approved: true, unchanged: true },
          { role: "RELATED", documentId: "d3", revisionId: null, documentNumber: "SOP.0103", documentName: "Waste", revisionNumber: null, revisionStatus: null },
        ]} />
      </MemoryRouter>,
    );
    expect(screen.getByText("SOP.0101 Gowning")).toBeInTheDocument();
    expect(screen.getByText("SOP.0102 Cleaning")).toBeInTheDocument();
    expect(screen.getByText("SOP.0103 Waste")).toBeInTheDocument();
    expect(screen.getByText("No revision yet")).toBeInTheDocument();
    // a revision that is not approved cannot be opened from here, and a document with no revision has nothing to open
    expect(screen.getByText("Not approved yet")).toBeInTheDocument();
    expect(screen.getByText("Not changed in this version")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Open" })).toHaveLength(1);
  });

  it("shows nothing for a training that does not come from a document", () => {
    const { container } = render(<MemoryRouter><TrainingDocumentSources documents={[]} /></MemoryRouter>);
    expect(container).toBeEmptyDOMElement();
  });
});
