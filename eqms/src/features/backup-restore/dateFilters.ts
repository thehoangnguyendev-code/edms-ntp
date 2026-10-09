/**
 * The date range picker gives "dd/MM/yyyy", "dd/MM/yyyy HH:mm" or "dd/MM/yyyy HH:mm:ss" in the person's local time. The server
 * takes an instant. A date alone means the whole day; a time to the minute means that minute; a time to the second means that
 * second. A start is the first millisecond of it, an end the last. An incomplete or impossible value means "no limit", never
 * a guess.
 */
export const dateTimeToInstant = (value: string, boundary: "start" | "end"): string | undefined => {
  const match = value.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/);
  if (!match) return undefined;
  const [, day, month, year, hours, minutes, seconds] = match;
  const start = boundary === "start";
  const date =
    hours === undefined
      ? new Date(Number(year), Number(month) - 1, Number(day), start ? 0 : 23, start ? 0 : 59, start ? 0 : 59, start ? 0 : 999)
      : new Date(Number(year), Number(month) - 1, Number(day), Number(hours), Number(minutes), seconds !== undefined ? Number(seconds) : start ? 0 : 59, start ? 0 : 999);
  const sameDay = date.getFullYear() === Number(year) && date.getMonth() === Number(month) - 1 && date.getDate() === Number(day);
  const sameTime =
    hours === undefined || (date.getHours() === Number(hours) && date.getMinutes() === Number(minutes) && (seconds === undefined || date.getSeconds() === Number(seconds)));
  return sameDay && sameTime ? date.toISOString() : undefined;
};
