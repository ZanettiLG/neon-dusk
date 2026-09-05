import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { familySeed } from "../src/seeds.mjs";

// Issue #199 — deterministic family seeds: the same (familyId, memberId) pair
// must always map to the same integer in [0, 2^31), so family generations are
// reproducible without storing seed state anywhere.
const MEMBERS = Array.from({ length: 12 }, (_, i) => `cromo-${String(i + 1).padStart(2, "0")}`);

describe("seeds", () => {
  it("should be deterministic (same call twice → same value)", () => {
    assert.equal(familySeed("itens-cromo", "cromo-01"), familySeed("itens-cromo", "cromo-01"));
    assert.equal(
      familySeed("cenas-distritos", "babilonia"),
      familySeed("cenas-distritos", "babilonia"),
    );
  });

  it("should give distinct seeds to distinct members (itens-cromo)", () => {
    const seeds = MEMBERS.map((memberId) => familySeed("itens-cromo", memberId));
    assert.equal(new Set(seeds).size, MEMBERS.length);
  });

  it("should stay in [0, 2^31) — same range as the plain-mode random picker", () => {
    for (const memberId of MEMBERS) {
      const seed = familySeed("itens-cromo", memberId);
      assert.ok(Number.isInteger(seed), `seed de ${memberId} deve ser inteiro`);
      assert.ok(seed >= 0 && seed < 2 ** 31, `seed de ${memberId} fora do range: ${seed}`);
    }
  });

  it("should pin the FNV-1a reference vector (algorithm drift guard)", () => {
    assert.equal(familySeed("itens-cromo", "cromo-01"), 801015425);
  });
});
