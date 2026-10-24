export const firebaseConfig = {
  apiKey: "AIzaSyDl5sbPsFkRCHht0_cFJv3OLTqzx1nlPqg",
  authDomain: "recrutamento-asw.firebaseapp.com",
  databaseURL: "https://recrutamento-asw-default-rtdb.firebaseio.com",
  projectId: "recrutamento-asw",
  storageBucket: "recrutamento-asw.firebasestorage.app",
  messagingSenderId: "1036486404644",
  appId: "1:1036486404644:web:02a9a23e69ef0b91b906b1",
};
// This identifies the existing staff account, not a credential. Rules enforce access.
export const ADMIN_UID = "HZ2txmi9fPVzDKvt5f5OomAi1B42";
export const STATUS = {
  checking: [
    "Consultando recrutamento",
    "Aguarde a confirmação do status da equipe.",
  ],
  aberto: [
    "Recrutamento aberto",
    "Sua próxima volta começa aqui. Envie sua ficha para a diretoria.",
  ],
  fechado: [
    "Recrutamento fechado",
    "Novas inscrições estão pausadas. Fichas enviadas continuam em análise.",
  ],
  offline: [
    "Status indisponível",
    "Não foi possível confirmar as vagas. Verifique sua conexão e tente novamente.",
  ],
};
export const $ = (id) => document.getElementById(id);
export function initFirebase() {
  if (!window.firebase) throw new Error("Firebase indisponível");
  if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
  return firebase.database();
}
export function recruitmentState(status, connected) {
  if (!connected) return "offline";
  return status === "aberto" || status === "fechado" ? status : "checking";
}
export function validApplicationId(id) {
  return typeof id === "string" && /^[-A-Za-z0-9_]{20}$/.test(id);
}
export function normalizePhone(value) {
  let digits = String(value || "").replace(/\D/g, "");
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith("55"))
    digits = digits.slice(2);
  return /^[1-9]{2}[0-9]{8,9}$/.test(digits) ? digits : null;
}
export function validateApplication(values) {
  const output = {};
  for (const [key, min, max] of [
    ["nome", 2, 80],
    ["discord", 1, 80],
    ["rotina", 1, 300],
    ["horarios", 1, 300],
    ["adm", 1, 600],
  ]) {
    const value = String(values[key] || "").trim();
    if (value.length < min || value.length > max)
      throw new Error(
        "Preencha os campos de texto e respeite os limites indicados.",
      );
    output[key] = value;
  }
  output.whatsapp = normalizePhone(values.whatsapp);
  if (!output.whatsapp)
    throw new Error("Informe um WhatsApp válido com DDD (10 ou 11 dígitos).");
  output.idade = Number(values.idade);
  output.horas = Number(values.horas);
  if (
    !Number.isInteger(output.idade) ||
    output.idade < 15 ||
    output.idade > 100
  )
    throw new Error("A idade deve estar entre 15 e 100 anos.");
  if (
    !Number.isInteger(output.horas) ||
    output.horas < 10 ||
    output.horas > 100000
  )
    throw new Error("Informe pelo menos 10 horas inteiras de CPM2.");
  if (!["Sim", "Não"].includes(values.ajuda))
    throw new Error("Selecione como deseja participar.");
  output.ajuda = values.ajuda;
  return output;
}
export function storage() {
  const memory = new Map();
  return {
    get(key) {
      try {
        return localStorage.getItem(key) ?? memory.get(key) ?? null;
      } catch {
        return memory.get(key) ?? null;
      }
    },
    set(key, value) {
      memory.set(key, value);
      try {
        localStorage.setItem(key, value);
      } catch {}
    },
    remove(key) {
      memory.delete(key);
      try {
        localStorage.removeItem(key);
      } catch {}
    },
  };
}
export async function databaseRequest(path, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(`${firebaseConfig.databaseURL}/${path}.json`, {
      ...options,
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok)
      throw new Error(
        response.status === 401 || response.status === 403
          ? "permission-denied"
          : "request-failed",
      );
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}
export function localDate(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export function formatTimestamp(timestamp) {
  return typeof timestamp === "number"
    ? new Date(timestamp).toLocaleString("pt-BR")
    : "Data não registrada";
}
export function node(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text != null) el.textContent = String(text);
  return el;
}
