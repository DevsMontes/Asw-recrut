import { $, node } from "./shared.js";
import { track, bindTracking } from "./analytics.js";
bindTracking();
track("garage");
import { readPosts, carCard, showCar } from "./garage.js";
let posts = [],
  category = "Todos",
  count = 6,
  failed = false;
function render() {
  const term = $("garage-search").value.trim().toLocaleLowerCase("pt-BR");
  const filtered = posts.filter(
    (p) =>
      (category === "Todos" || p.category === category) &&
      `${p.title} ${p.brand} ${p.description}`
        .toLocaleLowerCase("pt-BR")
        .includes(term),
  );
  $("garage-grid").replaceChildren(
    ...filtered.slice(0, count).map((p) => carCard(p, openCar)),
  );
  $("load-more").hidden = filtered.length <= count;
  $("garage-empty").hidden = posts.length > 0 || failed;
  $("garage-status").textContent = failed
    ? "Não foi possível abrir as exposições agora. Tente novamente em instantes."
    : posts.length
      ? `${filtered.length} ${filtered.length === 1 ? "exposição" : "exposições"}${!filtered.length ? " — tente outro nome ou categoria." : ""}`
      : "";
}
async function load() {
  try {
    posts = await readPosts();
    failed = false;
  } catch {
    failed = true;
  }
  render();
  const requested = new URLSearchParams(location.hash.slice(1)).get("carro");
  if (requested) {
    const p = posts.find((p) => p.id === requested);
    if (p) openCar(p);
  }
  if (failed) {
    const retry = node("button", "text-link", "Tentar novamente ↻");
    retry.onclick = () => {
      retry.disabled = true;
      load();
    };
    $("garage-status").append(document.createTextNode(" "), retry);
  }
}
load();
document.querySelectorAll("[data-category]").forEach((b) =>
  b.addEventListener("click", () => {
    category = b.dataset.category;
    count = 6;
    document
      .querySelectorAll("[data-category]")
      .forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    render();
  }),
);
$("garage-search").addEventListener("input", () => {
  count = 6;
  render();
});
$("load-more").onclick = () => {
  count += 6;
  render();
};
const dialog = $("car-dialog");
function openCar(post) {
  track("car", post.id);
  showCar(post, $("car-detail"));
  dialog.showModal();
  history.replaceState(
    null,
    "",
    `${location.pathname}#carro=${encodeURIComponent(post.id)}`,
  );
  document.body.style.overflow = "hidden";
}
dialog.addEventListener("close", () => {
  document.body.style.overflow = "";
  history.replaceState(null, "", location.pathname);
});
$("close-car").onclick = () => dialog.close();
dialog.addEventListener("click", (e) => {
  if (e.target === dialog) {
    const r = dialog.getBoundingClientRect();
    if (
      e.clientX < r.left ||
      e.clientX > r.right ||
      e.clientY < r.top ||
      e.clientY > r.bottom
    )
      dialog.close();
  }
});
