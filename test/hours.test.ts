import { test } from "node:test";
import assert from "node:assert/strict";
import { toMinutes, dayMinutes, totalHours, totalMiles, parseMiles, roundHours, mondayOf, weekDates, isoDate } from "../public/hours.js";
import { checkDay } from "../src/days.ts";

test("toMinutes reads HH:MM and rejects anything else", () => {
  assert.equal(toMinutes("00:00"), 0);
  assert.equal(toMinutes("08:05"), 485);
  assert.equal(toMinutes("23:59"), 1439);
  for (const bad of ["24:00", "8:05", "08:60", "", null, undefined, "08:05:00"]) assert.equal(toMinutes(bad), null);
});

test("dayMinutes needs both times with out after in", () => {
  assert.equal(dayMinutes({ in: "08:00", out: "17:30" }), 570);
  assert.equal(dayMinutes({ in: "08:00", out: null }), null);
  assert.equal(dayMinutes({ in: "17:00", out: "08:00" }), null);
  assert.equal(dayMinutes({ in: "08:00", out: "08:00" }), null);
});

test("roundHours rounds to the hundredth", () => {
  assert.equal(roundHours(455), "7.58");
  assert.equal(roundHours(20), "0.33");
  assert.equal(roundHours(40), "0.67");
  assert.equal(roundHours(570), "9.50");
  assert.equal(roundHours(0), "0.00");
});

test("totalHours adds minutes before rounding", () => {
  const day = { in: "08:00", out: "08:20" };
  assert.equal(totalHours([day, day, day]), "1.00");
  assert.equal(
    totalHours([
      { in: "07:58", out: "17:13" },
      { in: "08:02", out: "16:47" },
      { in: "08:00", out: null },
      { in: "08:15", out: "17:30" },
    ]),
    "27.25",
  );
});

test("weeks start on Monday", () => {
  assert.equal(isoDate(mondayOf(new Date(2026, 10, 24))), "2026-11-23");
  assert.equal(isoDate(mondayOf(new Date(2026, 10, 23))), "2026-11-23");
  assert.equal(isoDate(mondayOf(new Date(2026, 10, 29))), "2026-11-23");
  assert.deepEqual(weekDates(new Date(2026, 11, 28)), [
    "2026-12-28", "2026-12-29", "2026-12-30", "2026-12-31", "2027-01-01", "2027-01-02", "2027-01-03",
  ]);
});

test("checkDay accepts valid times and blanks", () => {
  assert.deepEqual(checkDay("2026-11-24", { in: "08:00", out: "" }), { day: { in: "08:00", out: null, miles: null } });
  assert.deepEqual(checkDay("2026-11-24", { in: null, out: null }), { day: { in: null, out: null, miles: null } });
  assert.deepEqual(checkDay("2026-11-24", { miles: 12 }), { day: { in: null, out: null, miles: 12 } });
  assert.deepEqual(checkDay("2026-11-24", { miles: 0 }), { day: { in: null, out: null, miles: 0 } });
  assert.deepEqual(checkDay("2026-11-24", { miles: 2.5 }), { day: { in: null, out: null, miles: 2.5 } });
  assert.deepEqual(checkDay("2026-11-24", { miles: 3.456 }), { day: { in: null, out: null, miles: 3.46 } });
});

test("checkDay rejects bad dates and times", () => {
  assert.ok("error" in checkDay("2026-02-30", { in: "08:00" }));
  assert.ok("error" in checkDay("2026-11-24", { in: "8am" }));
  assert.ok("error" in checkDay("2026-11-24", { in: 800 }));
  assert.ok("error" in checkDay("2026-11-24", null));
  for (const miles of [-1, "12", 2001, Infinity, NaN, true]) assert.ok("error" in checkDay("2026-11-24", { miles }), String(miles));
});

test("totalMiles adds miles and skips blanks", () => {
  assert.equal(totalMiles([{ miles: 12 }, { miles: null }, {}, { miles: 30 }, { miles: 0 }]), "42");
  assert.equal(totalMiles([{ miles: 12.5 }, { miles: 3.25 }]), "15.75");
  assert.equal(totalMiles([{ miles: 0.1 }, { miles: 0.2 }]), "0.3");
  assert.equal(totalMiles([]), "0");
});

test("parseMiles reads numbers and text, rounded to the hundredth", () => {
  assert.equal(parseMiles("12.5"), 12.5);
  assert.equal(parseMiles(" 7 "), 7);
  assert.equal(parseMiles(1.005 + 0.001), 1.01);
  for (const bad of ["", null, undefined, "abc", "-1", 2000.5]) assert.equal(parseMiles(bad), null, String(bad));
});
