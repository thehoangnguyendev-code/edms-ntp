import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { LegacyReportTemplateRedirect, ReportRevisionToLibraryRedirect } from "../ReportTemplateRedirects";

function Where() {
  return <p data-testid="where">{useLocation().pathname}</p>;
}

function at(path: string) {
  cleanup();
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/settings/report-configuration" element={<LegacyReportTemplateRedirect page="list" />} />
        <Route path="/settings/report-configuration/:code/revisions/:revision" element={<LegacyReportTemplateRedirect page="revision" />} />
        <Route path="/settings/report-configuration/:code/details" element={<LegacyReportTemplateRedirect page="details" />} />
        <Route path="/settings/report-configuration/:code" element={<LegacyReportTemplateRedirect page="edit" />} />
        <Route path="/report/templates/:code/revisions/:revision" element={<ReportRevisionToLibraryRedirect />} />
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  );
  return screen.getByTestId("where").textContent;
}

describe("report template addresses", () => {
  it("the old administration addresses lead to the same page in Reports", () => {
    expect(at("/settings/report-configuration")).toBe("/report/template-management");
  });
  it("keeps the template and the revision", () => {
    expect(at("/settings/report-configuration/RPT.0008")).toBe("/report/template-management/RPT.0008");
    expect(at("/settings/report-configuration/RPT.0008/details")).toBe("/report/template-management/RPT.0008/details");
    expect(at("/settings/report-configuration/RPT.0008/revisions/2")).toBe("/report/template-management/RPT.0008/revisions/2");
  });
  it("someone who runs reports has no page of revisions: the old address leads to the report", () => {
    expect(at("/report/templates/RPT.0008/revisions/2")).toBe("/report/templates/RPT.0008");
  });
});
