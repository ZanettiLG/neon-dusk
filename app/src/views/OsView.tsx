import OsPanel from "@/components/os/OsPanel";

/**
 * OS view (issue #28) — Operating System selection readout + activation.
 * The OS is chosen through the cromo surgery flow (operating_system slot,
 * permanent per round); this view shows the installed OS and fires the
 * daily-charge activations (Fúria 3x/dia, Surto 5x/dia, Gazuá inerte).
 * Embedded as the "OS" tab in ChromeView and reachable at /os.
 */
export default function OsView() {
  return (
    <div className="py-8 space-y-6">
      <h2 className="font-heading text-2xl text-nd-cyan tracking-widest">SISTEMA OPERACIONAL</h2>
      <p className="text-nd-text-secondary text-sm font-data max-w-prose">
        O slot de OS define seu estilo de jogo. Escolha permanente por rodada —
        troca apenas no reset. Fúria para combate, Surto para velocidade,
        Gazuá para quando o hacking chegar.
      </p>

      <OsPanel />
    </div>
  );
}