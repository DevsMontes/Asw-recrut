import test from "node:test";
import assert from "node:assert/strict";
import {
  recruitmentState,
  normalizePhone,
  validateApplication,
  validApplicationId,
  localDate,
} from "../assets/shared.js";
const values = {
  nome: " Piloto ",
  discord: "piloto",
  whatsapp: "+55 (77) 98888-7777",
  idade: "18",
  horas: "15",
  rotina: "Estudos",
  horarios: "À noite",
  adm: "Primeira equipe",
  ajuda: "Não",
};
test("only an explicitly open, connected recruitment accepts new applications", () => {
  assert.equal(recruitmentState("aberto", true), "aberto");
  assert.equal(recruitmentState("fechado", true), "fechado");
  assert.equal(recruitmentState("aberto", false), "offline");
  assert.equal(recruitmentState(null, true), "checking");
  assert.equal(recruitmentState("unknown", true), "checking");
});
test("phone normalization keeps DDD 55 and strips country code only when appropriate", () => {
  assert.equal(normalizePhone("+55 (77) 98888-7777"), "77988887777");
  assert.equal(normalizePhone("55988887777"), "55988887777");
  assert.equal(normalizePhone("+55 55 98888-7777"), "55988887777");
  assert.equal(normalizePhone("javascript:alert(1)"), null);
});
test("validation handles bounds, whitespace, consent profile and numeric fields", () => {
  assert.equal(validateApplication(values).nome, "Piloto");
  for (const change of [
    { idade: 14 },
    { horas: 9 },
    { idade: 15.5 },
    { horas: 10.5 },
    { horas: 100001 },
    { nome: " " },
    { rotina: " " },
    { adm: "x".repeat(601) },
    { ajuda: "owner" },
    { whatsapp: "123" },
  ]) {
    assert.throws(() => validateApplication({ ...values, ...change }));
  }
  assert.equal(
    validateApplication({ ...values, idade: 15, horas: 10 }).idade,
    15,
  );
});
test("legacy push IDs and local decision dates are stable", () => {
  assert.equal(validApplicationId("-Ox0123456789_ABCdef"), true);
  assert.equal(validApplicationId("../config"), false);
  assert.equal(localDate(new Date(2026, 9, 24, 23, 45)), "2026-10-24");
});
