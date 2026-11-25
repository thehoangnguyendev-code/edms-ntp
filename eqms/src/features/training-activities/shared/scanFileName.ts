const clean = (text: string) => text.replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, " ").trim();

/**
 * The name a scanned test is shown and saved under: Training Number, employee code, name (for example "TRN-QA-26-1976_UAT31-011_Bùi Thị Hoa.pdf"). A person without a code (from outside) has the
 * two parts; when a person has several scans the 2nd, 3rd... carry their number. The stored file keeps the name it was uploaded with, and the Audit Trail the file it opened.
 */
export function scanFileName(trainingNumber: string, person: { employeeCode?: string | null; fullName: string }, originalName: string, index = 0, count = 1): string {
  const dot = originalName.lastIndexOf(".");
  const extension = dot > 0 ? originalName.slice(dot).toLowerCase() : "";
  const parts = [clean(trainingNumber), clean(person.employeeCode ?? ""), clean(person.fullName)].filter(Boolean);
  return `${parts.join("_")}${count > 1 ? `_${index + 1}` : ""}${extension}`;
}
