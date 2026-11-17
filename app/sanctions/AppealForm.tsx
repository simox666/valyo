"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/client";

export function AppealForm({ actionId }: { actionId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    const result = await api("POST", "/api/appeals", { actionId, body });
    setBusy(false);
    if (result.ok) {
      setMessage({ ok: true, text: "Contestation envoyée. Elle sera examinée, si possible par une autre personne ; la sanction reste active pendant l'examen." });
      router.refresh();
    } else {
      setMessage({ ok: false, text: result.data.error ?? "Envoi impossible." });
    }
  }

  if (!open) {
    return (
      <button type="button" className="btn-link text-sm" onClick={() => setOpen(true)}>
        Contester cette décision (dans les 14 jours, une seule fois)
      </button>
    );
  }
  return (
    <form onSubmit={submit} className="mt-2 space-y-2 text-sm">
      <label className="block font-semibold">
        Votre contestation
        <textarea value={body} onChange={(e) => setBody(e.target.value)} required minLength={10} maxLength={2000} rows={3} className="input mt-1 w-full" />
      </label>
      <button type="submit" disabled={busy} className="btn-primary px-3 py-1.5">Envoyer la contestation</button>
      {message && <p role={message.ok ? "status" : "alert"} className={message.ok ? "font-semibold text-accent" : "error-text"}>{message.text}</p>}
    </form>
  );
}
