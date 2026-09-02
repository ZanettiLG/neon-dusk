import { useEffect, useMemo, useState } from "react";
import type { MetroMapResponse, Origin, VendorRecord } from "@neon-dusk/shared";
import { api } from "@/api/client";
import { useAuthStore } from "@/stores/auth";
import { useMetroStore } from "@/stores/metro";
import DistrictBanner from "@/components/DistrictBanner";
import MetroMap from "@/components/MetroMap";
import MetroCrossing from "@/components/MetroCrossing";
import { originFromDistrictString } from "@/lib/district-meta";

/**
 * Metro map view — diegetic travel between the seven districts of São Paulo
 * 2087. Vendors and the district map payload (trampos, calor, território)
 * are fetched in parallel and grouped per district to badge the stations.
 */
export default function MetroView() {
  const character = useAuthStore((s) => s.character);
  const currentDistrict = useMetroStore((s) => s.currentDistrict);
  const traveling = useMetroStore((s) => s.traveling);
  const init = useMetroStore((s) => s.init);
  const travelTo = useMetroStore((s) => s.travelTo);
  const cancelTravel = useMetroStore((s) => s.cancelTravel);

  const [vendors, setVendors] = useState<VendorRecord[]>([]);
  const [metro, setMetro] = useState<MetroMapResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [destination, setDestination] = useState<Origin | null>(null);

  // Seed the current district from the character origin on mount and cancel
  // any pending crossing when the view unmounts (timer never fires off-screen).
  useEffect(() => {
    init();
    return () => cancelTravel();
  }, [init, cancelTravel]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [vendorData, metroData] = await Promise.all([
          api.get<VendorRecord[]>("/api/vendors"),
          api.get<MetroMapResponse>("/api/metro"),
        ]);
        if (!cancelled) {
          setVendors(vendorData);
          setMetro(metroData);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Falha ao carregar o mapa");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const vendorsByDistrict = useMemo(() => {
    const counts: Partial<Record<Origin, number>> = {};
    for (const vendor of vendors) {
      const key = originFromDistrictString(vendor.district);
      if (key) counts[key] = (counts[key] ?? 0) + 1;
    }
    return counts;
  }, [vendors]);

  // Issue #18: the server already aggregates per canonical origin — no client
  // normalization needed, the districts array is keyed by origin as-is.
  const gigsByDistrict = useMemo(() => {
    const counts: Partial<Record<Origin, number>> = {};
    for (const district of metro?.districts ?? []) {
      if (district.gigsAvailable > 0) counts[district.origin] = district.gigsAvailable;
    }
    return counts;
  }, [metro]);

  const heatByDistrict = useMemo(() => {
    const heats: Partial<Record<Origin, number>> = {};
    for (const district of metro?.districts ?? []) {
      if (district.heat > 0) heats[district.origin] = district.heat;
    }
    return heats;
  }, [metro]);

  const territoryByDistrict = useMemo(() => {
    const territories: Partial<Record<Origin, string>> = {};
    for (const district of metro?.districts ?? []) {
      if (district.territoryCrewTag) territories[district.origin] = district.territoryCrewTag;
    }
    return territories;
  }, [metro]);

  // The overlay clears when the crossing completes (traveling flips back).
  useEffect(() => {
    if (!traveling) setDestination(null);
  }, [traveling]);

  function handleSelect(origin: Origin): void {
    if (traveling) return;
    setDestination(origin);
    travelTo(origin);
  }

  return (
    <div className="py-8 space-y-6">
      <DistrictBanner district={currentDistrict ?? undefined} />

      <div>
        <h2 className="font-heading text-2xl text-nd-cyan tracking-widest">
          METRÔ <span className="text-nd-text-secondary">// SÃO PAULO 2087</span>
        </h2>
        <p className="text-nd-text-secondary text-sm mt-1">
          Sete distritos. Duas linhas. A cidade inteira no bolso do paletó.
        </p>
      </div>

      {loading ? (
        <span className="text-nd-text-secondary animate-pulse-neon font-data">
          ▌ carregando mapa...
        </span>
      ) : error ? (
        <div className="card space-y-3">
          <p className="font-data text-sm text-nd-magenta">✗ {error}</p>
          <button
            type="button"
            className="btn-neon text-xs"
            onClick={() => setReloadKey((key) => key + 1)}
          >
            Tentar de novo
          </button>
        </div>
      ) : (
        <MetroMap
          currentDistrict={currentDistrict}
          originDistrict={character?.origin ?? null}
          vendorsByDistrict={vendorsByDistrict}
          gigsByDistrict={gigsByDistrict}
          heatByDistrict={heatByDistrict}
          territoryByDistrict={territoryByDistrict}
          traveling={traveling}
          onSelect={handleSelect}
        />
      )}

      {traveling && destination && <MetroCrossing destination={destination} />}
    </div>
  );
}
