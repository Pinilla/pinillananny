import { dayMinutes, totalHours, roundHours, isoDate, mondayOf, weekDates } from "./hours.js";

const $ = (id) => document.getElementById(id);
const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

let monday = mondayOf(new Date());
// True while the current week is on screen, so the page follows into next week.
let followToday = true;
let days = {}; // "YYYY-MM-DD" -> { in, out } for the week on screen

// ---- server

async function call(method, path, body) {
  const res = await fetch(path, {
    method,
    headers: body ? { "content-type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && path !== "/api/login") {
    showLogin();
    throw new Error("login");
  }
  if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
  return data;
}

async function loadWeek() {
  const dates = weekDates(monday);
  days = await call("GET", `/api/days?from=${dates[0]}&to=${dates[6]}`);
  render();
}

async function saveDay(date, day) {
  const saved = await call("PUT", `/api/days/${date}`, day);
  if (saved.in || saved.out) days[date] = saved;
  else delete days[date];
  render();
}

// ---- formatting

function to12h(time) {
  if (!time) return "";
  const [h, m] = time.split(":").map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

function nowHHMM() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function shortDate(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

let toastTimer;
function toast(text) {
  const el = $("toast");
  el.textContent = text;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 1800);
}

// ---- drawing

function render() {
  const dates = weekDates(monday);
  const today = isoDate(new Date());
  const isThisWeek = dates.includes(today);

  $("week-label").textContent = `${shortDate(dates[0])} – ${shortDate(dates[6])}`;
  $("this-week").hidden = isThisWeek;
  $("today").hidden = !isThisWeek;

  if (isThisWeek) {
    const t = days[today] ?? {};
    $("today-label").textContent = new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
    $("today-status").textContent =
      t.in && t.out ? `Arrived ${to12h(t.in)}, left ${to12h(t.out)}`
      : t.in ? `Arrived at ${to12h(t.in)}`
      : t.out ? `Left at ${to12h(t.out)}`
      : "Not here yet today";
  }

  const list = $("days");
  const focused = document.activeElement?.dataset?.key; // keep the field being edited
  list.replaceChildren(...dates.map((date, i) => dayRow(date, DAY_NAMES[i], date === today)));
  if (focused) list.querySelector(`[data-key="${focused}"]`)?.focus();

  const entries = dates.map((d) => days[d]).filter(Boolean);
  $("total-value").textContent = totalHours(entries);

  const bad = dates.filter((d) => days[d]?.in && days[d]?.out && dayMinutes(days[d]) === null);
  const open = dates.filter((d) => d !== today && (!days[d]?.in !== !days[d]?.out));
  $("warning").textContent = [
    bad.length ? `Left is before arrived on ${bad.map(shortDate).join(", ")}, so that day isn't counted.` : "",
    open.length ? `Missing a time on ${open.map(shortDate).join(", ")}, so that day isn't counted.` : "",
  ].filter(Boolean).join(" ");
}

function dayRow(date, name, isToday) {
  const entry = days[date] ?? { in: null, out: null };
  const li = document.createElement("li");
  li.className = "day" + (isToday ? " is-today" : "");

  const label = document.createElement("span");
  label.className = "name";
  label.append(name);
  const small = document.createElement("small");
  small.textContent = shortDate(date);
  label.append(small);

  const input = (key, aria) => {
    const el = document.createElement("input");
    el.type = "time";
    el.value = entry[key] ?? "";
    el.dataset.key = `${date}:${key}`;
    el.setAttribute("aria-label", `${aria} ${name} ${shortDate(date)}`);
    el.addEventListener("change", async () => {
      const value = el.value || null;
      if (value === (entry[key] ?? null)) return;
      try {
        await saveDay(date, { ...entry, [key]: value });
        toast("Saved");
      } catch (err) {
        if (err.message !== "login") toast(`Couldn't save: ${err.message}`);
      }
    });
    return el;
  };

  const hours = document.createElement("span");
  hours.className = "hours";
  const mins = dayMinutes(entry);
  if (mins !== null) hours.textContent = roundHours(mins);
  else if (entry.in && entry.out) { li.classList.add("bad"); hours.textContent = "?"; }
  else hours.textContent = "–";

  li.append(label, input("in", "Arrived"), input("out", "Left"), hours);
  return li;
}

// ---- actions

async function punch(key) {
  const today = isoDate(new Date());
  const entry = days[today] ?? { in: null, out: null };
  const now = nowHHMM();
  const word = key === "in" ? "arrival" : "leaving time";
  if (entry[key] && entry[key] !== now &&
      !confirm(`Today's ${word} is already ${to12h(entry[key])}. Change it to ${to12h(now)}?`)) return;
  try {
    await saveDay(today, { ...entry, [key]: now });
    toast(key === "in" ? `Welcome! Arrived at ${to12h(now)}` : `Bye! Left at ${to12h(now)}`);
  } catch (err) {
    if (err.message !== "login") toast(`Couldn't save: ${err.message}`);
  }
}

async function copyTotal() {
  const text = $("total-value").textContent;
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // Older browsers: copy through a hidden text field.
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.append(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
  }
  $("total-hint").textContent = `Copied ${text}`;
  setTimeout(() => ($("total-hint").textContent = "Tap to copy"), 2000);
}

function moveWeek(weeks) {
  monday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + weeks * 7);
  followToday = isoDate(monday) === isoDate(mondayOf(new Date()));
  loadWeek().catch(() => {});
}

// ---- login and start

function showLogin() {
  $("app").hidden = true;
  $("login").hidden = false;
  $("pin").focus();
}

$("login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  $("login-error").textContent = "";
  try {
    await call("POST", "/api/login", { pin: $("pin").value });
    $("pin").value = "";
    start();
  } catch (err) {
    $("login-error").textContent = err.message;
  }
});

$("arrive").addEventListener("click", () => punch("in"));
$("leave").addEventListener("click", () => punch("out"));
$("total").addEventListener("click", copyTotal);
$("prev").addEventListener("click", () => moveWeek(-1));
$("next").addEventListener("click", () => moveWeek(1));
$("this-week").addEventListener("click", () => {
  monday = mondayOf(new Date());
  followToday = true;
  loadWeek().catch(() => {});
});

// Pick up changes made on the other phone, and roll over to a new day or
// week, whenever the page comes back into view. Skip it mid-edit.
function refresh() {
  if (document.hidden || $("app").hidden) return;
  if (document.activeElement?.tagName === "INPUT") return;
  if (followToday) monday = mondayOf(new Date());
  loadWeek().catch(() => {});
}
document.addEventListener("visibilitychange", refresh);
setInterval(refresh, 60_000);

async function start() {
  try {
    await loadWeek();
    $("login").hidden = true;
    $("app").hidden = false;
  } catch (err) {
    if (err.message !== "login") toast(`Couldn't load: ${err.message}`);
  }
}

start();
