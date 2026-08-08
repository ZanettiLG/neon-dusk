import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import type { VendorWithInventory, VendorInventoryRecord } from "@neon-dusk/shared";
import { api } from "@/api/client";
import { VENDOR_TYPE_LABELS } from "@/lib/labels";

/**
 * Single vendor detail page — info header plus buyable inventory table.
 */
export default function VendorDetailView() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<VendorWithInventory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [buyMsg, setBuyMsg] = useState<string | null>(null);
  const [buyError, setBuyError] = useState<string | null>(null);
  const [buyLoading, setBuyLoading] = useState(false);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const result = await api.get<VendorWithInventory>(`/api/vendors/${id}`);
        if (!cancelled) setData(result);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Falha ao carregar vendedor");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [id]);

  async function onBuy(itemType: string, itemId: string) {
    if (!id) return;
    setBuyLoading(true);
    setBuyError(null);
    setBuyMsg(null);
    try {
      await api.post(`/api/vendors/${id}/buy`, { itemType, itemId, quantity: 1 });
      setBuyMsg("Compra realizada!");
      // Refresh inventory
      const fresh = await api.get<VendorWithInventory>(`/api/vendors/${id}`);
      setData(fresh);
    } catch (e) {
      setBuyError(e instanceof Error ? e.message : "Falha na compra");
    } finally {
      setBuyLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="py-8">
        <span className="text-nd-text-secondary animate-pulse-neon font-data">▌ loading...</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="py-8 space-y-4">
        <p className="text-nd-magenta text-sm font-data">{error ?? "Vendedor não encontrado."}</p>
        <Link to="/vendors" className="text-nd-cyan font-data text-xs hover:underline">← Voltar</Link>
      </div>
    );
  }

  const { vendor, inventory } = data;

  return (
    <div className="py-8 space-y-6">
      <Link to="/vendors" className="text-nd-cyan font-data text-xs hover:underline">← Vendedores</Link>

      {/* Vendor header */}
      <div className="card border-nd-cyan/20">
        <span className="font-data text-[10px] uppercase tracking-widest text-nd-cyan bg-nd-cyan/10 rounded-terminal px-2 py-0.5">
          {VENDOR_TYPE_LABELS[vendor.type] ?? vendor.type}
        </span>
        <h2 className="font-heading text-2xl text-nd-gold mt-2">{vendor.name}</h2>
        <p className="text-nd-text-secondary text-sm font-data mt-1">{vendor.district}</p>
        {vendor.description && <p className="text-nd-text text-sm mt-2">{vendor.description}</p>}
      </div>

      {buyMsg && <p className="text-nd-green text-sm font-data">{buyMsg}</p>}
      {buyError && <p className="text-nd-magenta text-sm font-data">{buyError}</p>}

      {/* Inventory */}
      <h3 className="font-heading text-lg text-nd-cyan tracking-widest">Estoque</h3>
      {inventory.length === 0 ? (
        <p className="text-nd-text-secondary text-sm font-data">Estoque vazio.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left font-data text-sm">
            <thead>
              <tr className="border-b border-nd-cyan/20 text-nd-text-secondary text-xs uppercase tracking-widest">
                <th className="py-2 pr-4">Tipo</th>
                <th className="py-2 pr-4">ID</th>
                <th className="py-2 pr-4">Preço</th>
                <th className="py-2 pr-4">Estoque</th>
                <th className="py-2"></th>
              </tr>
            </thead>
            <tbody>
              {inventory.map((item: VendorInventoryRecord) => (
                <tr key={item.id} className="border-b border-nd-cyan/10">
                  <td className="py-2 pr-4 text-nd-cyan">{item.itemType}</td>
                  <td className="py-2 pr-4 text-nd-text">{item.itemId}</td>
                  <td className="py-2 pr-4 text-nd-gold">{item.price} eds</td>
                  <td className="py-2 pr-4 text-nd-text-secondary">
                    {item.stock === -1 ? "∞" : item.stock}
                  </td>
                  <td className="py-2">
                    <button
                      className="btn-neon text-xs px-3 py-1"
                      disabled={buyLoading || item.stock === 0}
                      onClick={() => void onBuy(item.itemType, item.itemId)}
                    >
                      Comprar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
