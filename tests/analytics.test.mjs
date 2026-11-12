import test from "node:test";
import assert from "node:assert/strict";
import { eventRecord, summarizeAnalytics } from "../assets/analytics.js";
test("analytics events contain no identity or contact fields and validate car IDs", () => {
  assert.deepEqual(eventRecord("visit", "", 10), { kind: "visit", at: 10 });
  assert.throws(() => eventRecord("unknown"));
  assert.throws(() => eventRecord("car", "../bad"));
  assert.deepEqual(eventRecord("car", "one", 10), {
    kind: "car",
    car: "one",
    at: 10,
  });
});
test("analytics aggregate sessions, daily chart and top cars without inventing historic visits", () => {
  const now = Date.UTC(2026, 10, 12, 12),
    a = "a".repeat(36),
    b = "b".repeat(36),
    data = {
      "2026-11-12": {
        [a + "_visit"]: { kind: "visit", at: now },
        [b + "_visit"]: { kind: "visit", at: now },
        [a + "_garage"]: { kind: "garage", at: now },
        [a + "_car_one"]: { kind: "car", car: "one", at: now },
        [a + "_instagram"]: { kind: "instagram", at: now },
      },
      "2026-10-01": { old: { kind: "visit", at: 1 } },
    };
  const stats = summarizeAnalytics(data, 7, now);
  assert.equal(stats.visit, 2);
  assert.equal(stats.garage, 1);
  assert.equal(stats.car, 1);
  assert.equal(stats.instagram, 1);
  assert.equal(stats.rate, 50);
  assert.equal(stats.top.one, 1);
  assert.equal(Object.keys(stats.daily).length, 7);
  assert.equal(summarizeAnalytics(null, 30, now).visit, 0);
});
