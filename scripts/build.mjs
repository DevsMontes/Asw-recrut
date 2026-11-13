import { mkdir, cp, writeFile, rm, readdir, readFile } from "node:fs/promises";
const target = new URL("../dist/", import.meta.url);
await rm(target, { recursive: true, force: true });
await mkdir(target, { recursive: true });
for (const path of ["index.html", "adm.html", "logo.png", "assets", "garagem"])
  await cp(new URL("../" + path, import.meta.url), new URL(path, target), {
    recursive: true,
  });
await writeFile(new URL(".nojekyll", target), "");
// A single release version keeps cached HTML, styles and module dependencies in sync.
const version = Date.now().toString(36);
async function versionAssets(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = new URL(entry.name + (entry.isDirectory() ? "/" : ""), directory);
    if (entry.isDirectory()) await versionAssets(file);
    else if (/\.(html|js)$/.test(entry.name)) {
      let source = await readFile(file, "utf8");
      if (entry.name.endsWith(".html"))
        source = source.replace(/(assets\/[^"\s]+\.(?:css|js))"/g, `$1?v=${version}"`);
      else
        source = source.replace(/(["'])(\.{1,2}\/[^"']+\.js)\1/g, `$1$2?v=${version}$1`);
      await writeFile(file, source);
    }
  }
}
await versionAssets(target);
console.log("Celso do CPM2 preparado em dist/");
