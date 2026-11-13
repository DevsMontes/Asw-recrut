import { $, node, firebaseConfig, ADMIN_UID } from "./shared.js";
import { summarizeAnalytics, analyticsDay } from "./analytics.js";
let auth,
  sequence = 0;
let titles = {};
window.addEventListener("garage-records", (event) => {
  titles = event.detail;
  document
    .querySelectorAll("[data-analytics-car]")
    .forEach(
      (el) =>
        (el.textContent =
          titles[el.dataset.analyticsCar] || "Exposição removida"),
    );
});
async function load() {
  const seq = ++sequence;
  if (auth?.currentUser?.uid !== ADMIN_UID) return;
  const days = Number($("analytics-period").value);
  $("analytics-status").textContent = "Atualizando as visitas registradas…";
  try {
    const token = await auth.currentUser.getIdToken();
    const start = new Date();
    start.setUTCDate(start.getUTCDate() - days + 1);
    const params = new URLSearchParams({
      auth: token,
      orderBy: JSON.stringify("$key"),
      startAt: JSON.stringify(analyticsDay(start)),
    });
    const response = await fetch(
      `${firebaseConfig.databaseURL}/analytics.json?${params}`,
      { signal: AbortSignal.timeout(15000), cache: "no-store" },
    );
    if (!response.ok) throw Error();
    const data = await response.json();
    if (seq !== sequence || auth.currentUser?.uid !== ADMIN_UID) return;
    const stats = summarizeAnalytics(data, days);
    $("analytics-cards").replaceChildren();
    for (const [key, label, note] of [
      ["visit", "Visitas registradas", "Uma por navegador por dia"],
      ["garage", "Visitas à garagem", "Navegadores que abriram a coleção"],
      ["car", "Aberturas de carros", "Uma vez por carro, navegador e dia"],
      ["instagram", "Cliques no Instagram", "Navegadores que tocaram no link"],
    ]) {
      const card = node("article", "metric");
      card.append(
        node("span", "", label),
        node("strong", "", stats[key].toLocaleString("pt-BR")),
        node("small", "", note),
      );
      $("analytics-cards").append(card);
    }
    $("analytics-chart").replaceChildren();
    const max = Math.max(1, ...Object.values(stats.daily));
    for (const [day, value] of Object.entries(stats.daily)) {
      const bar = node("div", "chart-column");
      const label = day.slice(8) + "/" + day.slice(5, 7);
      bar.title = `${label}: ${value} visitas`;
      bar.setAttribute("aria-label", bar.title);
      const fill = node("span", "chart-bar");
      fill.style.height = `${Math.max(2, (value / max) * 100)}%`;
      bar.append(
        node("small", "", String(value)),
        fill,
        node("span", "chart-date", label),
      );
      $("analytics-chart").append(bar);
    }
    $("analytics-rate").textContent =
      `${stats.rate}% das visitas registradas abriram um carro ou tocaram no Instagram.`;
    $("analytics-top").replaceChildren();
    const top = Object.entries(stats.top)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    if (top.length) {
      if (seq !== sequence) return;
      for (const [id, value] of top) {
        const li = node("li");
        const name = node("span", "", titles[id] || "Exposição removida");
        name.dataset.analyticsCar = id;
        li.append(name, node("strong", "", String(value)));
        $("analytics-top").append(li);
      }
    } else
      $("analytics-top").append(
        node("li", "muted", "As primeiras interações aparecerão aqui."),
      );
    $("analytics-status").textContent = stats.visit
      ? "Atualizado agora · contagem diária por navegador."
      : "Ainda não há visitas registradas neste período.";
  } catch {
    if (seq === sequence) {
      $("analytics-status").textContent =
        "Não foi possível atualizar as visitas registradas. Você pode continuar publicando normalmente.";
    }
  }
}
$("analytics-period").onchange = load;
try {
  if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
  auth = firebase.auth();
  auth.onAuthStateChanged((user) => {
    sequence++;
    if (user?.uid === ADMIN_UID) load();
    else {
      for (const id of ["analytics-cards", "analytics-chart", "analytics-top"])
        $(id).replaceChildren();
      $("analytics-rate").textContent = "";
    }
  });
} catch {
  $("analytics-status").textContent =
    "Estatísticas indisponíveis nesta sessão.";
}
