import { before, after, beforeEach, test } from "node:test";
import { readFile } from "node:fs/promises";
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} from "@firebase/rules-unit-testing";
import { ref, set, get, update, serverTimestamp } from "firebase/database";
import { ADMIN_UID } from "../assets/shared.js";
let env, publicDB, adminDB, otherDB;
const id = "-Ox0123456789_ABCdef";
const application = () => ({
  id,
  nome: "Piloto Teste",
  discord: "piloto",
  whatsapp: "77988887777",
  idade: 18,
  horas: 15,
  rotina: "Trabalho",
  horarios: "À noite",
  adm: "Primeira equipe\nQuero participar",
  ajuda: "Não",
  status: "pending",
  timestamp: serverTimestamp(),
  consent: true,
});
before(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-asw",
    database: {
      host: "127.0.0.1",
      port: 9000,
      rules: await readFile(
        new URL("../database.rules.json", import.meta.url),
        "utf8",
      ),
    },
  });
  publicDB = env.unauthenticatedContext().database();
  adminDB = env.authenticatedContext(ADMIN_UID).database();
  otherDB = env.authenticatedContext("outro-usuario").database();
});
after(async () => env?.cleanup());
beforeEach(async () => {
  await env.clearDatabase();
  await env.withSecurityRulesDisabled((context) =>
    set(ref(context.database(), "config"), { status: "aberto" }),
  );
});
test("public can read recruitment status; only existing admin can change it", async () => {
  await assertSucceeds(get(ref(publicDB, "config/status")));
  await assertFails(set(ref(publicDB, "config/status"), "fechado"));
  await assertFails(
    update(ref(otherDB, "config"), {
      status: "fechado",
      updatedAt: serverTimestamp(),
      updatedBy: "outro-usuario",
    }),
  );
  await assertSucceeds(
    update(ref(adminDB, "config"), {
      status: "fechado",
      updatedAt: serverTimestamp(),
      updatedBy: ADMIN_UID,
    }),
  );
  await assertFails(
    update(ref(adminDB, "config"), {
      status: "invalid",
      updatedAt: serverTimestamp(),
      updatedBy: ADMIN_UID,
    }),
  );
});
test("valid application can be created while open; only its result is public", async () => {
  await assertSucceeds(set(ref(publicDB, `aplicacoes/${id}`), application()));
  await assertSucceeds(get(ref(publicDB, `aplicacoes/${id}/status`)));
  await assertFails(get(ref(publicDB, `aplicacoes/${id}`)));
  await assertFails(get(ref(publicDB, "aplicacoes")));
  await assertFails(get(ref(otherDB, "aplicacoes")));
  await assertSucceeds(get(ref(adminDB, "aplicacoes")));
});
test("closing recruitment blocks writes from stale forms and direct API calls", async () => {
  await set(ref(adminDB, "config"), {
    status: "fechado",
    updatedAt: serverTimestamp(),
    updatedBy: ADMIN_UID,
  });
  await assertFails(set(ref(publicDB, `aplicacoes/${id}`), application()));
  await set(ref(adminDB, "config"), {
    status: "aberto",
    updatedAt: serverTimestamp(),
    updatedBy: ADMIN_UID,
  });
  await assertSucceeds(set(ref(publicDB, `aplicacoes/${id}`), application()));
});
test("missing configuration is closed by default", async () => {
  await env.withSecurityRulesDisabled((context) =>
    set(ref(context.database(), "config"), null),
  );
  await assertFails(set(ref(publicDB, `aplicacoes/${id}`), application()));
});
test("visitors cannot forge approvals, rewrite or delete a submitted application", async () => {
  await set(ref(publicDB, `aplicacoes/${id}`), application());
  await assertFails(
    update(ref(publicDB, `aplicacoes/${id}`), { status: "approved" }),
  );
  await assertFails(set(ref(publicDB, `aplicacoes/${id}`), application()));
  await assertFails(set(ref(publicDB, `aplicacoes/${id}`), null));
  await assertFails(
    update(ref(otherDB, `aplicacoes/${id}`), {
      status: "approved",
      dataDecisao: "2026-10-24",
      decidedAt: serverTimestamp(),
      decidedBy: "outro-usuario",
    }),
  );
});
test("server rejects malformed and incomplete applications", async () => {
  for (const change of [
    { idade: 14 },
    { idade: 15.5 },
    { horas: 9 },
    { horas: 10.5 },
    { nome: "x" },
    { whatsapp: "123" },
    { status: "approved" },
    { consent: false },
    { id: "different-id" },
    { timestamp: 1 },
    { unexpected: "field" },
    { decidedBy: ADMIN_UID },
  ]) {
    await assertFails(
      set(ref(publicDB, `aplicacoes/${id}`), { ...application(), ...change }),
    );
  }
  const incomplete = application();
  delete incomplete.rotina;
  await assertFails(set(ref(publicDB, `aplicacoes/${id}`), incomplete));
});
test("admin can decide existing legacy records while closed without changing personal data", async () => {
  const old = application();
  delete old.consent;
  old.timestamp = 123456;
  await env.withSecurityRulesDisabled(async (context) => {
    await set(ref(context.database(), `aplicacoes/${id}`), old);
    await set(ref(context.database(), "config"), { status: "fechado" });
  });
  await assertFails(
    update(ref(adminDB, `aplicacoes/${id}`), {
      nome: "Alterado",
      status: "approved",
      dataDecisao: "2026-10-24",
      decidedAt: serverTimestamp(),
      decidedBy: ADMIN_UID,
    }),
  );
  await assertFails(
    update(ref(adminDB, `aplicacoes/${id}`), {
      nome: null,
      status: "approved",
      dataDecisao: "2026-10-24",
      decidedAt: serverTimestamp(),
      decidedBy: ADMIN_UID,
    }),
  );
  await assertSucceeds(
    update(ref(adminDB, `aplicacoes/${id}`), {
      status: "approved",
      dataDecisao: "2026-10-24",
      decidedAt: serverTimestamp(),
      decidedBy: ADMIN_UID,
    }),
  );
  await assertSucceeds(get(ref(publicDB, `aplicacoes/${id}/status`)));
  await assertFails(
    update(ref(adminDB, `aplicacoes/${id}`), {
      status: "rejected",
      dataDecisao: "2026-10-24",
      decidedAt: serverTimestamp(),
      decidedBy: ADMIN_UID,
    }),
  );
});
