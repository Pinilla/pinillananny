// Hours math shared by the page and the server tests. Times are "HH:MM" strings
// in 24-hour form, the same format an <input type="time"> uses.

/** Minutes since midnight for "HH:MM", or null if the string isn't a valid time. */
export function toMinutes(time) {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time ?? "");
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

/** Minutes worked in a day, or null when a time is missing or "out" isn't after "in". */
export function dayMinutes(entry) {
  const start = toMinutes(entry?.in);
  const end = toMinutes(entry?.out);
  if (start === null || end === null || end <= start) return null;
  return end - start;
}

/**
 * Total hours for a list of day entries, rounded to the hundredth.
 * It adds whole minutes first and rounds once, so rounding each day
 * can't drift the total by a cent's worth of time.
 */
export function totalHours(entries) {
  let minutes = 0;
  for (const e of entries) minutes += dayMinutes(e) ?? 0;
  return roundHours(minutes);
}

/** Minutes as hours with two decimals, as a string: 455 minutes is "7.58". */
export function roundHours(minutes) {
  return (Math.round((minutes / 60) * 100) / 100).toFixed(2);
}

/** "YYYY-MM-DD" for a Date in the browser's local time zone. */
export function isoDate(d) {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** The Monday on or before the given date, as a local Date at midnight. */
export function mondayOf(d) {
  const day = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const back = (day.getDay() + 6) % 7; // Monday is 0, Sunday is 6
  day.setDate(day.getDate() - back);
  return day;
}

/** The seven dates of the week starting on a Monday, as "YYYY-MM-DD". */
export function weekDates(monday) {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i);
    return isoDate(d);
  });
}
