/** What the live preview puts in an automatic field: sample values, so that a person sees how long the text comes out. A real run fills them from its own data. */
export const SAMPLE_VALUES: Record<string, string> = {
  "report.title": "Documents due for review",
  "template.name": "EQMS - Document status register",
  "report.code": "RPT.0023",
  "template.version": "1.0",
  "report.runId": "RUN-000123",
  "report.executor": "Nguyen The Hoang",
  "report.executorDepartment": "Quality Assurance",
  "report.executorPosition": "QA Manager",
  "report.filters": "status = ACTIVE; daysToReview <= 30",
  "report.rowCount": "12",
  "report.generatedAt": "14/11/2026 09:54:49",
  "report.asOfAt": "14/11/2026 09:54:49",
  "template.approvedBy": "QA Head",
  "template.approvedAt": "12/11/2026 09:00:00",
  "company.name": "",
  "report.gmpNotice": "For GMP decisions. Template revision 1.0 approved by QA Head on 12/11/2026 09:00:00.",
  "report.signedBy": "",
  "report.signedAt": "",
  "report.signatureId": "",
  "page.number": "1",
  "page.total": "2",
};

/** Fills the automatic fields of a text with sample values. A field that has no sample stays as it is written. */
export function fillSample(text: string, companyName: string, page: number, pages: number): string {
  return text.replace(/\{\{([^}]+)\}\}/g, (whole, code: string) => {
    if (code === "company.name") return companyName;
    if (code === "page.number") return String(page);
    if (code === "page.total") return String(pages);
    return SAMPLE_VALUES[code] ?? whole;
  });
}
