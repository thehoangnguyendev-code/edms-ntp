import { expect, it } from "vitest";
import { defaultFormValues, fromPickerValue, toPickerValue, validateAnnouncementForm, type AnnouncementFormValues } from "../announcementForm";
import { MESSAGE_MAX, TITLE_MAX } from "../types";

const now = new Date(2026, 9, 8, 12, 0, 0); // 08/10/2026 12:00 local
const valid = (): AnnouncementFormValues => ({
  title: "Planned maintenance",
  message: "The system will be unavailable at 22:00.",
  severity: "WARNING",
  startsAt: "08/10/2026 13:00",
  endsAt: "09/10/2026 01:00",
  enabled: true,
});

it("converts between the picker text and a date, in local time", () => {
  const date = fromPickerValue("08/10/2026 22:30");
  expect(date).not.toBeNull();
  expect([date!.getFullYear(), date!.getMonth(), date!.getDate(), date!.getHours(), date!.getMinutes()]).toEqual([2026, 9, 8, 22, 30]);
  expect(toPickerValue(date!)).toBe("08/10/2026 22:30");
  expect(toPickerValue(new Date(2026, 0, 5, 7, 5).toISOString())).toBe("05/01/2026 07:05");
});

it("rejects a picker text that is not a complete, real date and time", () => {
  expect(fromPickerValue("")).toBeNull();
  expect(fromPickerValue("08/10/2026")).toBeNull();
  expect(fromPickerValue("31/02/2026 10:00")).toBeNull();
  expect(fromPickerValue("08/10/2026 25:00")).toBeNull();
});

it("starts a new announcement now and ends it a day later", () => {
  const values = defaultFormValues(now);
  expect(values.startsAt).toBe("08/10/2026 12:00");
  expect(values.endsAt).toBe("09/10/2026 12:00");
  expect(values.enabled).toBe(true);
});

it("accepts a complete announcement", () => {
  expect(validateAnnouncementForm(valid(), true, now)).toEqual({});
});

it("requires a title and a message within their limits", () => {
  expect(validateAnnouncementForm({ ...valid(), title: "  " }, true, now).title).toBeTruthy();
  expect(validateAnnouncementForm({ ...valid(), title: "x".repeat(TITLE_MAX + 1) }, true, now).title).toBeTruthy();
  expect(validateAnnouncementForm({ ...valid(), message: "" }, true, now).message).toBeTruthy();
  expect(validateAnnouncementForm({ ...valid(), message: "x".repeat(MESSAGE_MAX + 1) }, true, now).message).toBeTruthy();
});

it("requires the end to be after the start, and in the future for a new announcement", () => {
  expect(validateAnnouncementForm({ ...valid(), endsAt: "08/10/2026 13:00" }, true, now).endsAt).toBeTruthy();
  expect(validateAnnouncementForm({ ...valid(), endsAt: "08/10/2026 12:30" }, true, now).endsAt).toBeTruthy();
  const past = { ...valid(), startsAt: "07/10/2026 08:00", endsAt: "07/10/2026 10:00" };
  expect(validateAnnouncementForm(past, true, now).endsAt).toBeTruthy();
  expect(validateAnnouncementForm(past, false, now).endsAt).toBeUndefined(); // an existing one may be corrected after it ended
});

it("asks for both times", () => {
  const errors = validateAnnouncementForm({ ...valid(), startsAt: "", endsAt: "" }, true, now);
  expect(errors.startsAt).toBeTruthy();
  expect(errors.endsAt).toBeTruthy();
});
