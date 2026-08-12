/**
 * Audit Trail Helper
 * Standardizes data preparation for 21 CFR Part 11 compliance
 */

export interface DataDiff {
  field: string;
  oldValue: any;
  newValue: any;
  label: string;
}

/**
 * Generate a list of differences between two objects
 * Useful for building the 'changes' array in audit trail requests
 */
export function generateDiff(oldData: any, newData: any, fieldLabels: Record<string, string> = {}): DataDiff[] {
  const diffs: DataDiff[] = [];

  // Iterate through new data to find changes or additions
  Object.keys(newData).forEach((key) => {
    const oldVal = oldData[key];
    const newVal = newData[key];

    // Simple shallow comparison for primitives, dates, and strings
    if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
      diffs.push({
        field: key,
        oldValue: oldVal === undefined ? null : oldVal,
        newValue: newVal,
        label: fieldLabels[key] || key,
      });
    }
  });

  return diffs;
}

/**
 * Formats a diff entry for human-readable display in the UI
 */
export function formatDiffDescription(diff: DataDiff): string {
  const from = diff.oldValue === null || diff.oldValue === '' ? '[Empty]' : String(diff.oldValue);
  const to = diff.newValue === null || diff.newValue === '' ? '[Empty]' : String(diff.newValue);
  return `Changed ${diff.label} from "${from}" to "${to}"`;
}
