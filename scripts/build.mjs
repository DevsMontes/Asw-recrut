import { mkdir, cp, writeFile } from "node:fs/promises";
const target = new URL("../dist/", import.meta.url);
await mkdir(target, { recursive: true });
for (const path of [
  "index.html",
  "adm.html",
  "logo.png",
  "fundo.png",
  "assets",
])
  await cp(new URL(`../${path}`, import.meta.url), new URL(path, target), {
    recursive: true,
  });
await writeFile(new URL(".nojekyll", target), "");
console.log("Public site prepared in dist/");
