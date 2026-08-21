import { useEffect, useRef, useState } from "react";
import type { ChromeDefinition, ChromeSlot, InstalledChromeRecord, InstalledChromeResponse } from "@neon-dusk/shared";
import { api } from "@/api/client";
import { useHudStore } from "@/stores/hud";
import { CHROME_SLOT_LABELS } from "@/lib/labels";
import Tab from "@/components/ui/Tab";
import ChromeBodyMapSvg from "@/components/chrome/ChromeBodyMapSvg";
import ChromeSurgeryPanel from "@/components/chrome/ChromeSurgeryPanel";

type TabKey = "corpo" | "installed";

/**
 * Cromo implant management — two tabs: "corpo" (interactive body map + surgery
 * flow, issue #10) and "Meu Cromo" (installed loadout + uninstall).
 * Get chipped, mano. Cromo eats your humanity; spend it wisely.
 */
export default function ChromeView() {
  const mountedRef = useRef(true);
  const [tab, setTab] = useState<TabKey>("corpo");
  const [selectedSlot, setSelectedSlot] = useState<ChromeSlot | null>(null);

  // Catalog
  const [catalog, setCatalog] = useState<ChromeDefinition[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  // Installed
  const [installed, setInstalled] = useState<InstalledChromeResponse | null>(null);
  const [installedLoading, setInstalledLoading] = useState(true);
  const [installedError, setInstalledError] = useState<string | null>(null);

  // Vendors — needed so install can pick a ferrageiro
  const [vendorId, setVendorId] = useState<string | null>(null);

  // Action state
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  async function fetchCatalog() {
    setCatalogLoading(true);
    setCatalogError(null);
    try {
      const data = await api.get<ChromeDefinition[]>("/api/chrome");
      if (!mountedRef.current) return;
      setCatalog(data);
    } catch (e) {
      if (!mountedRef.current) return;
      setCatalogError(e instanceof Error ? e.message : "Falha ao carregar catálogo");
    } finally {
      if (mountedRef.current) setCatalogLoading(false);
    }
  }

  async function fetchInstalled() {
    setInstalledLoading(true);
    setInstalledError(null);
    try {
      const data = await api.get<InstalledChromeResponse>("/api/chrome/installed");
      if (!mountedRef.current) return;
      setInstalled(data);
    } catch (e) {
      if (!mountedRef.current) return;
      setInstalledError(e instanceof Error ? e.message : "Falha ao carregar cromo instalado");
    } finally {
      if (mountedRef.current) setInstalledLoading(false);
    }
  }

  useEffect(() => {
    mountedRef.current = true;
    fetchCatalog();
    fetchInstalled();
    api.get<Array<{ id: string; type: string }>>("/api/vendors")
      .then((vendors) => {
        const ripper = vendors.find((v) => v.type === "RIPPERDOC");
        if (ripper && mountedRef.current) setVendorId(ripper.id);
      })
      .catch(() => {}); // non-blocking — the panel still renders without a vendor
    return () => { mountedRef.current = false; };
  }, []);

  /** Post-surgery: reload the loadout + refresh the HUD (grana e humanidade). */
  function onSurgeryDone() {
    void fetchInstalled();
    void useHudStore.getState().refresh();
  }

  async function onUninstall(installedChromeId: string) {
    setActionLoading(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      await api.post(`/api/chrome/uninstall`, { installedChromeId });
      if (!mountedRef.current) return;
      setActionSuccess("Implante removido.");
      fetchInstalled();
      // Uninstall refunds grana and frees humanity — refresh the HUD (issue #13).
      void useHudStore.getState().refresh();
    } catch (e) {
      if (!mountedRef.current) return;
      setActionError(e instanceof Error ? e.message : "Falha ao remover");
    } finally {
      if (mountedRef.current) setActionLoading(false);
    }
  }

  return (
    <div className="py-8 space-y-6">
      <h2 className="font-heading text-2xl text-nd-cyan tracking-widest">CROMO</h2>

      <div className="flex flex-wrap items-center gap-2" role="tablist">
        <Tab state={tab === "corpo" ? "active" : "inactive"} onClick={() => setTab("corpo")}>
          Corpo
        </Tab>
        <Tab state={tab === "installed" ? "active" : "inactive"} onClick={() => setTab("installed")}>
          Meu Cromo
        </Tab>
      </div>

      {actionSuccess && <p className="text-nd-green text-sm font-data">{actionSuccess}</p>}
      {actionError && <p className="text-nd-magenta text-sm font-data">{actionError}</p>}

      {tab === "corpo" && (
        <div>
          {catalogError ? (
            <p className="text-nd-magenta text-sm font-data">{catalogError}</p>
          ) : (
            <>
              {!catalogLoading && catalog.length === 0 && (
                <p className="text-nd-text-secondary text-sm font-data mb-4">Nenhum implante disponível.</p>
              )}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                <div className="card">
                  <ChromeBodyMapSvg
                    installed={installed?.installed ?? []}
                    selectedSlot={selectedSlot}
                    onSelectSlot={setSelectedSlot}
                  />
                </div>
                <ChromeSurgeryPanel
                  key={selectedSlot ?? "none"}
                  slot={selectedSlot}
                  catalog={catalog}
                  installed={installed}
                  vendorId={vendorId}
                  loading={catalogLoading || installedLoading}
                  onSurgeryDone={onSurgeryDone}
                />
              </div>
            </>
          )}
        </div>
      )}

      {tab === "installed" && (
        <div>
          {installedLoading ? (
            <span className="text-nd-text-secondary animate-pulse-neon font-data">▌ loading...</span>
          ) : installedError ? (
            <p className="text-nd-magenta text-sm font-data">{installedError}</p>
          ) : !installed || installed.installed.length === 0 ? (
            <div className="card text-center py-10">
              <p className="text-nd-text-secondary font-data text-sm">Nenhum implante instalado. Visite um ferrageiro.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="card border-nd-cyan/20 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-data">
                <div>
                  <span className="text-nd-text-secondary">Humanidade:</span>{" "}
                  <span className="text-nd-magenta">{installed.effectiveHumanity}</span>
                </div>
                <div>
                  <span className="text-nd-text-secondary">Gasto:</span>{" "}
                  <span className="text-nd-text">{installed.humanitySpent}</span>
                </div>
                <div>
                  <span className="text-nd-text-secondary">Bônus de HP:</span>{" "}
                  <span className="text-nd-green">+{installed.hpBonus}</span>
                </div>
                <div>
                  <span className="text-nd-text-secondary">Bônus de trampo:</span>{" "}
                  <span className="text-nd-gold">+{installed.gigSuccessBonus}%</span>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {installed.installed.map((rec: InstalledChromeRecord) => (
                  <div key={rec.installedId} className="card border-nd-cyan/20">
                    <h3 className="font-heading text-nd-cyan">{rec.definition.name}</h3>
                    <p className="text-nd-text-secondary text-xs font-data mt-1">
                      Slot: {CHROME_SLOT_LABELS[rec.definition.slot] ?? rec.definition.slot}
                    </p>
                    <p className="text-nd-text-secondary text-xs font-data">
                      Instalado: {new Date(rec.installedAt).toLocaleDateString("pt-BR")}
                    </p>
                    <button
                      className="btn-danger text-xs px-3 py-1 mt-3"
                      disabled={actionLoading}
                      onClick={() => void onUninstall(rec.installedId)}
                    >
                      Remover
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
