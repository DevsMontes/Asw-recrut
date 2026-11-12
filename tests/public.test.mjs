import test from "node:test";
import assert from "node:assert/strict";
import { fixture, settle, post } from "./fixture.mjs";
test("history precedes character origin and all Instagram links use the new profile", async () => {
  const f = await fixture("index.html");
  const html = f.dom.serialize();
  assert.ok(html.indexOf('id="legado"') < html.indexOf('id="historia"'));
  assert.equal(f.win.document.querySelectorAll("[data-apply]").length, 0);
  for (const a of f.win.document.querySelectorAll('a[href*="instagram"]'))
    assert.match(a.href, /instagram.com\/celsocpm2/);
  f.dom.window.close();
});
test("gallery filters, search and modal photos work; injected HTML stays text", async () => {
  const f = await fixture("index.html", {
    data: {
      one: { ...post, title: "<img src=x onerror=alert(1)>" },
      two: { ...post, title: "Clássico", category: "Clássicos" },
    },
  });
  assert.equal(f.$("garage-grid").children.length, 2);
  assert.equal(f.$("garage-grid").querySelectorAll("img").length, 2);
  f.win.document.querySelector('[data-category="Clássicos"]').click();
  assert.equal(f.$("garage-grid").children.length, 1);
  f.$("garage-grid").querySelector("button").click();
  assert.ok(f.$("car-dialog").open);
  assert.equal(
    f.$("car-detail").querySelector(".photo-nav span").textContent,
    "1 / 2",
  );
  f.$("car-detail").querySelector('[aria-label="Próxima foto"]').click();
  assert.equal(
    f.$("car-detail").querySelector(".photo-nav span").textContent,
    "2 / 2",
  );
  f.$("close-car").click();
  assert.equal(f.$("car-dialog").open, false);
  f.$("garage-search").value = "Nada";
  f.$("garage-search").dispatchEvent(new f.win.Event("input"));
  assert.match(f.$("garage-status").textContent, /0 exposições/);
  f.dom.window.close();
});
test("empty garage and failed server have different states, failed server can retry", async () => {
  const empty = await fixture("index.html", { data: null });
  assert.equal(empty.$("garage-empty").hidden, false);
  empty.dom.window.close();
  const f = await fixture("index.html", { status: 401 });
  assert.equal(f.$("garage-empty").hidden, true);
  assert.match(f.$("garage-status").textContent, /Não foi possível/);
  f.$("garage-status").querySelector("button").click();
  await settle();
  assert.equal(f.calls.length, 2);
  f.dom.window.close();
});
