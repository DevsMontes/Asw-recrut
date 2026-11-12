import { $, node } from "./shared.js";
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
  showCar(post, $("car-detail"));
  dialog.showModal();
  document.body.style.overflow = "hidden";
}
dialog.addEventListener("close", () => (document.body.style.overflow = ""));
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
document.querySelectorAll("[data-pose]").forEach(
  (b) =>
    (b.onclick = () => {
      $("art-view").style.backgroundPosition =
        `${(Number(b.dataset.pose) * 100) / 3}% center`;
      $("stage-label").textContent =
        `ARTE ORIGINAL / ${b.getAttribute("aria-label") || b.textContent}`;
      document
        .querySelectorAll("[data-pose]")
        .forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    }),
);
let model,
  loading = false;
function switchView(is3D) {
  $("art-view").hidden = is3D;
  $("art-controls").hidden = is3D;
  $("model-view").hidden = !is3D;
  $("model-controls").hidden = !is3D;
  $("view-art").setAttribute("aria-pressed", String(!is3D));
  $("view-3d").setAttribute("aria-pressed", String(is3D));
  $("stage-label").textContent = is3D
    ? "VERSÃO 3D ESTILIZADA / ARRASTE PARA GIRAR"
    : "ARTE ORIGINAL / EXPLORE AS VISTAS";
  model?.setVisible(is3D);
}
$("view-art").onclick = () => switchView(false);
$("view-3d").onclick = async () => {
  switchView(true);
  if (model || loading) return;
  loading = true;
  try {
    const { createCharacterViewer } = await import("./character.js");
    model = createCharacterViewer($("model-canvas"));
    $("model-status").hidden = true;
    model.setVisible(!$("model-view").hidden);
  } catch {
    $("model-status").textContent =
      "O 3D não está disponível neste dispositivo. Você pode explorar as quatro vistas na arte original.";
    $("model-controls").hidden = true;
  } finally {
    loading = false;
  }
};
$("rotate-left").onclick = () => model?.rotate(-0.35);
$("rotate-right").onclick = () => model?.rotate(0.35);
$("reset-view").onclick = () => {
  model?.reset();
  $("rotate-auto").setAttribute("aria-pressed", "false");
};
$("rotate-auto").onclick = () => {
  if (!model) return;
  const active = $("rotate-auto").getAttribute("aria-pressed") !== "true";
  model.auto(active);
  $("rotate-auto").setAttribute("aria-pressed", String(active));
};
