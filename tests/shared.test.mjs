import test from "node:test";
import assert from "node:assert/strict";
import { safeImage, validatePost, MAX_IMAGE_LENGTH } from "../assets/garage.js";
import { post, image } from "./fixture.mjs";
test("image validation excludes URLs, SVG payloads and oversize content", () => {
  assert.equal(safeImage(image), true);
  for (const input of [
    "https://example.com/photo.png",
    "data:image/svg+xml;base64,PHN2Zz4=",
    null,
    "data:image/webp;base64," + "A".repeat(MAX_IMAGE_LENGTH),
  ])
    assert.equal(safeImage(input), false);
});
test("post validation trims text, enforces limits, requires photos and rejects unknown presentation options", () => {
  assert.equal(
    validatePost({ ...post, title: "  Meu carro  " }).title,
    "Meu carro",
  );
  for (const change of [
    { title: "x" },
    { description: "curta" },
    { brand: "" },
    { images: [] },
    { category: "Outro" },
    { fit: "stretch" },
    { tone: "unknown" },
    { setup: "A".repeat(101) },
  ])
    assert.throws(() => validatePost({ ...post, ...change }));
});
