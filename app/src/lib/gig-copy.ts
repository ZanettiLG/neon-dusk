/**
 * Diegetic outcome copy for the trampo loop (issue #140). Pure functions — one
 * deterministic string per outcome; the roll math never lives here.
 * Tone: noir sujo periférico (cyberpunk-lore skill).
 */

export type GigCopyKind = "execute" | "escape" | "wrapup";

const COPY: Record<GigCopyKind, { success: string; failure: string }> = {
  execute: {
    success: "Serviço limpo. Ninguém viu nada — ou ninguém quis ver.",
    failure: "Deu ruim. O alarme gritou e você saiu vazado, com gosto de cobre na boca.",
  },
  escape: {
    success:
      "A fuga saiu redonda. Você sumiu entre os becos antes de qualquer gambé aparecer.",
    failure:
      "A milícia te pegou no caminho. Você escapou ralado — a sorte segura mais um dia, a vergonha cobra o resto.",
  },
  wrapup: {
    success:
      'Cupim conta a grana, ri alto e te dá um tapa nas costas. "Boa. Volta amanhã que tem mais."',
    failure: 'Cupim te encara torto, desconta o prejuízo e cospe no chão. "Vacilou. Não repete."',
  },
};

/**
 * Returns the diegetic outcome line for a trampo stage: execution roll, escape
 * roll or the wrap-up payout meeting with Cupim.
 */
export function gigCopy(kind: GigCopyKind, success: boolean): string {
  return success ? COPY[kind].success : COPY[kind].failure;
}
