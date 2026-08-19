import { describe, it, expect } from "vitest";
import { ROLE_LABELS, VENDOR_TYPE_LABELS } from "@/lib/labels";

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
  it('should map fixer to "Despachante"', () => {
    expect(ROLE_LABELS.fixer).toBe("Despachante");
  });

  it("should use brand labels for every role (no banned third-party terms)", () => {
    expect(ROLE_LABELS).toEqual({
      solo: "Bicho",
      netrunner: "Vulto",
      tech: "Gambiarrista",
      fixer: "Despachante",
      nomad: "Estradeiro",
    });
  });
});
