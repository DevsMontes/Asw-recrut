import { mkdir, cp, writeFile, rm } from "node:fs/promises";
const target = new URL("../dist/", import.meta.url);
await rm(target, { recursive: true, force: true });
await mkdir(target, { recursive: true });
for (const path of ["index.html", "adm.html", "logo.png", "assets"])
  await cp(new URL("../" + path, import.meta.url), new URL(path, target), {
    recursive: true,
  });
await writeFile(new URL(".nojekyll", target), "");
console.log("Celso do CPM2 preparado em dist/");
