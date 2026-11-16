import type { ReportSource, TemplateWrite } from "@/services/api/reportTemplates";

/** The most columns one report may carry when the server does not say (REPORT-FIELD-CATALOG-2026-11-15). */
export const DEFAULT_MAX_COLUMNS = 30;
/** The group a template allows from the start. */
export const CORE_GROUP = "Core";

export const maxColumnsOf = (source?: Pick<ReportSource, "maxColumns">) => source?.maxColumns ?? DEFAULT_MAX_COLUMNS;

export const groupOf = (source: Pick<ReportSource, "fieldGroups"> | undefined, code: string) => source?.fieldGroups?.[code] ?? CORE_GROUP;

/** The groups of a set of field groups, Core first and the others in the order the source lists them. */
export function groupNames(groups: Iterable<string>): string[] {
  const seen = new Set<string>();
  for (const group of groups) seen.add(group);
  return [...seen].sort((a, b) => (a === CORE_GROUP ? -1 : b === CORE_GROUP ? 1 : 0));
}

/** True when a field shows for what was typed and the group chosen (case and accents ignored). */
export function fieldMatches(name: string, group: string, search: string, groupFilter: string): boolean {
  if (groupFilter && group !== groupFilter) return false;
  const fold = (text: string) => text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const term = fold(search.trim());
  return !term || fold(name).includes(term) || fold(group).includes(term);
}

type FieldWrite = TemplateWrite["fields"][number];

/**
 * The fields of a template for a source. A template that exists keeps what it allowed; a field the source gained later is not allowed until the author allows it.
 * A new template allows the Core group and selects at most the limit of them (the required ones always).
 */
export function initialFields(
  source: ReportSource,
  existing: Array<Pick<FieldWrite, "code" | "allowed" | "defaultSelected" | "required">> | undefined,
  create: boolean,
): FieldWrite[] {
  const limit = maxColumnsOf(source);
  let selected = source.requiredFields.length;
  return Object.keys(source.fields).map((code) => {
    const stored = existing?.find((item) => item.code === code);
    const required = source.requiredFields.includes(code);
    if (!create) {
      return { code, allowed: stored?.allowed ?? false, defaultSelected: stored?.defaultSelected ?? false, required: stored?.required || required };
    }
    const core = groupOf(source, code) === CORE_GROUP;
    const pick = !required && core && selected < limit;
    if (pick) selected += 1;
    return { code, allowed: core || required, defaultSelected: required || pick, required };
  });
}
