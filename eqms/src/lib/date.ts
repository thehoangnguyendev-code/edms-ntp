/**
 * Date Utilities with date-fns
 * Wrapper for date manipulation library
 */

// Placeholder for date-fns configuration
// Install: npm install date-fns

// Example exports when date-fns is installed:
// export {
//   format,
//   parseISO,
//   isAfter,
//   isBefore,
//   addDays,
//   subDays,
//   differenceInDays,
// } from 'date-fns';

// ─── DMY Parsing (dd/MM/yyyy and dd/MM/yyyy HH:mm:ss) ────────────────────────

const DMY_DATETIME_RE = /^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2}):(\d{2})$/;
const DMY_DATE_RE = /^(\d{2})\/(\d{2})\/(\d{4})$/;

/**
 * Parse a string in `dd/MM/yyyy [HH:mm:ss]` format.
 * When no time part is present, returns midnight (start-of-day).
 * Returns `null` if the string does not match either format.
 */
export function parseDMYStart(str: string): Date | null {
  const dt = str.match(DMY_DATETIME_RE);
  if (dt) {
    return new Date(+dt[3], +dt[2] - 1, +dt[1], +dt[4], +dt[5], +dt[6]);
  }
  const d = str.match(DMY_DATE_RE);
  if (d) {
    return new Date(+d[3], +d[2] - 1, +d[1]);
  }
  return null;
}

/**
 * Parse a string in `dd/MM/yyyy [HH:mm:ss]` format.
 * When no time part is present, returns 23:59:59 (end-of-day).
 * Returns `null` if the string does not match either format.
 */
export function parseDMYEnd(str: string): Date | null {
  const dt = str.match(DMY_DATETIME_RE);
  if (dt) {
    return new Date(+dt[3], +dt[2] - 1, +dt[1], +dt[4], +dt[5], +dt[6]);
  }
  const d = str.match(DMY_DATE_RE);
  if (d) {
    return new Date(+d[3], +d[2] - 1, +d[1], 23, 59, 59);
  }
  return null;
}
