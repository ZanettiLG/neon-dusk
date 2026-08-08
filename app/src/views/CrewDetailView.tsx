import { useEffect, useState, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { useAuthStore } from "@/stores/auth";
import { useCrewStore } from "@/stores/crew";
import type { CrewBonus } from "@neon-dusk/shared";

/**
 * Single crew detail page — header, bonuses, members, leader actions, and crew chat.
 */
export default function CrewDetailView() {
  const { id } = useParams<{ id: string }>();
  const character = useAuthStore((s) => s.character);

  const {
    crewDetail,
    detailLoading,
    detailError,
    messages,
    chatStatus,
    chatSendLoading,
    chatSendError,
    fetchCrewDetail,
    inviteMember,
    joinCrew,
    leaveCrew,
    kickMember,
    dissolveCrew,
    sendMessage,
    connectChat,
    disconnectChat,
    fetchChatHistory,
  } = useCrewStore();

  const [inviteId, setInviteId] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [chatInput, setChatInput] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!id) return;
    void fetchCrewDetail(id);
    void fetchChatHistory(id);
    connectChat(id);
    return () => disconnectChat();
  }, [id, fetchCrewDetail, fetchChatHistory, connectChat, disconnectChat]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (detailLoading) {
    return (
      <div className="py-8">
        <span className="text-nd-text-secondary animate-pulse-neon font-data">▌ loading...</span>
      </div>
    );
  }

  if (detailError || !crewDetail) {
    return (
      <div className="py-8 space-y-4">
        <p className="text-nd-magenta text-sm font-data">{detailError ?? "Crew não encontrada."}</p>
        <Link to="/crews" className="text-nd-cyan font-data text-xs hover:underline">← Voltar</Link>
      </div>
    );
  }

  const { crew, members, bonuses } = crewDetail;
  const isLeader = character?.id === crew.leaderId;
  const isMember = members.some((m) => m.characterId === character?.id);

  async function onInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!id) return;
    setActionError(null);
    setActionMsg(null);
    try {
      await inviteMember(id, inviteId.trim());
      setActionMsg("Convite enviado!");
      setInviteId("");
      void fetchCrewDetail(id);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Falha ao convidar");
    }
  }

  async function onKick(characterId: string) {
    if (!id) return;
    setActionError(null);
    try {
      await kickMember(id, characterId);
      void fetchCrewDetail(id);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Falha ao expulsar");
    }
  }

  async function onLeave() {
    if (!id) return;
    setActionError(null);
    try {
      await leaveCrew(id);
      void fetchCrewDetail(id);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Falha ao sair");
    }
  }

  async function onDissolve() {
    if (!id) return;
    setActionError(null);
    try {
      await dissolveCrew(id);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Falha ao dissolver");
    }
  }

  async function onJoin() {
    if (!id) return;
    setActionError(null);
    try {
      await joinCrew(id);
      void fetchCrewDetail(id);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Falha ao entrar");
    }
  }

  async function onSendChat(e: React.FormEvent) {
    e.preventDefault();
    if (!id || !chatInput.trim()) return;
    try {
      await sendMessage(id, chatInput.trim());
      setChatInput("");
    } catch {
      // error surfaced through chatSendError
    }
  }

  return (
    <div className="py-8 space-y-6">
      <Link to="/crews" className="text-nd-cyan font-data text-xs hover:underline">← Crews</Link>

      {/* Crew header */}
      <div className="card border-nd-cyan/30 shadow-neon-cyan">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div>
            <span className="font-data text-[10px] text-nd-cyan bg-nd-cyan/10 rounded-terminal px-2 py-0.5">
              [{crew.tag}]
            </span>
            <h2 className="font-heading text-2xl text-nd-gold mt-2">{crew.name}</h2>
            <p className="text-nd-text-secondary text-xs font-data mt-1">
              Fundada em {new Date(crew.createdAt).toLocaleDateString("pt-BR")}
              {" · "}{members.length} membros
            </p>
          </div>
          <div className="flex flex-col gap-2">
            {!isMember && (
              <button className="btn-neon text-xs" onClick={() => void onJoin()}>
                Entrar na Crew
              </button>
            )}
            {isMember && !isLeader && (
              <button className="btn-danger text-xs" onClick={() => void onLeave()}>
                Sair da Crew
              </button>
            )}
            {isLeader && (
              <button className="btn-danger text-xs" onClick={() => void onDissolve()}>
                Dissolver Crew
              </button>
            )}
          </div>
        </div>
      </div>

      {actionMsg && <p className="text-nd-green text-sm font-data">{actionMsg}</p>}
      {actionError && <p className="text-nd-magenta text-sm font-data">{actionError}</p>}

      {/* Bonuses */}
      {bonuses.length > 0 && (
        <div className="card border-nd-gold/20">
          <h3 className="font-heading text-sm text-nd-gold tracking-widest mb-2">Bônus da Crew</h3>
          <div className="flex flex-wrap gap-2">
            {bonuses.map((b: CrewBonus) => (
              <span
                key={b.type}
                className="font-data text-xs bg-nd-gold/10 border border-nd-gold/30 rounded-terminal px-2 py-1 text-nd-gold"
              >
                {b.description}: +{b.value}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Members */}
      <div>
        <h3 className="font-heading text-lg text-nd-cyan tracking-widest mb-3">Membros</h3>
        <div className="space-y-2">
          {members.map((m) => (
            <div key={m.id} className="card border-nd-cyan/20 flex items-center justify-between gap-3">
              <div className="text-xs font-data">
                <span className="text-nd-text">{m.characterName}</span>
                {m.characterId === crew.leaderId && (
                  <span className="text-nd-gold ml-2">[LÍDER]</span>
                )}
                <span className="text-nd-text-secondary ml-2">SC: {m.streetCred}</span>
              </div>
              {isLeader && m.characterId !== crew.leaderId && (
                <button
                  className="btn-danger text-xs px-2 py-1"
                  onClick={() => void onKick(m.characterId)}
                >
                  Expulsar
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Leader: invite form */}
      {isLeader && (
        <div className="card border-nd-cyan/30">
          <h3 className="font-heading text-sm text-nd-cyan tracking-widest mb-2">Convidar Membro</h3>
          <form onSubmit={(e) => void onInvite(e)} className="flex gap-2">
            <input
              value={inviteId}
              onChange={(e) => setInviteId(e.target.value)}
              placeholder="ID do personagem"
              className="flex-1 bg-nd-bg border border-nd-cyan/30 rounded-terminal px-3 py-2 text-nd-text font-data text-sm"
              required
            />
            <button type="submit" className="btn-neon text-xs">
              Convidar
            </button>
          </form>
        </div>
      )}

      {/* Chat panel */}
      {isMember && (
        <div className="card border-nd-cyan/20">
          <h3 className="font-heading text-sm text-nd-cyan tracking-widest mb-3">Chat da Crew</h3>
          <div className="bg-nd-bg border border-nd-cyan/20 rounded-terminal p-3 h-64 overflow-y-auto space-y-2 mb-3">
            {messages.length === 0 ? (
              <p className="text-nd-text-secondary text-xs font-data text-center py-8">
                Nenhuma mensagem ainda.
              </p>
            ) : (
              messages.map((msg) => (
                <div key={msg.id} className="text-xs font-data">
                  <span className="text-nd-cyan">{msg.characterName}</span>
                  {msg.crewTag && (
                    <span className="text-nd-text-secondary"> [{msg.crewTag}]</span>
                  )}
                  <span className="text-nd-text-secondary">: </span>
                  <span className="text-nd-text">{msg.message}</span>
                </div>
              ))
            )}
            <div ref={chatEndRef} />
          </div>
          <div className="flex items-center gap-2 text-xs font-data text-nd-text-secondary mb-3">
            <span
              className={`inline-block w-2 h-2 rounded-full ${
                chatStatus === "connected"
                  ? "bg-nd-green"
                  : chatStatus === "reconnecting"
                    ? "bg-nd-gold animate-pulse-neon"
                    : "bg-nd-magenta"
              }`}
            />
            {chatStatus === "connected"
              ? "Conectado"
              : chatStatus === "reconnecting"
                ? "Reconectando..."
                : "Offline"}
          </div>
          <form onSubmit={(e) => void onSendChat(e)} className="flex gap-2">
            <input
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Mensagem..."
              className="flex-1 bg-nd-bg border border-nd-cyan/30 rounded-terminal px-3 py-2 text-nd-text font-data text-sm"
              maxLength={500}
            />
            <button type="submit" className="btn-neon text-xs" disabled={chatSendLoading}>
              Enviar
            </button>
          </form>
          {chatSendError && <p className="text-nd-magenta text-xs font-data mt-2">{chatSendError}</p>}
        </div>
      )}
    </div>
  );
}
