import { readFile } from "node:fs/promises";
import { JSDOM } from "jsdom";
export const settle = async () => {
  for (let i = 0; i < 4; i++) await new Promise((r) => setImmediate(r));
};
export const image = "data:image/webp;base64,UklGRg==";
export const post = {
  title: "Projeto azul",
  brand: "BMW",
  description: "Uma história de teste para este carro.",
  category: "Esportivos",
  fit: "contain",
  tone: "dark",
  images: [image, image],
  year: "2020",
  power: "650 cv",
  setup: "Pista",
  createdAt: 100,
  updatedAt: 100,
  updatedBy: "HZ2txmi9fPVzDKvt5f5OomAi1B42",
};
export async function fixture(
  page,
  { data = { one: post }, status = 200, uid = post.updatedBy } = {},
) {
  const dom = new JSDOM(
      await readFile(new URL("../" + page, import.meta.url), "utf8"),
      { url: "http://localhost/", runScripts: "outside-only" },
    ),
    win = dom.window,
    calls = [];
  win.AbortSignal = AbortSignal;
  win.HTMLElement.prototype.scrollIntoView = function () {};
  win.confirm = () => true;
  win.HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  win.HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
    this.dispatchEvent(new win.Event("close"));
  };
  win.fetch = async (url, options = {}) => {
    calls.push({ url, options });
    let payload =
      options.method === "PUT"
        ? JSON.parse(options.body)
        : /garagePosts\/.+\.json/.test(url)
          ? post
          : data;
    return new Response(JSON.stringify(payload), {
      status,
      headers: { ETag: '"v1"' },
    });
  };
  let callback;
  const auth = {
    currentUser: uid ? { uid, getIdToken: async () => "test-token" } : null,
    onAuthStateChanged(fn) {
      callback = fn;
      fn(this.currentUser);
    },
    async signOut() {
      this.currentUser = null;
      callback(null);
    },
    async signInWithEmailAndPassword() {},
    async sendPasswordResetEmail() {},
  };
  win.firebase = { apps: [{}], auth: () => auth };
  const shared = (
    await readFile(new URL("../assets/shared.js", import.meta.url), "utf8")
  ).replace(/export /g, "");
  win.eval(
    `window.__shared=(()=>{${shared};return {$,node,firebaseConfig,ADMIN_UID};})()`,
  );
  const garage = (
    await readFile(new URL("../assets/garage.js", import.meta.url), "utf8")
  )
    .replace(
      /^import .*;\r?\n/m,
      "const {firebaseConfig,node}=window.__shared;\n",
    )
    .replace(/export /g, "");
  win.eval(
    `window.__garage=(()=>{${garage};return {validatePost,carCard,showCar,readPosts,MAX_IMAGE_LENGTH};})()`,
  );
  const name = page === "index.html" ? "public" : "admin";
  let src = await readFile(
    new URL(`../assets/${name}.js`, import.meta.url),
    "utf8",
  );
  src = src
    .replace(
      /^import \{([^}]+)\} from ["']\.\/shared.js["'];/m,
      "const {$1}=window.__shared;",
    )
    .replace(
      /^import \{([^}]+)\} from ["']\.\/garage.js["'];/m,
      "const {$1}=window.__garage;",
    )
    .replace(/export /g, "");
  win.eval(src);
  await settle();
  return { dom, win, calls, auth, $: (id) => win.document.getElementById(id) };
}
