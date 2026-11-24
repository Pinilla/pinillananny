import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFile, writeFile, rename, mkdir, appendFile } from "node:fs/promises";
import { join, extname, dirname } from "node:path";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { fileURLToPath } from "node:url";
import { checkDay, type Day, type Days } from "./days.ts";

const HOST = process.env.HOST ?? "127.0.0.1";
const PORT = Number(process.env.PORT ?? 3300);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA = process.env.NANNY_DATA ?? join(ROOT, "data");
const PIN = process.env.NANNY_PIN ?? "";
const PUBLIC = join(ROOT, "public");
const DAYS_FILE = join(DATA, "days.json");
const LOG_FILE = join(DATA, "changes.jsonl");
const COOKIE = "nanny";
const YEAR = 365 * 24 * 3600;

if (!/^\d{4,8}$/.test(PIN)) {
  console.error("Set NANNY_PIN to 4 to 8 digits.");
  process.exit(1);
}

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".webmanifest": "application/manifest+json",
  ".png": "image/png",
};

const CSP = "default-src 'self'; style-src 'self'; script-src 'self'; img-src 'self' data:; connect-src 'self'";

await mkdir(DATA, { recursive: true });

let days: Days = {};
try {
  days = JSON.parse(await readFile(DAYS_FILE, "utf8")) as Days;
} catch {
}

let secret: Buffer;
try {
  secret = await readFile(join(DATA, "secret"));
} catch {
  secret = randomBytes(32);
  await writeFile(join(DATA, "secret"), secret, { mode: 0o600 });
}
const TOKEN = createHmac("sha256", secret).update(PIN).digest("base64url");

let saving = Promise.resolve();
function save() {
  const text = JSON.stringify(days, null, 1);
  saving = saving.then(async () => {
    await writeFile(DAYS_FILE + ".tmp", text);
    await rename(DAYS_FILE + ".tmp", DAYS_FILE);
  });
  return saving;
}

function cookies(req: IncomingMessage): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of (req.headers.cookie ?? "").split(";")) {
    const i = part.indexOf("=");
    if (i > 0) out[part.slice(0, i).trim()] = part.slice(i + 1).trim();
  }
  return out;
}

function same(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

function loggedIn(req: IncomingMessage) {
  return same(cookies(req)[COOKIE] ?? "", TOKEN);
}

const failsByIp = new Map<string, number[]>();
let failsAll: number[] = [];
function tooManyFails(ip: string) {
  const now = Date.now();
  const mine = (failsByIp.get(ip) ?? []).filter((t) => now - t < 15 * 60_000);
  failsByIp.set(ip, mine);
  failsAll = failsAll.filter((t) => now - t < 60 * 60_000);
  return mine.length >= 5 || failsAll.length >= 30;
}
function recordFail(ip: string) {
  const now = Date.now();
  failsByIp.get(ip)!.push(now);
  failsAll.push(now);
}

function send(res: ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}) {
  res.writeHead(status, { "content-type": "application/json", "cache-control": "no-store", ...headers });
  res.end(JSON.stringify(body));
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  if (!(req.headers["content-type"] ?? "").startsWith("application/json")) throw new Error("expected JSON");
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 10_000) throw new Error("too large");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

async function api(req: IncomingMessage, res: ServerResponse, url: URL) {
  const ip = (req.headers["x-real-ip"] as string) ?? req.socket.remoteAddress ?? "";

  if (url.pathname === "/api/login" && req.method === "POST") {
    if (tooManyFails(ip)) return send(res, 429, { error: "Too many wrong PINs. Try again in 15 minutes." });
    const body = (await readJson(req)) as { pin?: unknown };
    if (typeof body.pin !== "string" || !same(body.pin, PIN)) {
      recordFail(ip);
      return send(res, 401, { error: "That PIN isn't right." });
    }
    const secure = req.headers["x-forwarded-proto"] === "https" ? "; Secure" : "";
    return send(res, 200, { ok: true }, {
      "set-cookie": `${COOKIE}=${TOKEN}; Path=/; Max-Age=${YEAR}; HttpOnly; SameSite=Strict${secure}`,
    });
  }

  if (!loggedIn(req)) return send(res, 401, { error: "Log in first." });

  if (url.pathname === "/api/days" && req.method === "GET") {
    const from = url.searchParams.get("from") ?? "";
    const to = url.searchParams.get("to") ?? "";
    if (!DATE.test(from) || !DATE.test(to)) return send(res, 400, { error: "from and to must be YYYY-MM-DD" });
    const out: Days = {};
    for (const [date, day] of Object.entries(days)) if (date >= from && date <= to) out[date] = day;
    return send(res, 200, out);
  }

  const m = /^\/api\/days\/(\d{4}-\d{2}-\d{2})$/.exec(url.pathname);
  if (m && req.method === "PUT") {
    const date = m[1];
    const checked = checkDay(date, await readJson(req));
    if ("error" in checked) return send(res, 400, checked);
    const before = days[date] ?? null;
    const after: Day | null = checked.day.in || checked.day.out || checked.day.miles !== null ? checked.day : null;
    if (after) days[date] = after;
    else delete days[date];
    await save();
    await appendFile(LOG_FILE, JSON.stringify({ at: new Date().toISOString(), date, before, after }) + "\n");
    return send(res, 200, after ?? {});
  }

  return send(res, 404, { error: "not found" });
}

async function serveFile(res: ServerResponse, pathname: string) {
  const name = pathname === "/" ? "index.html" : pathname.slice(1);
  if (!/^[a-z0-9-]+\.[a-z]+$/.test(name)) return send(res, 404, { error: "not found" });
  try {
    const body = await readFile(join(PUBLIC, name));
    res.writeHead(200, {
      "content-type": TYPES[extname(name)] ?? "application/octet-stream",
      "cache-control": "no-cache",
      "content-security-policy": CSP,
      "x-content-type-options": "nosniff",
      "referrer-policy": "no-referrer",
    });
    res.end(body);
  } catch {
    send(res, 404, { error: "not found" });
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  try {
    if (url.pathname === "/healthz") return send(res, 200, { ok: true });
    if (url.pathname.startsWith("/api/")) return await api(req, res, url);
    if (req.method !== "GET" && req.method !== "HEAD") return send(res, 405, { error: "method not allowed" });
    return await serveFile(res, url.pathname);
  } catch (err) {
    console.error(err);
    if (!res.headersSent) send(res, 400, { error: "bad request" });
  }
});

server.listen(PORT, HOST, () => console.log(`pinillananny on http://${HOST}:${PORT}`));
