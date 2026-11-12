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
const post = () => ({
  title: "Projeto azul",
  brand: "BMW",
  description: "A história deste carro de teste.",
  category: "Esportivos",
  fit: "contain",
  tone: "dark",
  images: ["data:image/webp;base64,UklGRg=="],
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
  updatedBy: ADMIN_UID,
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
  otherDB = env.authenticatedContext("intruder").database();
});
after(async () => env?.cleanup());
beforeEach(async () => env.clearDatabase());
test("only owner publishes, edits and removes; visitors can see the exhibition", async () => {
  await assertFails(set(ref(publicDB, "garagePosts/one"), post()));
  await assertFails(set(ref(otherDB, "garagePosts/one"), post()));
  await assertSucceeds(set(ref(adminDB, "garagePosts/one"), post()));
  await assertSucceeds(get(ref(publicDB, "garagePosts")));
  await assertFails(
    update(ref(publicDB, "garagePosts/one"), { title: "Hacked" }),
  );
  await assertSucceeds(
    update(ref(adminDB, "garagePosts/one"), {
      title: "Atualizado",
      updatedAt: serverTimestamp(),
    }),
  );
  await assertFails(set(ref(otherDB, "garagePosts/one"), null));
  await assertSucceeds(set(ref(adminDB, "garagePosts/one"), null));
});
test("server rejects malformed photos, extra fields, forged authors and changed creation time", async () => {
  for (const change of [
    { title: "x" },
    { description: "curta" },
    { category: "bad" },
    { fit: "bad" },
    { tone: "bad" },
    { images: ["javascript:alert(1)"] },
    { images: { 1: "data:image/webp;base64,UklGRg==" } },
    { images: Array(5).fill("data:image/webp;base64,UklGRg==") },
    { images: ["data:image/webp;base64," + "A".repeat(420000)] },
    { createdAt: 1 },
    { updatedAt: 1 },
    { updatedBy: "intruder" },
    { unexpected: "bad" },
  ])
    await assertFails(
      set(ref(adminDB, "garagePosts/one"), { ...post(), ...change }),
    );
  await set(ref(adminDB, "garagePosts/one"), post());
  await assertFails(
    update(ref(adminDB, "garagePosts/one"), {
      createdAt: 1,
      updatedAt: serverTimestamp(),
    }),
  );
});
test("recruitment stays closed even if old config says open; legacy personal data stays private", async () => {
  await env.withSecurityRulesDisabled(async (c) => {
    await set(ref(c.database(), "config"), { status: "aberto" });
    await set(ref(c.database(), "aplicacoes/old"), {
      nome: "Privado",
      status: "pending",
    });
  });
  await assertFails(
    set(ref(publicDB, "aplicacoes/new"), { nome: "Teste", status: "pending" }),
  );
  await assertFails(get(ref(publicDB, "aplicacoes")));
  await assertFails(get(ref(publicDB, "aplicacoes/old/status")));
  await assertFails(get(ref(otherDB, "aplicacoes")));
  await assertSucceeds(get(ref(adminDB, "aplicacoes")));
  await assertFails(set(ref(adminDB, "aplicacoes/old"), null));
  await assertFails(
    set(ref(adminDB, "config"), {
      status: "aberto",
      updatedAt: serverTimestamp(),
      updatedBy: ADMIN_UID,
    }),
  );
  await assertSucceeds(
    set(ref(adminDB, "config"), {
      status: "fechado",
      updatedAt: serverTimestamp(),
      updatedBy: ADMIN_UID,
    }),
  );
});
