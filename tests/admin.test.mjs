import test from "node:test";
import assert from "node:assert/strict";
import { fixture, settle, post } from "./fixture.mjs";
test("unauthorized users cannot see editor and are signed out", async () => {
  const f = await fixture("adm.html", { uid: "intruder" });
  assert.equal(f.$("admin-section").hidden, true);
  assert.equal(f.auth.currentUser, null);
  assert.equal(f.calls.length, 0);
  f.dom.window.close();
});
test("editing preserves server version and publishes validated data with conditional request", async () => {
  const f = await fixture("adm.html");
  f.$("admin-posts").querySelector("button").click();
  await settle();
  assert.equal(f.$("title").value, post.title);
  f.$("title").value = "Projeto atualizado";
  f.$("post-form").dispatchEvent(
    new f.win.Event("submit", { cancelable: true }),
  );
  await settle();
  const put = f.calls.find((c) => c.options.method === "PUT");
  assert.ok(put);
  assert.equal(put.options.headers["If-Match"], '"v1"');
  const body = JSON.parse(put.options.body);
  assert.equal(body.title, "Projeto atualizado");
  assert.equal(body.createdAt, 100);
  assert.equal(body.updatedAt[".sv"], "timestamp");
  assert.match(f.$("save-feedback").textContent, /publicada/);
  f.dom.window.close();
});
test("failed publishing preserves form and reports no success", async () => {
  const f = await fixture("adm.html");
  f.$("admin-posts").querySelector("button").click();
  await settle();
  f.win.fetch = async () => new Response("{}", { status: 412 });
  f.$("post-form").dispatchEvent(
    new f.win.Event("submit", { cancelable: true }),
  );
  await settle();
  assert.equal(f.$("title").value, post.title);
  assert.match(f.$("save-feedback").textContent, /outra sessão/);
  assert.equal(f.$("editor-fields").disabled, false);
  f.dom.window.close();
});
test("invalid images are rejected and removal requires dialog confirmation", async () => {
  const f = await fixture("adm.html");
  assert.throws(() =>
    f.win.__garage.validatePost({ ...post, images: ["javascript:alert(1)"] }),
  );
  assert.throws(() =>
    f.win.__garage.validatePost({
      ...post,
      images: Array(5).fill(post.images[0]),
    }),
  );
  const buttons = f.$("admin-posts").querySelectorAll("button");
  buttons[1].click();
  assert.ok(f.$("delete-dialog").open);
  assert.equal(
    f.calls.some((c) => c.options.method === "DELETE"),
    false,
  );
  f.$("cancel-delete").click();
  assert.equal(
    f.calls.some((c) => c.options.method === "DELETE"),
    false,
  );
  f.dom.window.close();
});
