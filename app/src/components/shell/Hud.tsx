import { useEffect } from "react";
import { useAuthStore } from "@/stores/auth";
import { useStreetCredStore } from "@/stores/street-cred";
import { useHudStore } from "@/stores/hud";
import MetricBar from "@/components/ui/MetricBar";
import { formatEds } from "@/lib/format";

/**
 * Persistent compact HUD (issue #13): NIL, Humanidade, Grana e Moral in four
 * cells. NIL comes from the auth store readout; humanity + grana from the hud
 * store; Moral from the live street-cred readout with the character snapshot
 * as fallback. Positioned by the App shell (sticky strip together with
 * TimerAlerts). Fires the three readout fetches on mount.
 */
export default function Hud() {
  const character = useAuthStore((s) => s.character);
  const nilStatus = useAuthStore((s) => s.nilStatus);
  const nilError = useAuthStore((s) => s.nilError);
  const fetchNil = useAuthStore((s) => s.fetchNil);
  const scInfo = useStreetCredStore((s) => s.info);
  const fetchSC = useStreetCredStore((s) => s.fetchSC);
  const balance = useHudStore((s) => s.balance);
  const balanceError = useHudStore((s) => s.balanceError);
  const humanity = useHudStore((s) => s.humanity);
  const humanityError = useHudStore((s) => s.humanityError);
  const refreshHud = useHudStore((s) => s.refresh);

  useEffect(() => {
    if (!character) return;
    void fetchNil();
    void fetchSC();
    void refreshHud();
  }, [character, fetchNil, fetchSC, refreshHud]);

  if (!character) return null;

  const moral = scInfo?.score ?? character.streetCred;

  return (
    <section
      aria-label="Status do personagem"
      className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-2 bg-nd-surface/95 border-b border-nd-cyan/20 px-4 py-2"
    >
      <MetricBar
        resource="nil"
        value={nilStatus?.current ?? 0}
        max={nilStatus?.max ?? 100}
        label="NIL"
        size="sm"
        status={nilStatus ? "default" : nilError ? "error" : "loading"}
      />
      <MetricBar
        resource="humanity"
        value={humanity ?? 0}
        max={100}
        label="Humanidade"
        size="sm"
        status={humanity === null ? (humanityError ? "error" : "loading") : "default"}
      />
      <div className="flex flex-col justify-between gap-1">
        <span className="text-[10px] font-data uppercase tracking-widest text-nd-text-secondary">
          Grana
        </span>
        {balanceError ? (
          <span role="alert" className="text-xs font-data text-nd-magenta">✗</span>
        ) : (
          <span className="text-xs font-data text-nd-gold">
            {balance === null ? "—" : formatEds(balance)}
          </span>
        )}
      </div>
      <MetricBar
        resource="streetCred"
        value={moral}
        max={100}
        label="Moral"
        size="sm"
      />
    </section>
  );
}
