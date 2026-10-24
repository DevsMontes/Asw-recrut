import {
  $,
  STATUS,
  initFirebase,
  recruitmentState,
  validApplicationId,
  validateApplication,
  storage,
  databaseRequest,
} from "./shared.js";

const saved = storage();
const dialog = $("application-dialog");
const form = $("recruit-form");
let database,
  connected = false,
  configKnown = false,
  remoteStatus = null;
let everConnected = false,
  connectionTimedOut = false;
let submitting = false,
  currentId = null,
  currentResult = null,
  stopResult = () => {};
let attemptId = saved.get("asw_attempt");
if (!validApplicationId(attemptId)) attemptId = null;

function state() {
  if (!connected && !everConnected && !connectionTimedOut) return "checking";
  if (connected && !configKnown) return "checking";
  if (configKnown && !remoteStatus) return "offline";
  return recruitmentState(remoteStatus, connected);
}
function render() {
  const current = state();
  const [label, description] = STATUS[current];
  $("recruitment-status").dataset.state = current;
  $("status-label").textContent = label;
  $("status-description").textContent = description;
  document.querySelectorAll("[data-apply]").forEach((button) => {
    button.disabled = current !== "aberto";
    button.textContent =
      current === "aberto"
        ? "Quero fazer parte ↗"
        : current === "fechado"
          ? "Vagas pausadas"
          : current === "checking"
            ? "Verificando vagas…"
            : "Aguardando conexão";
  });
  $("track-button").hidden = !currentId;
  $("recruit-form").hidden = !!currentId;
  $("application-result").hidden = !currentId;
  $("dialog-description").hidden = !!currentId;
  $("application-fields").disabled =
    current !== "aberto" || submitting || !!currentId;
  $("submit-application").disabled =
    current !== "aberto" || submitting || !!currentId;
  $("submit-application").textContent = submitting
    ? "Confirmando envio…"
    : "Enviar minha inscrição ↗";
  $("form-status").hidden =
    !!currentId || (current === "aberto" && !submitting);
  $("form-status").textContent = submitting
    ? "Aguarde a confirmação do banco. Sua ficha só será considerada enviada após essa confirmação."
    : description;
  if (currentId) renderResult();
}
function openDialog() {
  render();
  if (!dialog.open) dialog.showModal();
}
function renderResult() {
  const results = {
    pending: [
      "◎",
      "FICHA RECEBIDA!",
      "Sua inscrição está com a diretoria. Você pode fechar esta janela e acompanhar a resposta neste mesmo navegador.",
    ],
    approved: [
      "✓",
      "VOCÊ FOI APROVADO!",
      "Bem-vindo à próxima etapa. Fale com a equipe para receber o convite oficial e as orientações de entrada.",
    ],
    rejected: [
      "↗",
      "ANÁLISE CONCLUÍDA",
      "Sua inscrição não foi aprovada desta vez. Fale com a equipe se quiser mais informações sobre o resultado.",
    ],
    missing: [
      "?",
      "FICHA NÃO ENCONTRADA",
      "Não localizamos esta inscrição no banco. Fale com a equipe e informe o protocolo abaixo.",
    ],
    loading: [
      "◎",
      "CONSULTANDO SUA FICHA",
      "Aguarde enquanto confirmamos o resultado com a equipe.",
    ],
    error: [
      "⌁",
      "CONSULTA INDISPONÍVEL",
      "Não foi possível consultar a ficha agora. Verifique sua conexão e tente novamente.",
    ],
  };
  const key = !connected ? "error" : currentResult || "loading";
  const result = results[key] || results.error;
  $("result-icon").textContent = result[0];
  $("result-title").textContent = result[1];
  $("result-description").textContent = result[2];
  $("receipt").textContent = `Protocolo: ${currentId}`;
  const link = $("result-link");
  const message = `Olá! Gostaria de falar sobre minha inscrição na Asphalt Wolves. Protocolo: ${currentId}`;
  link.href = `https://wa.me/5577988773155?text=${encodeURIComponent(message)}`;
  link.textContent =
    key === "approved"
      ? "Receber orientações de entrada ↗"
      : "Falar com a equipe ↗";
}
function track(id) {
  stopResult();
  currentId = id;
  currentResult = null;
  saved.set("asw_id", id);
  const reference = database.ref(`aplicacoes/${id}/status`);
  const listener = reference.on(
    "value",
    (snapshot) => {
      currentResult = snapshot.val() || "missing";
      saved.set(
        "asw_status",
        currentResult === "pending" ? "aguardando" : currentResult,
      );
      render();
    },
    () => {
      currentResult = "error";
      render();
    },
  );
  stopResult = () => reference.off("value", listener);
  render();
}

