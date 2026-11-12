import { $ } from "./shared.js";
import { bindTracking } from "./analytics.js";
bindTracking();
let model,
  loading = false;
async function loadModel() {
  if (model || loading) return;
  loading = true;
  try {
    const { createCharacterViewer } = await import("./character.js");
    model = createCharacterViewer($("model-canvas"));
    $("model-status").hidden = true;
  } catch {
    $("model-status").textContent =
      "Seu dispositivo não conseguiu abrir o personagem 3D. Tente um navegador com suporte a WebGL.";
    $("model-controls").hidden = true;
  } finally {
    loading = false;
  }
}
const observer = new IntersectionObserver(
  (entries) => {
    if (entries.some((e) => e.isIntersecting)) {
      loadModel();
      observer.disconnect();
    }
  },
  { rootMargin: "200px" },
);
observer.observe($("model-canvas"));
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
