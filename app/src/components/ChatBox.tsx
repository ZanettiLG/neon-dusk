import { useEffect, useRef, useState } from "react";
import { useSaideiraStore } from "@/stores/saideira";
import { useAuthStore } from "@/stores/auth";
import { formatRelativeTime } from "@/lib/format";

const MAX_MESSAGE_LENGTH = 500;

/**
 * Saideira chat — real-time tavern chatter. Renders the SSE message stream
 * (auto-scrolled), highlights the current runner's rows in cyan and sends via
 * POST /api/saideira/chat. Enter sends; MVP has no multiline.
 */
export default function ChatBox() {
  const messages = useSaideiraStore((s) => s.messages);
  const chatConnected = useSaideiraStore((s) => s.chatConnected);
  const sendLoading = useSaideiraStore((s) => s.chatSendLoading);
  const sendError = useSaideiraStore((s) => s.chatSendError);
  const sendMessage = useSaideiraStore((s) => s.sendMessage);
  const myName = useAuthStore((s) => s.character?.name ?? null);

  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to the newest message.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const trimmed = draft.trim();
  const canSend = trimmed.length > 0 && trimmed.length <= MAX_MESSAGE_LENGTH && !sendLoading;

  async function onSubmit(): Promise<void> {
    if (!canSend) return;
    try {
      await sendMessage(trimmed);
      setDraft("");
    } catch {
      // error already surfaced through sendError
    }
  }

  return (
    <section className="card flex flex-col">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h3 className="font-heading text-nd-cyan text-lg tracking-widest">CIDADE // CHAT</h3>
        <span
          className={`font-data text-[10px] uppercase tracking-widest border rounded-terminal px-2 py-0.5 ${
            chatConnected
              ? "border-nd-green/40 text-nd-green"
              : "border-nd-magenta/40 text-nd-magenta"
          }`}
        >
          {chatConnected ? "▲ ao vivo" : "▼ reconectando..."}
        </span>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="h-64 sm:h-72 overflow-y-auto border border-nd-cyan/10 rounded-terminal bg-nd-bg/60 p-3 space-y-3"
      >
        {messages.length === 0 ? (
          <p className="text-nd-text-secondary text-sm font-data">
            Nenhuma mensagem ainda — o balcão está vazio. Puxe uma cadeira.
          </p>
        ) : (
          messages.map((m) => {
            const isMe = m.characterName === myName;
            return (
              <div
                key={m.id}
                className={`border-l-2 pl-2 ${
                  isMe ? "border-l-nd-cyan bg-nd-cyan/5" : "border-l-nd-cyan/20"
                }`}
              >
                <p className="font-data text-xs">
                  <span className={isMe ? "text-nd-cyan" : "text-nd-gold"}>
                    {m.characterName}
                    {m.crewTag && <span className="text-nd-text-secondary"> · {m.crewTag}</span>}
                  </span>
                  <span className="text-nd-text-secondary"> — </span>
                  <span className="text-nd-text-secondary">{formatRelativeTime(m.createdAt)}</span>
                </p>
                <p className="text-nd-text text-sm break-words whitespace-pre-wrap">{m.message}</p>
              </div>
            );
          })
        )}
      </div>

      {/* Input */}
      <form
        className="mt-3 flex flex-col sm:flex-row gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void onSubmit();
        }}
      >
        <div className="relative flex-1">
          <input
            type="text"
            value={draft}
            maxLength={MAX_MESSAGE_LENGTH}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Diz aí, runner..."
            className="w-full bg-nd-bg border border-nd-cyan/20 rounded-terminal px-3 py-2 text-sm text-nd-text placeholder:text-nd-text-secondary focus:border-nd-cyan focus:outline-none"
            disabled={sendLoading}
          />
          <span className="absolute right-2 top-1/2 -translate-y-1/2 font-data text-[10px] text-nd-text-secondary">
            {draft.length}/{MAX_MESSAGE_LENGTH}
          </span>
        </div>
        <button
          type="submit"
          disabled={!canSend}
          className="btn-neon font-data text-xs px-4 py-2 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {sendLoading ? "..." : "ENVIAR"}
        </button>
      </form>

      {sendError && <p className="mt-2 font-data text-xs text-nd-magenta">✗ {sendError}</p>}
    </section>
  );
}