document
  .querySelectorAll("[data-apply]")
  .forEach((button) => button.addEventListener("click", openDialog));
$("track-button").addEventListener("click", () => {
  if (currentId) track(currentId);
  openDialog();
});
$("close-dialog").addEventListener("click", () => dialog.close());
dialog.addEventListener("click", (event) => {
  const box = dialog.getBoundingClientRect();
  if (
    event.target === dialog &&
    (event.clientX < box.left ||
      event.clientX > box.right ||
      event.clientY < box.top ||
      event.clientY > box.bottom)
  )
    dialog.close();
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (submitting || currentId) return;
  $("form-error").textContent = "";
  if (state() !== "aberto") {
    render();
    return;
  }
  if (!form.reportValidity()) return;
  let values;
  try {
    values = validateApplication(Object.fromEntries(new FormData(form)));
  } catch (error) {
    $("form-error").textContent = error.message;
    return;
  }
  submitting = true;
  render();
  const id = attemptId || database.ref("aplicacoes").push().key;
  attemptId = id;
  saved.set("asw_attempt", id);
  try {
    // Reuse the same ID after a timeout: an acknowledged write must not become a duplicate.
    const existing = await databaseRequest(`aplicacoes/${id}/status`);
    if (!existing) {
      const freshStatus = await databaseRequest("config/status");
      remoteStatus = freshStatus;
      configKnown = true;
      if (freshStatus !== "aberto") throw new Error("closed");
      // REST has a bounded timeout and no offline write queue. Rules check the status atomically.
      await databaseRequest(`aplicacoes/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...values,
          id,
          status: "pending",
          timestamp: { ".sv": "timestamp" },
          consent: true,
        }),
      });
    }
    saved.remove("asw_attempt");
    attemptId = null;
    track(id);
    form.reset();
  } catch (error) {
    // An aborted response may have reached the server. Resolve that before allowing a retry.
    let existing = null;
    try {
      existing = await databaseRequest(`aplicacoes/${id}/status`);
    } catch {}
    if (existing) {
      saved.remove("asw_attempt");
      attemptId = null;
      track(id);
      form.reset();
    } else {
      $("form-error").textContent =
        error.message === "closed" || error.message === "permission-denied"
          ? "O envio não foi autorizado. As vagas podem ter sido fechadas durante o preenchimento. Seus campos foram preservados."
          : "Não conseguimos confirmar o envio. Seus campos foram preservados. Ao tentar novamente, usaremos o mesmo protocolo para evitar duplicidade.";
    }
  } finally {
    submitting = false;
    render();
  }
});

try {
  database = initFirebase();
  const connectionRef = database.ref(".info/connected");
  connectionRef.on("value", (snapshot) => {
    connected = snapshot.val() === true;
    everConnected ||= connected;
    render();
  });
  database.ref("config/status").on(
    "value",
    (snapshot) => {
      configKnown = true;
      remoteStatus = ["aberto", "fechado"].includes(snapshot.val())
        ? snapshot.val()
        : null;
      render();
    },
    () => {
      configKnown = true;
      remoteStatus = null;
      render();
    },
  );
  // The two old versions used different keys; preserve existing applicants without reading their personal data.
  const previous = saved.get("asw_id") || saved.get("idFichaAsphalt");
  if (validApplicationId(previous)) track(previous);
  else if (attemptId) {
    databaseRequest(`aplicacoes/${attemptId}/status`)
      .then((result) => {
        if (result) {
          const id = attemptId;
          saved.remove("asw_attempt");
          attemptId = null;
          track(id);
        }
      })
      .catch(() => {});
  }
} catch {
  connectionTimedOut = true;
  $("form-error").textContent =
    "Não foi possível carregar o serviço de inscrições. Recarregue a página ou fale com a equipe.";
}
setTimeout(() => {
  connectionTimedOut = true;
  render();
}, 8000);
render();
