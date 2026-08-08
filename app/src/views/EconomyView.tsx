import { useEffect, useState } from "react";
import type { EconomyBalanceResponse, TransactionRecord, TransactionListResponse } from "@neon-dusk/shared";
import { api } from "@/api/client";

/**
 * Economy dashboard — wallet balance and transaction history.
 */
export default function EconomyView() {
  const [balance, setBalance] = useState<EconomyBalanceResponse | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(true);
  const [balanceError, setBalanceError] = useState<string | null>(null);

  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [txLoading, setTxLoading] = useState(true);
  const [txError, setTxError] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadBalance() {
      setBalanceLoading(true);
      setBalanceError(null);
      try {
        const data = await api.get<EconomyBalanceResponse>("/api/economy/balance");
        if (!cancelled) setBalance(data);
      } catch (e) {
        if (!cancelled) setBalanceError(e instanceof Error ? e.message : "Falha ao carregar saldo");
      } finally {
        if (!cancelled) setBalanceLoading(false);
      }
    }

    async function loadTransactions() {
      setTxLoading(true);
      setTxError(null);
      try {
        const res = await api.get<TransactionListResponse>("/api/economy/transactions");
        if (!cancelled) {
          setTransactions(res.transactions);
          setNextCursor(res.nextCursor);
        }
      } catch (e) {
        if (!cancelled) setTxError(e instanceof Error ? e.message : "Falha ao carregar transações");
      } finally {
        if (!cancelled) setTxLoading(false);
      }
    }

    void loadBalance();
    void loadTransactions();
    return () => { cancelled = true; };
  }, []);

  function formatEds(amount: number): string {
    return `${amount.toLocaleString("pt-BR")} eds`;
  }

  return (
    <div className="py-8 space-y-6">
      <h2 className="font-heading text-2xl text-nd-cyan tracking-widest">ECONOMIA</h2>

      {/* Balance card */}
      {balanceLoading ? (
        <div className="card">
          <span className="text-nd-text-secondary animate-pulse-neon font-data">▌ loading...</span>
        </div>
      ) : balanceError ? (
        <p className="text-nd-magenta text-sm font-data">{balanceError}</p>
      ) : balance ? (
        <div className="card border-nd-gold/30 shadow-neon-gold">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-nd-text-secondary text-xs font-data uppercase tracking-widest">Saldo</p>
              <p className="font-heading text-3xl text-nd-gold">{formatEds(balance.balance)}</p>
            </div>
            <div>
              <p className="text-nd-text-secondary text-xs font-data uppercase tracking-widest">Escrow</p>
              <p className="font-heading text-3xl text-nd-text">{formatEds(balance.escrow)}</p>
            </div>
            <div>
              <p className="text-nd-text-secondary text-xs font-data uppercase tracking-widest">
                Disponível
              </p>
              <p className="font-heading text-3xl text-nd-cyan">
                {formatEds(balance.balance - balance.escrow)}
              </p>
            </div>
          </div>
          <div className="flex justify-center gap-6 mt-4 text-xs font-data">
            <span className="text-nd-green">
              +{formatEds(balance.lifetimeEarned)} ganhos
            </span>
            <span className="text-nd-magenta">
              -{formatEds(balance.lifetimeSpent)} gastos
            </span>
          </div>
        </div>
      ) : null}

      {/* Transactions */}
      <h3 className="font-heading text-lg text-nd-cyan tracking-widest">Transações</h3>
      {txLoading ? (
        <span className="text-nd-text-secondary animate-pulse-neon font-data">▌ loading...</span>
      ) : txError ? (
        <p className="text-nd-magenta text-sm font-data">{txError}</p>
      ) : transactions.length === 0 ? (
        <p className="text-nd-text-secondary text-sm font-data">Nenhuma transação registrada.</p>
      ) : (
        <div className="space-y-2">
          {transactions.map((tx: TransactionRecord) => (
            <div key={tx.id} className="card border-nd-cyan/20 flex items-center justify-between gap-3">
              <div className="text-xs font-data">
                <span className="text-nd-cyan uppercase">{tx.type}</span>
                <span className="text-nd-text-secondary ml-2">{tx.source}</span>
                <span className="text-nd-text-secondary ml-3">
                  {new Date(tx.createdAt).toLocaleDateString("pt-BR")}
                </span>
              </div>
              <div className="text-xs font-data">
                <span className={tx.amount >= 0 ? "text-nd-green" : "text-nd-magenta"}>
                  {tx.amount >= 0 ? "+" : ""}{tx.amount} eds
                </span>
              </div>
            </div>
          ))}
          {nextCursor && (
            <p className="text-nd-text-secondary text-xs font-data text-center">Mais transações...</p>
          )}
        </div>
      )}
    </div>
  );
}
