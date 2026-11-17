"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/client";
import type { DirectMessage } from "@/lib/social/messages.ts";

const time = (iso: string) => new Date(iso).toLocaleString("fr", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/** Fil d'une conversation privée : relu toutes les 4 secondes quand l'onglet est visible. */
export function Thread({ handle, name, initial, canSend }: { handle: string; name: string; initial: DirectMessage[]; canSend: boolean }) {
  const [messages, setMessages] = useState(initial);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [messages.length]);
  useEffect(() => {
    const refresh = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const res = await fetch(`/api/messages/${handle}`, { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          setMessages((current) => (data.messages.length !== current.length || data.messages.at(-1)?.id !== current.at(-1)?.id ? data.messages : current));
          window.dispatchEvent(new Event("valyo:messages"));
        }
      } catch { /* réseau coupé : on réessaie au prochain tour */ }
    };
    const timer = setInterval(refresh, 4000);
    return () => clearInterval(timer);
  }, [handle]);

  async function send() {
    const body = draft.trim();
    if (!body || busy) return;
    setBusy(true);
    setError(null);
    const result = await api<{ message: DirectMessage }>("POST", `/api/messages/${handle}`, { body });
    setBusy(false);
    if (result.ok) {
      setMessages((m) => [...m, result.data.message]);
      setDraft("");
    } else setError(result.data.error ?? "Message non envoyé.");
  }

  return (
    <section aria-label={`Conversation avec ${name}`} className="card flex min-h-[50vh] flex-col">
      <div className="flex-1 space-y-2 p-4" aria-live="polite">
        {messages.length === 0 && <p className="py-10 text-center text-sm text-muted">Écrivez le premier message à {name}.</p>}
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.mine ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[80%] rounded-2xl px-3.5 py-2 ${m.mine ? "bg-ink text-white" : "bg-chip text-ink"}`}>
              <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed">{m.body}</p>
              <p className={`mt-0.5 font-mono text-[10px] ${m.mine ? "text-white/70" : "text-muted"}`}>{time(m.createdAt)}</p>
            </div>
          </div>
        ))}
        <div ref={end} />
      </div>
      {canSend ? (
        <form className="flex items-end gap-2 border-t border-line p-3" onSubmit={(e) => { e.preventDefault(); void send(); }}>
          <label htmlFor="message" className="sr-only">Votre message</label>
          <textarea
            id="message"
            rows={1}
            maxLength={4000}
            value={draft}
            placeholder={`Écrire à ${name}…`}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }}
            className="field max-h-40 min-h-[44px] flex-1 resize-y"
          />
          <button type="submit" disabled={busy || !draft.trim()} className="btn-primary h-11">Envoyer</button>
        </form>
      ) : (
        <p className="border-t border-line p-4 text-sm text-muted">Vous ne pouvez pas écrire à ce membre (blocage ou compte indisponible).</p>
      )}
      {error && <p role="alert" className="error-text px-4 pb-3">{error}</p>}
    </section>
  );
}
