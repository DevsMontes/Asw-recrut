import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { JSDOM } from "jsdom";
import * as shared from "../assets/shared.js";
const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
const source = (
  await readFile(new URL("../assets/public.js", import.meta.url), "utf8")
).replace(
  /^import[\s\S]*?from ["']\.\/shared\.js["'];\r?\n/,
  "const { $, STATUS, initFirebase, recruitmentState, validApplicationId, validateApplication, storage, databaseRequest } = window.__shared;\n",
);
const id = "-Ox0123456789_ABCdef";
const settle = () => new Promise((resolve) => setImmediate(resolve));
function fixture({ status = "aberto", saved = {}, requestOverride } = {}) {
  const dom = new JSDOM(html, {
    url: "https://example.test/",
    runScripts: "outside-only",
  });
  const win = dom.window,
    listeners = new Map(),
    calls = [],
    state = { "config/status": status, ".info/connected": true };
  const memory = new Map(Object.entries(saved));
  const storage = {
    get: (key) => memory.get(key) || null,
    set: (key, value) => memory.set(key, value),
    remove: (key) => memory.delete(key),
  };
  const database = {
    ref: (path) => ({
      push: () => ({ key: id }),
      on: (event, callback) => {
        listeners.set(path, callback);
        callback({ val: () => state[path] ?? null });
        return callback;
      },
      off: () => listeners.delete(path),
    }),
  };
  const emit = (path, value) => {
    state[path] = value;
    listeners.get(path)?.({ val: () => value });
  };
  const request = async (path, options = {}) => {
    calls.push({ path, options });
    if (requestOverride) {
      const override = await requestOverride(path, options, { state, emit });
      if (override !== undefined) return override;
    }
    if (options.method === "PUT") {
      const value = JSON.parse(options.body);
      state[`${path}/status`] = value.status;
      return value;
    }
    return state[path] ?? null;
  };
  win.HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  win.HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
  };
  win.__shared = {
    ...shared,
    $: (key) => win.document.getElementById(key),
    initFirebase: () => database,
    storage: () => storage,
    databaseRequest: request,
  };
  win.eval(source);
  return {
    win,
    dom,
    calls,
    state,
    emit,
    memory,
    $: (key) => win.document.getElementById(key),
    close: () => win.close(),
  };
}
function fill(f) {
  for (const [key, value] of Object.entries({
    name: "Piloto",
    discord: "piloto",
    phone: "77988887777",
    age: "18",
    hours: "20",
    routine: "Estudos",
    schedule: "À noite",
    history: "Primeira equipe",
    profile: "Não",
  }))
    f.$(key).value = value;
  f.$("terms").checked = true;
}
function submit(f) {
  f.$("recruit-form").dispatchEvent(
    new f.win.Event("submit", { bubbles: true, cancelable: true }),
  );
}
test("open -> closed -> open preserves the form and blocks a stale submission", async () => {
  const f = fixture();
  f.win.document.querySelector("[data-apply]").click();
  fill(f);
  assert.equal(f.$("application-dialog").open, true);
  f.emit("config/status", "fechado");
  assert.equal(f.$("application-fields").disabled, true);
  submit(f);
  await settle();
  assert.equal(f.calls.length, 0);
  f.emit("config/status", "aberto");
  assert.equal(f.$("application-fields").disabled, false);
  assert.equal(f.$("name").value, "Piloto");
  assert.equal(f.$("terms").checked, true);
  assert.equal(
    f.win.document.querySelectorAll("#recruit-form [name]").length,
    9,
  );
  f.close();
});
test("disconnect, missing status and invalid status fail closed and recover on reconnect", () => {
  const f = fixture();
  for (const status of [null, "invalid"]) {
    f.emit("config/status", status);
    assert.equal(f.$("submit-application").disabled, true);
    assert.equal(f.$("recruitment-status").dataset.state, "offline");
  }
  f.emit("config/status", "aberto");
  f.emit(".info/connected", false);
  assert.equal(f.$("submit-application").disabled, true);
  f.emit(".info/connected", true);
  assert.equal(f.$("submit-application").disabled, false);
  f.close();
});
test("one acknowledged write produces one receipt and remains trackable while closed", async () => {
  const f = fixture();
  fill(f);
  submit(f);
  submit(f);
  await settle();
  await settle();
  assert.equal(
    f.calls.filter((call) => call.options.method === "PUT").length,
    1,
  );
  assert.equal(f.memory.get("asw_id"), id);
  assert.equal(f.$("result-title").textContent, "FICHA RECEBIDA!");
  f.emit("config/status", "fechado");
  assert.equal(f.$("track-button").hidden, false);
  f.emit(`aplicacoes/${id}/status`, "approved");
  assert.equal(f.$("result-title").textContent, "VOCÊ FOI APROVADO!");
  f.close();
});
test("server-side close during filling preserves the draft and writes nothing", async () => {
  const f = fixture({
    requestOverride: async (path) =>
      path === "config/status" ? "fechado" : undefined,
  });
  fill(f);
  submit(f);
  await settle();
  await settle();
  assert.equal(
    f.calls.filter((call) => call.options.method === "PUT").length,
    0,
  );
  assert.equal(f.$("name").value, "Piloto");
  assert.match(f.$("form-error").textContent, /vagas/);
  f.close();
});
test("a lost write response is reconciled without creating another application", async () => {
  const f = fixture({
    requestOverride: async (path, options, { state }) => {
      if (options.method === "PUT") {
        state[`${path}/status`] = "pending";
        throw new Error("timeout");
      }
    },
  });
  fill(f);
  submit(f);
  await settle();
  await settle();
  assert.equal(
    f.calls.filter((call) => call.options.method === "PUT").length,
    1,
  );
  assert.equal(f.$("result-title").textContent, "FICHA RECEBIDA!");
  f.close();
});
test("legacy tracking keys remain available while recruitment is closed", () => {
  const f = fixture({ status: "fechado", saved: { idFichaAsphalt: id } });
  f.emit(`aplicacoes/${id}/status`, "pending");
  assert.equal(f.$("track-button").hidden, false);
  assert.equal(f.$("recruit-form").hidden, true);
  assert.equal(f.memory.get("asw_id"), id);
  f.close();
});
