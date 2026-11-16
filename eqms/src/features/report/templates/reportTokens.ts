/** The automatic fields of a report: what the server fills in at the time of a run. */
export const reportTokens = [
  {
    code: "report.title",
    name: "Generated report name",
    example: "Document Status Report",
  },
  { code: "report.code", name: "Report template number", example: "RPT.0001" },
  { code: "template.version", name: "Report template revision", example: "2" },
  { code: "template.name", name: "Report template name", example: "EQMS - Document status register" },
  { code: "report.runId", name: "Run number", example: "Number of the run (for example RUN-000123), to trace a printout to its record" },
  {
    code: "report.executor",
    name: "Prepared by",
    example: "Name of the user generating the report",
  },
  {
    code: "report.generatedAt",
    name: "Generation time",
    example: "Server date and time (dd/MM/yyyy HH:mm:ss, UTC+7)",
  },
  {
    code: "report.asOfAt",
    name: "Data snapshot time",
    example: "Server date and time (dd/MM/yyyy HH:mm:ss, UTC+7)",
  },
  {
    code: "page.number",
    name: "Page number",
    example: "Current PDF page. Use text settings, not uploaded Word.",
  },
  {
    code: "page.total",
    name: "Total pages",
    example: "Total PDF pages. Use text settings, not uploaded Word.",
  },
  { code: "report.filters", name: "Filters used", example: "The filters the report was run with, for example status = ACTIVE; department = QC" },
  { code: "report.rowCount", name: "Number of rows", example: "How many rows the report has" },
  { code: "template.approvedBy", name: "Report template approved by", example: "Name of the person who approved the template revision" },
  { code: "template.approvedAt", name: "Report template approval time", example: "dd/MM/yyyy HH:mm:ss, UTC+7" },
  { code: "report.executorDepartment", name: "Preparer's department", example: "Department of the person who ran the report" },
  { code: "report.executorPosition", name: "Preparer's position", example: "Position of the person who ran the report" },
  { code: "company.name", name: "Company name", example: "As entered under Page, in this appearance" },
  { code: "report.gmpNotice", name: "GMP status statement", example: "Whether the template is confirmed for GMP decisions" },
  { code: "report.signedBy", name: "Signed by", example: "Who signed the run (empty when the run was not signed)" },
  { code: "report.signedAt", name: "Signed on", example: "When the run was signed (empty when not signed)" },
  { code: "report.signatureId", name: "Signature number", example: "Number of the electronic signature (empty when not signed)" },
];
