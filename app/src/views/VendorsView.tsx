import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { VendorRecord } from "@neon-dusk/shared";
import { api } from "@/api/client";
import { VENDOR_TYPE_LABELS } from "@/lib/labels";

/**
 * Vendor directory — browse ripperdocs, stim dealers, fixers, and the black market.
 */
export default function VendorsView() {
  const navigate = useNavigate();
  const [vendors, setVendors] = useState<VendorRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const data = await api.get<VendorRecord[]>("/api/vendors");
        if (!cancelled) setVendors(data);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Falha ao carregar vendedores");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="py-8 space-y-6">
      <h2 className="font-heading text-2xl text-nd-cyan tracking-widest">VENDEDORES</h2>

      {loading ? (
        <span className="text-nd-text-secondary animate-pulse-neon font-data">▌ loading...</span>
      ) : error ? (
        <p className="text-nd-magenta text-sm font-data">{error}</p>
      ) : vendors.length === 0 ? (
        <p className="text-nd-text-secondary text-sm font-data">Nenhum vendedor disponível.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {vendors.map((v) => (
            <button
              key={v.id}
              className="card border-nd-cyan/20 text-left hover:border-nd-cyan/50 transition-colors cursor-pointer"
              onClick={() => navigate(`/vendors/${v.id}`)}
            >
              <span className="font-data text-[10px] uppercase tracking-widest text-nd-cyan bg-nd-cyan/10 rounded-terminal px-2 py-0.5">
                {VENDOR_TYPE_LABELS[v.type] ?? v.type}
              </span>
              <h3 className="font-heading text-nd-gold mt-2">{v.name}</h3>
              <p className="text-nd-text-secondary text-xs font-data mt-1">{v.district}</p>
              {v.description && (
                <p className="text-nd-text text-xs mt-2 line-clamp-2">{v.description}</p>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
