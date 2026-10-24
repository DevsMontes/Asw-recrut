import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { JSDOM } from "jsdom";
import * as shared from "../assets/shared.js";
const html = await readFile(new URL("../adm.html", import.meta.url), "utf8");
const source = (
  await readFile(new URL("../assets/admin.js", import.meta.url), "utf8")
).replace(
  /^import[\s\S]*?from ["']\.\/shared\.js["'];\r?\n/,
  "const { $, ADMIN_UID, initFirebase, localDate, formatTimestamp, node, normalizePhone } = window.__shared;\n",
);
const settle = () => new Promise((resolve) => setImmediate(resolve));
const id = "-Ox0123456789_ABCdef";
function fixture({ fetchOverride } = {}) {
  const dom = new JSDOM(html, {
      url: "https://example.test/adm.html",
      runScripts: "outside-only",
    }),
    win = dom.window;
  const listeners = new Map(),
    calls = [];
  const record = {
    nome: "<img src=x onerror=alert(1)>",
    discord: "pilot",
    whatsapp: "5577988887777",
    idade: 18,
    horas: 15,
    rotina: "Trabalho",
    horarios: "Noite",
    adm: "Primeira",
    ajuda: "Não",
    status: "pending",
    timestamp: 123,
  };
  const state = {
    ".info/connected": true,
    config: { status: "fechado" },
    aplicacoes: { [id]: record },
  };
  let authCallback;
  const auth = {
    currentUser: {
      uid: shared.ADMIN_UID,
      getIdToken: async () => "test-token",
    },
    onAuthStateChanged: (callback) => {
      authCallback = callback;
      callback(auth.currentUser);
    },
    signOut: async () => {
      auth.currentUser = null;
      authCallback(null);
    },
  };
  const database = {
    ref: (path) => ({
      on: (event, callback) => {
        listeners.set(path, callback);
        callback({ val: () => state[path] });
        return callback;
      },
      off: () => listeners.delete(path),
      toString: () => `https://example.test/db/${path}`,
    }),
  };
  const emit = (path, value) => {
    state[path] = value;
    listeners.get(path)?.({ val: () => value });
  };
  win.firebase = { auth: () => auth };
  win.fetch = async (url, options = {}) => {
    calls.push({ url, options });
    return fetchOverride
      ? fetchOverride(url, options)
      : new Response(JSON.stringify(record), {
          status: 200,
          headers: { ETag: "version-1" },
        });
  };
  win.Response = Response;
  win.AbortSignal = AbortSignal;
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
    node: (tag, cls, text) => {
      const el = win.document.createElement(tag);
      if (cls) el.className = cls;
      if (text != null) el.textContent = String(text);
      return el;
    },
  };
  win.eval(source);
  return {
    win,
    calls,
    listeners,
    auth,
    emit,
    $: (key) => win.document.getElementById(key),
    close: () => win.close(),
  };
}
test("candidate content is rendered as text and personal data is cleared on logout", async () => {
  const f = fixture();
  assert.equal(
    f.win.document.querySelectorAll(".application-card img").length,
    0,
  );
  assert.match(f.$("applications").textContent, /<img/);
  assert.equal(f.$("count-pending").textContent, "1");
  f.$("logout").click();
  await settle();
  assert.equal(f.$("admin-section").hidden, true);
  assert.doesNotMatch(f.$("applications").textContent, /<img/);
  assert.equal(f.listeners.size, 0);
  f.close();
});
test("status success is shown only after server acknowledgement; failures restore the synced value", async () => {
  const f = fixture({
    fetchOverride: async () => new Response("{}", { status: 403 }),
  });
  f.$("recruitment-select").value = "aberto";
  f.$("recruitment-select").dispatchEvent(new f.win.Event("change"));
  f.$("save-status").click();
  await settle();
  await settle();
  assert.equal(f.$("recruitment-select").value, "fechado");
  assert.match(f.$("save-feedback").textContent, /Não foi possível confirmar/);
  f.close();
});
test("decisions use ETag preconditions and reject a concurrent response", async () => {
  const f = fixture({
    fetchOverride: async (url, options) =>
      options.method === "PUT"
        ? new Response("{}", { status: 412 })
        : new Response(JSON.stringify({ status: "pending" }), {
            headers: { ETag: "version-1" },
          }),
  });
  f.win.document.querySelector(".candidate-actions button").click();
  f.$("confirm-decision").click();
  await settle();
  await settle();
  assert.equal(f.calls[1].options.headers["If-Match"], "version-1");
  assert.match(f.$("decision-error").textContent, /outra sessão/);
  assert.equal(f.$("decision-dialog").open, true);
  f.close();
});
test("offline staff cannot change recruitment or decide candidates", () => {
  const f = fixture();
  f.emit(".info/connected", false);
  assert.equal(f.$("recruitment-select").disabled, true);
  assert.equal(f.$("save-status").disabled, true);
  assert.equal(
    f.win.document.querySelector(".candidate-actions button").disabled,
    true,
  );
  f.close();
});
