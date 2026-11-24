// Checks a day's times before the server saves them.

import { toMinutes } from "../public/hours.js";

export type Day = { in: string | null; out: string | null; miles: number | null };
export type Days = Record<string, Day>;

export function checkDay(date: string, body: unknown): { day: Day } | { error: string } {
  const d = new Date(date + "T00:00:00Z");
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== date) return { error: "That date doesn't exist." };
  if (typeof body !== "object" || body === null) return { error: "Send in and out times." };
  const b = body as Record<string, unknown>;
  const day: Day = { in: null, out: null, miles: null };
  for (const key of ["in", "out"] as const) {
    const v = b[key];
    if (v === null || v === undefined || v === "") continue;
    if (typeof v !== "string" || toMinutes(v) === null) return { error: `"${key}" must be a time like 08:30.` };
    day[key] = v;
  }
  const miles = b.miles;
  if (miles !== null && miles !== undefined && miles !== "") {
    if (typeof miles !== "number" || !Number.isInteger(miles) || miles < 0 || miles > 2000) {
      return { error: "Miles must be a whole number from 0 to 2000." };
    }
    day.miles = miles;
  }
  // Allow "out" before "in" to be saved, since someone fixing a typo may change
  // one field at a time. The page flags it and leaves the day out of the total.
  return { day };
}
