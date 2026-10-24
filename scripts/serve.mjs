import http from "node:http";
import { readFile } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
const root = resolve(
  new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"),
);
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
};
http
  .createServer(async (req, res) => {
    try {
      const path = decodeURIComponent(
        new URL(req.url, "http://localhost").pathname,
      );
      const file = resolve(
        root,
        `.${path.endsWith("/") ? `${path}index.html` : path}`,
      );
      if (!file.startsWith(root + sep) || !types[extname(file)]) {
        res.writeHead(404).end();
        return;
      }
      res.setHeader("Content-Type", types[extname(file)]);
      res.setHeader("Cache-Control", "no-store");
      res.end(await readFile(file));
    } catch {
      res.writeHead(404).end("Not found");
    }
  })
  .listen(Number(process.env.PORT || 4173), "127.0.0.1", () =>
    console.log("Preview: http://127.0.0.1:4173"),
  );
