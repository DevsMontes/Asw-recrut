import { firebaseConfig } from "./shared.js";
const KINDS = ["visit", "garage", "car", "instagram"];
let session;
const sent = new Set();
export function analyticsDay(now = Date.now()) {
  return new Date(now).toISOString().slice(0, 10);
}
function persistentId() {
  if (session) return session;
  try {
    session = localStorage.getItem("celso_visitor_v2");
    if (!/^[a-f0-9-]{36}$/.test(session || "")) {
      session = crypto.randomUUID();
      localStorage.setItem("celso_visitor_v2", session);
    }
  } catch {
    return null;
  }
  return session;
}
async function sessionId() {
  return navigator.locks
    ? navigator.locks.request("celso-visitor", persistentId)
    : persistentId();
}
export function eventRecord(kind, car = "", now = Date.now()) {
  if (!KINDS.includes(kind)) throw new Error("Invalid event");
  if (kind === "car" && !/^[A-Za-z0-9_-]{1,64}$/.test(car))
    throw new Error("Invalid car");
  return { kind, at: now, ...(kind === "car" ? { car } : {}) };
}
export async function track(kind, car = "") {
  if (
    location.hostname === "localhost" ||
    location.hostname === "127.0.0.1" ||
    navigator.webdriver ||
    navigator.globalPrivacyControl
  )
    return;
  try {
    const event = eventRecord(kind, car);
    const visitor = await sessionId();
    if (!visitor) return;
    const day = new Date().toISOString().slice(0, 10),
      id = `${visitor}_${kind}${car ? "_" + car : ""}`,
      key = `${day}/${id}`;
    if (sent.has(key)) return;
    sent.add(key);
    const response = await fetch(
      `${firebaseConfig.databaseURL}/analytics/${key}.json`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...event, at: { ".sv": "timestamp" } }),
        signal: AbortSignal.timeout(8000),
        keepalive: true,
      },
    );
    if (!response.ok) sent.delete(key);
  } catch {
    /* Analytics never blocks browsing or exposes errors to visitors. */
  }
}
export function bindTracking() {
  track("visit");
  document
    .querySelectorAll('a[href*="instagram.com/celsocpm2"]')
    .forEach((a) => a.addEventListener("click", () => track("instagram")));
}
export function summarizeAnalytics(data, days, now = Date.now()) {
  const end = new Date(now),
    dates = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(end);
    d.setUTCDate(d.getUTCDate() - i);
    dates.push(d.toISOString().slice(0, 10));
  }
  const result = {
    visit: 0,
    garage: 0,
    car: 0,
    instagram: 0,
    engaged: 0,
    daily: Object.fromEntries(dates.map((d) => [d, 0])),
    top: {},
  };
  const visitors = new Set(),
    engaged = new Set();
  for (const day of dates)
    for (const [id, e] of Object.entries(data?.[day] || {})) {
      if (
        !KINDS.includes(e.kind) ||
        typeof e.at !== "number" ||
        e.at > now + 60000
      )
        continue;
      const sid = id.slice(0, 36);
      result[e.kind]++;
      if (e.kind === "visit") {
        result.daily[day]++;
        visitors.add(day + sid);
      }
      if (e.kind === "car" || e.kind === "instagram") engaged.add(day + sid);
      if (e.kind === "car" && typeof e.car === "string")
        result.top[e.car] = (result.top[e.car] || 0) + 1;
    }
  result.engaged = [...engaged].filter((s) => visitors.has(s)).length;
  result.rate = result.visit
    ? Math.round((result.engaged / result.visit) * 100)
    : 0;
  return result;
}
