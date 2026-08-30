import { useEffect, useRef, useState } from "react";
import type { TherapyResponse, TherapyType } from "@neon-dusk/shared";
import { useHumanityStore } from "@/stores/humanity";
import { useHudStore } from "@/stores/hud";
import ConsumablesPanel from "@/components/humanity/ConsumablesPanel";
import HumanityBar from "@/components/humanity/HumanityBar";
import TherapyPanel from "@/components/humanity/TherapyPanel";

/**
 * Humanity view (issue #28) — cyberpsychosis dashboard: band readout,
 * scrubber regen status, flatline warning and the therapy panel. Embedded as
 * the "Humanidade" tab in ChromeView and reachable at /humanity.
 */
export default function HumanityView() {
  const mountedRef = useRef(true);
  const info = useHumanityStore((s) => s.info);
  const loading = useHumanityStore((s) => s.loading);
  const error = useHumanityStore((s) => s.error);
  const fetch = useHumanityStore((s) => s.fetch);
  const undergoTherapy = useHumanityStore((s) => s.undergoTherapy);

  const [therapyError, setTherapyError] = useState<string | null>(null);
  const [therapySuccess, setTherapySuccess] = useState<string | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    void fetch();
    return () => {
      mountedRef.current = false;
    };
  }, [fetch]);

  async function onTherapy(therapyType: TherapyType): Promise<TherapyResponse> {
    setTherapyError(null);
    setTherapySuccess(null);
    try {
      const result = await undergoTherapy(therapyType);
      if (mountedRef.current) {
        setTherapySuccess(
          `Sessão concluída: -G$ ${result.cost}, +${result.restored} de humanidade.`,
        );
      }
      // Grana e humanidade mudaram — mantém a HUD em dia.
      void useHudStore.getState().refresh();
      return result;
    } catch (e) {
      if (mountedRef.current) {
        setTherapyError(e instanceof Error ? e.message : "Falha na terapia");
      }
      throw e;
    }
  }

  return (
    <div className="py-8 space-y-6">
      <h2 className="font-heading text-2xl text-nd-cyan tracking-widest">HUMANIDADE</h2>
      <p className="text-nd-text-secondary text-sm font-data max-w-prose">
        Cromo te dá poder. Cromo te tira humanidade. A pergunta não é "quanto você aguenta?". É
        "quanto de você sobra no final?".
      </p>

      {therapySuccess && <p className="text-nd-green text-sm font-data">{therapySuccess}</p>}
      {therapyError && <p className="text-nd-magenta text-sm font-data">{therapyError}</p>}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        <HumanityBar info={info} loading={loading} error={error} onRetry={() => void fetch()} />
        <TherapyPanel info={info} loading={loading} error={error} onTherapy={onTherapy} />
      </div>

      {/* Itens anti-insanidade (issue #48): consumíveis compráveis que restauram
          humanidade — painel auto-contido, largura total abaixo do grid. */}
      <ConsumablesPanel info={info} />
    </div>
  );
}
