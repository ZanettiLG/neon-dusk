import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  ITEM_ID_LABELS,
  ITEM_TYPE_LABELS,
  ROLE_LABELS,
  VENDOR_TYPE_LABELS,
  ORIGIN_LABELS,
} from "@/lib/labels";
import { DISTRICT_GLYPHS } from "@/lib/district-meta";

// Labels user-facing da marca (#145): nomes de IP de terceiros (Cyberpunk RED)
// substituídos por marca própria PT-BR. Tokens internos (enum lowercase) não
// são cobertos aqui — o guard check-terminologia cuida das strings de código.
// Nota: termos banidos NÃO aparecem como literais aqui — o guard varre app/src
// e qualquer literal banido quebraria o CI. A ausência deles é coberta por
// construção: os valores de marca esperados abaixo não contêm nenhum.

describe("VENDOR_TYPE_LABELS", () => {
  it('should map RIPPERDOC to "Ferrageiro"', () => {
    expect(VENDOR_TYPE_LABELS.RIPPERDOC).toBe("Ferrageiro");
  });

  it('should map FIXER to "Despachante"', () => {
    expect(VENDOR_TYPE_LABELS.FIXER).toBe("Despachante");
  });
});

describe("ROLE_LABELS", () => {
  it('should map despachante to "Despachante"', () => {
    expect(ROLE_LABELS.despachante).toBe("Despachante");
  });

  it("should use brand labels for every role (no banned third-party terms)", () => {
    expect(ROLE_LABELS).toEqual({
      bicho: "Bicho",
      vulto: "Vulto",
      gambiarrista: "Gambiarrista",
      despachante: "Despachante",
      estradeiro: "Estradeiro",
    });
  });
});

describe("ITEM_TYPE_LABELS", () => {
  it('should map LOOT to "Saque"', () => {
    expect(ITEM_TYPE_LABELS.LOOT).toBe("Saque");
  });
});

describe("ITEM_ID_LABELS", () => {
  it('should map the combat ampola item id to "Porrada"', () => {
    expect(ITEM_ID_LABELS["combat-stim"]).toBe("Porrada");
  });

  it('should map access-chip to "Chip Frio"', () => {
    expect(ITEM_ID_LABELS["access-chip"]).toBe("Chip Frio");
  });
});

// Curadoria (#7): os 7 distritos são canônicos em 02-mundo-e-universo.md
// (§Distritos). Parseia o doc — drift de naming no mapa local quebra o teste
// em vez de passar silenciosamente (mesmo padrão do icons.test.ts, que valida
// contra docs/design/asset-manifest.json). Path resolvido de import.meta.url,
// nunca process.cwd().
const DOC_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../docs/definicoes-de-produto/02-mundo-e-universo.md",
);
const distritosSection =
  readFileSync(DOC_PATH, "utf8")
    .split("## ")
    .find((s) => s.startsWith("Distritos")) ?? "";
const canonicalDistricts = [...distritosSection.matchAll(/^\| \*\*([^*]+)\*\* \|/gm)].map(
  (m) => m[1],
);

describe("ORIGIN_LABELS (curadoria)", () => {
  it("should match the 7 canonical district names from 02-mundo-e-universo.md", () => {
    expect(canonicalDistricts).toHaveLength(7);
    expect(Object.values(ORIGIN_LABELS)).toEqual(canonicalDistricts);
  });

  it("should give every canonical district a two-letter glyph", () => {
    expect(Object.keys(DISTRICT_GLYPHS).sort()).toEqual(Object.keys(ORIGIN_LABELS).sort());
  });
});
