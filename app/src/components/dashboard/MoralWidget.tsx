import { useEffect } from "react";
import { useAuthStore } from "@/stores/auth";
import { useStreetCredStore } from "@/stores/street-cred";
import { MetricBar, Panel, StatusBadge } from "@/components/ui";
import type { Tone } from "@/components/ui";

/**
 * Moral dashboard widget: live street-cred readout (score bar + title badge +
 * next threshold). Falls back to the character snapshot (`character.streetCred`)
 * when the live readout is unavailable — the widget never breaks the panel.
 */
export default function MoralWidget() {
  const character = useAuthStore((s) => s.character);
  const info = useStreetCredStore((s) => s.info);
  const loading = useStreetCredStore((s) => s.loading);
  const error = useStreetCredStore((s) => s.error);
  const fetchSC = useStreetCredStore((s) => s.fetchSC);

  useEffect(() => {
    // Fetch once: skip when a readout exists, a fetch is in flight, or a
    // previous attempt failed (the widget stays on the static fallback then).
    if (character && info == null && !loading && !error) void fetchSC();
  }, [character, info, loading, error, fetchSC]);

  const live = info != null;
  const score = info?.score ?? character?.streetCred ?? 0;
  // Gold badge while climbing toward the next title; neutral at Lenda (topo).
  const badgeTone: Tone = info?.nextThreshold ? "gold" : "neutral";

  return (
    <Panel title="MORAL" status={!live && loading ? "loading" : "default"}>
      <div className="space-y-3">
        <MetricBar resource="streetCred" value={score} max={100} label="Moral" />
        {live ? (
          <>
            <StatusBadge tone={badgeTone} label={info?.title ?? "—"} />
            <p className="font-data text-xs text-nd-text-secondary">
              {info?.nextThreshold
                ? `Próximo: ${info.nextThreshold.title} (+${info.scToNext ?? 0})`
                : "Nada acima. Você é a lenda."}
            </p>
          </>
        ) : (
          <p className="font-data text-xs text-nd-text-secondary">
            {error
              ? "Dados ao vivo indisponíveis — exibindo valor do perfil."
              : "Moral indisponível."}
          </p>
        )}
      </div>
    </Panel>
  );
}
