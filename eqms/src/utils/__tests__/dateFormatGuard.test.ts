import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * A date or time a person reads is dd/MM/yyyy or dd/MM/yyyy HH:mm:ss, written by utils/format.ts (displayDate, displayDateTime, displayTime). This test fails the build
 * when other code formats a date for display: the formatting of the browser (toLocaleDateString and the like), another pattern, or a choice of format on a screen.
 */
const SRC = join(process.cwd(), "src");

const files = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === "__tests__" || name === "node_modules" ? [] : files(path);
    return /\.(ts|tsx)$/.test(name) && !/\.test\.(ts|tsx)$/.test(name) ? [path] : [];
  });

// Comments may talk about a format (a warning about MM/DD/YYYY parsing, for example): only code counts.
const withoutComments = (text: string) => text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
const sources = files(SRC).map((path) => ({ rel: relative(SRC, path).split(sep).join("/"), text: withoutComments(readFileSync(path, "utf8")) }));
const offenders = (test: (text: string) => boolean, allowed: string[] = []) => sources.filter((s) => test(s.text) && !allowed.includes(s.rel)).map((s) => s.rel);

describe("one display format for dates and times", () => {
  it("never uses the date and time formatting of the browser", () => {
    expect(offenders((t) => /\.toLocale(Date|Time)String\(/.test(t))).toEqual([]);
    // toLocaleString() of a number is fine; with a language or options it formats a date
    expect(offenders((t) => /\.toLocaleString\(\s*["'`a-zA-Z{]/.test(t))).toEqual([]);
    expect(offenders((t) => /new Date\([^)]*\)\.toLocaleString\(/.test(t))).toEqual([]);
  });

  it("builds a date pattern only in the formatting file (and for the names of time zones)", () => {
    expect(
      offenders((t) => /Intl\.DateTimeFormat/.test(t), [
        "utils/format.ts",
        "features/calendar/calendarFormatting.ts", // the name of the weekday
      ]),
    ).toEqual([]);
  });

  it("offers no other date format on any screen", () => {
    const other = /MM\/DD\/YYYY|MM\/dd\/yyyy|MM\/dd\/uuuu|YYYY-MM-DD HH|DD-MMM-YYYY|dd-MMM-yyyy|dd-MMM-uuuu|MMM DD, YYYY|MMMM DD, YYYY|uuuu-MM-dd/;
    expect(offenders((t) => other.test(t), ["utils/format.ts"])).toEqual([]);
  });

  it("does not turn a date into text with toDateString or toUTCString", () => {
    expect(offenders((t) => /\.(toDateString|toUTCString|toGMTString)\(/.test(t))).toEqual([]);
  });

  it("shows a moment with a space and no comma between the date and the time", () => {
    const format = sources.find((s) => s.rel === "utils/format.ts")?.text ?? "";
    expect(format).not.toMatch(/\$\{datePart\},\s*\$\{timePart\}/);
  });
  it("has one time zone, the zone of the site: nobody picks one or reads the zone of the browser", () => {
    expect(offenders((t) => /timeZone\s*:/.test(t) && !/timeZoneName/.test(t), [
      "utils/format.ts",
      "config/localization.ts",
      "features/calendar/calendarFormatting.ts", // a date with no time: the weekday is read at UTC so it does not move
      "features/settings/configuration/types.ts", // the fields of the API
      "services/api/calendar.ts",
      "services/api/systemInfo.ts",
    ])).toEqual([]);
    expect(offenders((t) => /supportedValuesOf\(\s*['"]timeZone['"]/.test(t))).toEqual([]);
    expect(offenders((t) => /resolvedOptions\(\)\.timeZone/.test(t))).toEqual([]);
  });
});
