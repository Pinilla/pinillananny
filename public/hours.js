export function toMinutes(time) {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time ?? "");
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

export function dayMinutes(entry) {
  const start = toMinutes(entry?.in);
  const end = toMinutes(entry?.out);
  if (start === null || end === null || end <= start) {
    return null;
  }
  return end - start;
}

export function totalHours(entries) {
  let minutes = 0;
  for (const e of entries) {
    minutes += dayMinutes(e) ?? 0;
  }
  return roundHours(minutes);
}

export function roundHours(minutes) {
  return (Math.round((minutes / 60) * 100) / 100).toFixed(2);
}

export function parseMiles(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const n = typeof value === "number" ? value : Number(String(value).trim());
  if (!Number.isFinite(n) || n < 0 || n > 2000) {
    return null;
  }
  return Math.round(n * 100) / 100;
}

export function totalMiles(entries) {
  let hundredths = 0;
  for (const e of entries) {
    const m = parseMiles(e?.miles);
    if (m !== null) {
      hundredths += Math.round(m * 100);
    }
  }
  return String(hundredths / 100);
}

export function isoDate(d) {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function mondayOf(d) {
  const day = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const back = (day.getDay() + 6) % 7;
  day.setDate(day.getDate() - back);
  return day;
}

export function weekDates(monday) {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i);
    return isoDate(d);
  });
}
