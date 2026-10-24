import {
  $,
  ADMIN_UID,
  initFirebase,
  localDate,
  formatTimestamp,
  node,
  normalizePhone,
} from "./shared.js";

let database,
  auth,
  connected = false,
  saving = false,
  dataReady = false,
  configReady = false;
let config = {},
  records = [],
  activeFilter = "pending",
  cleanups = [],
  decision = null,
  deciding = false;
const select = $("recruitment-select");
function listen(reference, callback, onError) {
  const handler = reference.on("value", callback, onError);
  cleanups.push(() => reference.off("value", handler));
}
function cleanup() {
  cleanups.forEach((stop) => stop());
  cleanups = [];
  records = [];
  dataReady = false;
  configReady = false;
  config = {};
  connected = false;
  decision = null;
  $("decision-dialog").close();
  $("decision-description").textContent = "";
  $("applications").replaceChildren(
    node("p", "empty-state", "Carregando fichas…"),
  );
  for (const key of ["pending", "approved", "rejected"])
    $(`count-${key}`).textContent = "—";
}
function renderControl() {
  const valid = config.status === "aberto" || config.status === "fechado";
  $("connection-label").textContent = connected
    ? "Conectado ao Firebase"
    : "Sem conexão · alterações bloqueadas";
  $("connection-label").parentElement.dataset.connected = String(connected);
  $("control-title").textContent = !configReady
    ? "Consultando recrutamento…"
    : config.status === "aberto"
      ? "Recrutamento aberto"
      : config.status === "fechado"
        ? "Recrutamento fechado"
        : "Recrutamento não configurado";
  $("control-description").textContent =
    config.status === "aberto"
      ? "Novos candidatos podem enviar suas fichas pelo portal."
      : "Novas inscrições estão bloqueadas. Fichas já enviadas continuam disponíveis para análise.";
  select.disabled = !connected || saving || !configReady;
  $("save-status").disabled =
    !connected ||
    saving ||
    !configReady ||
    !["aberto", "fechado"].includes(select.value) ||
    (valid && select.value === config.status);
  $("save-status").textContent = saving
    ? "Salvando no banco…"
    : "Salvar alteração ↗";
  $("status-updated").textContent = config.updatedAt
    ? `Última alteração: ${formatTimestamp(config.updatedAt)}`
    : "Status sincronizado com o portal público.";
}
select.addEventListener("change", () => {
  $("save-feedback").textContent = "";
  renderControl();
});
$("save-status").addEventListener("click", async () => {
  if (!connected || saving || !["aberto", "fechado"].includes(select.value))
    return;
  const desired = select.value;
  saving = true;
  $("save-feedback").textContent = "Aguardando confirmação do Firebase…";
  renderControl();
  // A disconnected SDK write can be queued. REST makes a failed connection explicit.
  try {
    const token = await auth.currentUser.getIdToken();
    const response = await fetch(
      `${database.ref("config").toString()}.json?auth=${encodeURIComponent(token)}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: desired,
          updatedAt: { ".sv": "timestamp" },
          updatedBy: auth.currentUser.uid,
        }),
        signal: AbortSignal.timeout(15000),
      },
    );
    if (!response.ok) throw new Error("save");
    config = { ...config, ...(await response.json()) };
    select.value = config.status;
    $("save-feedback").textContent =
      desired === "aberto"
        ? "Salvo no banco. O portal está recebendo inscrições."
        : "Salvo no banco. Novas inscrições estão bloqueadas.";
  } catch {
    select.value = config.status || "";
    $("save-feedback").textContent =
      "Não foi possível confirmar a alteração. Consulte o status sincronizado antes de tentar novamente.";
  } finally {
    saving = false;
    renderControl();
  }
});

function renderRecords() {
  for (const status of ["pending", "approved", "rejected"])
    $(`count-${status}`).textContent = records.filter(
      (record) => record.status === status,
    ).length;
  const search = $("search").value.trim().toLocaleLowerCase("pt-BR");
  const date = $("decision-date").value;
  const shown = records.filter(
    (record) =>
      (activeFilter === "all" || record.status === activeFilter) &&
      (!search ||
        `${record.nome || ""} ${record.discord || ""}`
          .toLocaleLowerCase("pt-BR")
          .includes(search)) &&
      (!date || record.dataDecisao === date),
  );
  $("record-count").textContent =
    `${shown.length} de ${records.length} inscrições`;
  const container = $("applications");
  container.replaceChildren();
  if (!shown.length)
    container.append(
      node(
        "p",
        "empty-state",
        dataReady
          ? "Nenhuma ficha encontrada para estes filtros."
          : "Carregando fichas…",
      ),
    );
  shown.forEach((record) => container.append(card(record)));
}
function card(record) {
  const article = node("article", "application-card");
  const heading = node("div", "candidate-heading");
  const badge = node(
    "span",
    "status-badge",
    { pending: "Em análise", approved: "Aprovado", rejected: "Recusado" }[
      record.status
    ] || "Sem status",
  );
  badge.dataset.status = record.status;
  heading.append(node("h3", "", record.nome || "Candidato"), badge);
  article.append(heading);
  article.append(node("p", "candidate-id", `Protocolo: ${record.id}`));
  const info = node("dl", "candidate-info");
  for (const [label, value, full] of [
    ["Discord", record.discord],
    ["WhatsApp", record.whatsapp],
    ["Idade", `${record.idade ?? "—"} anos`],
    ["CPM2", `${record.horas ?? "—"} horas`],
    ["Rotina", record.rotina, true],
    ["Disponibilidade", record.horarios, true],
    ["Equipes anteriores", record.adm, true],
    ["Quer ajudar na organização?", record.ajuda, true],
  ]) {
    const group = node("div", full ? "full" : "");
    group.append(
      node("dt", "", label),
      node("dd", "", value || "Não informado"),
    );
    info.append(group);
  }
  article.append(info);
  const actions = node("div", "candidate-actions");
  if (record.status === "pending") {
    for (const [status, label, className] of [
      ["approved", "Aprovar ↗", "button"],
      ["rejected", "Recusar", "button secondary reject"],
    ]) {
      const button = node("button", className, label);
      button.disabled = !connected;
      button.addEventListener("click", () => openDecision(record, status));
      actions.append(button);
    }
  }
  const phone = normalizePhone(record.whatsapp);
  if (phone) {
    const link = node("a", "button secondary", "WhatsApp ↗");
    link.href = `https://wa.me/55${phone}`;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    actions.append(link);
  }
  article.append(actions);
  article.append(
    node(
      "p",
      "decision-meta",
      record.decidedAt
        ? `Decisão: ${formatTimestamp(record.decidedAt)}`
        : typeof record.dataDecisao === "string"
          ? `Decisão: ${record.dataDecisao.split("-").reverse().join("/")}`
          : `Enviada em: ${formatTimestamp(record.timestamp)}`,
    ),
  );
  return article;
}
document.querySelectorAll("[data-filter]").forEach((button) =>
  button.addEventListener("click", () => {
    activeFilter = button.dataset.filter;
    document
      .querySelectorAll("[data-filter]")
      .forEach((item) =>
        item.setAttribute("aria-pressed", String(item === button)),
      );
    renderRecords();
  }),
);
$("search").addEventListener("input", renderRecords);
$("decision-date").addEventListener("change", renderRecords);
function openDecision(record, status) {
  if (!connected || deciding) return;
  decision = { id: record.id, status };
  $("decision-error").textContent = "";
  $("decision-title").textContent =
    status === "approved" ? "APROVAR CANDIDATO?" : "RECUSAR CANDIDATO?";
  $("decision-description").textContent =
    `Confirme a decisão para ${record.nome || "este candidato"}. O resultado ficará disponível imediatamente para o candidato.`;
  $("confirm-decision").textContent =
    status === "approved" ? "Confirmar aprovação" : "Confirmar recusa";
  $("decision-dialog").showModal();
}
function closeDecision() {
  if (!deciding) $("decision-dialog").close();
}
$("close-decision").addEventListener("click", closeDecision);
$("cancel-decision").addEventListener("click", closeDecision);
$("decision-dialog").addEventListener("cancel", (event) => {
  if (deciding) event.preventDefault();
});
$("confirm-decision").addEventListener("click", async () => {
  if (!decision || deciding || !connected) return;
  deciding = true;
  for (const id of ["confirm-decision", "cancel-decision", "close-decision"])
    $(id).disabled = true;
  try {
    // ETag + If-Match prevents two staff tabs from silently overwriting a decision.
    const token = await auth.currentUser.getIdToken();
    const url = `${database.ref(`aplicacoes/${decision.id}`).toString()}.json?auth=${encodeURIComponent(token)}`;
    const existing = await fetch(url, {
      headers: { "X-Firebase-ETag": "true" },
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
    if (!existing.ok) throw new Error("read");
    const record = await existing.json();
    if (!record || record.status !== "pending")
      throw new Error("already-decided");
    const response = await fetch(url, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "If-Match": existing.headers.get("ETag"),
      },
      body: JSON.stringify({
        ...record,
        status: decision.status,
        dataDecisao: localDate(),
        decidedAt: { ".sv": "timestamp" },
        decidedBy: auth.currentUser.uid,
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (response.status === 412) throw new Error("already-decided");
    if (!response.ok) throw new Error("save");
    $("decision-dialog").close();
  } catch (error) {
    $("decision-error").textContent =
      error.message === "already-decided"
        ? "Esta ficha já foi respondida em outra sessão. Feche esta janela e confira o resultado atualizado."
        : "Não foi possível confirmar a decisão. Confira a conexão e o resultado atualizado antes de tentar novamente.";
  } finally {
    deciding = false;
    for (const id of ["confirm-decision", "cancel-decision", "close-decision"])
      $(id).disabled = false;
  }
});
$("login-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  $("login-error").textContent = "";
  $("login-submit").disabled = true;
  try {
    await auth.signInWithEmailAndPassword(
      $("email").value.trim(),
      $("password").value,
    );
    $("password").value = "";
  } catch {
    $("login-error").textContent =
      "Não foi possível entrar. Confira o e-mail, a senha e sua conexão.";
  } finally {
    $("login-submit").disabled = false;
  }
});
$("reset-password").addEventListener("click", async () => {
  if (!$("email").reportValidity()) return;
  $("reset-password").disabled = true;
  try {
    auth.languageCode = "pt-BR";
    await auth.sendPasswordResetEmail($("email").value.trim());
    $("reset-feedback").textContent =
      "Se este e-mail estiver cadastrado, você receberá um link de redefinição. Confira também o spam.";
  } catch {
    $("reset-feedback").textContent =
      "Não foi possível solicitar o link agora. Tente novamente mais tarde.";
  } finally {
    $("reset-password").disabled = false;
  }
});
$("logout").addEventListener("click", () =>
  auth.signOut().catch(() => {
    $("data-error").textContent = "Não foi possível sair. Tente novamente.";
  }),
);

try {
  database = initFirebase();
  auth = firebase.auth();
  auth.onAuthStateChanged(async (user) => {
    cleanup();
    const allowed = user?.uid === ADMIN_UID;
    $("login-section").hidden = allowed;
    $("admin-section").hidden = !allowed;
    $("logout").hidden = !user;
    if (!allowed) {
      if (user) {
        $("login-error").textContent =
          "Esta conta não possui acesso à administração.";
        await auth.signOut();
      }
      return;
    }
    $("data-error").textContent = "";
    $("save-feedback").textContent = "";
    listen(database.ref(".info/connected"), (snapshot) => {
      connected = snapshot.val() === true;
      renderControl();
      if (dataReady) renderRecords();
    });
    listen(
      database.ref("config"),
      (snapshot) => {
        config = snapshot.val() || {};
        configReady = true;
        if (!saving) select.value = config.status || "";
        renderControl();
      },
      () => {
        configReady = false;
        $("save-feedback").textContent =
          "Sem permissão para consultar a configuração.";
        renderControl();
      },
    );
    listen(
      database.ref("aplicacoes"),
      (snapshot) => {
        records = Object.entries(snapshot.val() || {})
          .map(([id, value]) => ({ ...value, id }))
          .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        dataReady = true;
        $("data-error").textContent = "";
        renderRecords();
      },
      () => {
        records = [];
        dataReady = false;
        renderRecords();
        $("data-error").textContent =
          "Não foi possível carregar as fichas. Verifique a conexão e as permissões do banco.";
      },
    );
    renderControl();
  });
} catch {
  $("login-error").textContent =
    "Não foi possível carregar o Firebase. Recarregue a página.";
  $("login-submit").disabled = true;
  $("reset-password").disabled = true;
}
