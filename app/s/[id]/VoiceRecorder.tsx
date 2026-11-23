"use client";

import { useEffect, useRef, useState } from "react";
import type { MessageView } from "@/lib/rooms/chat.ts";

// Enregistrement d'un message vocal : micro → aperçu (on se réécoute) → envoi.
// Rien ne part tant que l'on n'a pas appuyé sur « Envoyer » ; le micro est coupé dès
// l'arrêt de l'enregistrement. MP4/AAC est préféré (lisible partout, iPhone compris),
// WebM/Ogg Opus sinon.

const MAX_MS = 120_000;
const FORMATS = ["audio/mp4", "audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus"];
const clock = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, "0")}`;

type Phase = { step: "idle" } | { step: "recording" } | { step: "preview"; blob: Blob; url: string; ms: number; clientId: string; sending: boolean };

export function VoiceRecorder({ roomId, onSent, onError }: { roomId: string; onSent: (message: MessageView) => void; onError: (message: string | null) => void }) {
  const [supported, setSupported] = useState(false);
  const [phase, setPhase] = useState<Phase>({ step: "idle" });
  const [elapsed, setElapsed] = useState(0);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const startedAt = useRef(0);
  const ticker = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const discard = useRef(false);
  const previewUrl = useRef<string | null>(null);

  useEffect(() => {
    setSupported(typeof MediaRecorder !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia));
    return () => {
      discard.current = true;
      clearInterval(ticker.current);
      if (recorder.current?.state === "recording") recorder.current.stop();
      stream.current?.getTracks().forEach((t) => t.stop());
      if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
    };
  }, []);

  if (!supported) return null;

  const releaseMic = () => { stream.current?.getTracks().forEach((t) => t.stop()); stream.current = null; };
  const reset = () => {
    if (previewUrl.current) { URL.revokeObjectURL(previewUrl.current); previewUrl.current = null; }
    setPhase({ step: "idle" });
    setElapsed(0);
  };

  async function start() {
    onError(null);
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      onError("Micro indisponible : autorisez l’accès au micro pour Valyo dans votre navigateur.");
      return;
    }
    const mimeType = FORMATS.find((f) => MediaRecorder.isTypeSupported(f));
    const chunks: Blob[] = [];
    let rec: MediaRecorder;
    try {
      rec = new MediaRecorder(stream.current, { ...(mimeType ? { mimeType } : {}), audioBitsPerSecond: 32000 });
    } catch {
      releaseMic();
      onError("Ce navigateur ne permet pas d’enregistrer un message vocal.");
      return;
    }
    recorder.current = rec;
    discard.current = false;
    rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    rec.onstop = () => {
      clearInterval(ticker.current);
      releaseMic();
      const ms = Math.min(Date.now() - startedAt.current, MAX_MS);
      if (discard.current || ms < 500 || !chunks.length) { reset(); return; }
      const blob = new Blob(chunks, { type: rec.mimeType || mimeType || "audio/mp4" });
      const url = URL.createObjectURL(blob);
      previewUrl.current = url;
      setPhase({ step: "preview", blob, url, ms, clientId: crypto.randomUUID(), sending: false });
    };
    startedAt.current = Date.now();
    setElapsed(0);
    rec.start();
    setPhase({ step: "recording" });
    ticker.current = setInterval(() => {
      const ms = Date.now() - startedAt.current;
      setElapsed(ms);
      if (ms >= MAX_MS && rec.state === "recording") rec.stop(); // deux minutes : arrêt automatique
    }, 250);
  }

  const stop = (keep: boolean) => {
    discard.current = !keep;
    if (recorder.current?.state === "recording") recorder.current.stop();
  };

  async function send() {
    if (phase.step !== "preview" || phase.sending) return;
    onError(null);
    setPhase({ ...phase, sending: true });
    try {
      const response = await fetch(`/api/rooms/${roomId}/audio?clientId=${phase.clientId}&duree=${Math.round(phase.ms)}`, {
        method: "POST",
        headers: { "Content-Type": "application/octet-stream" },
        body: phase.blob,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        onError(data.error ?? "Envoi du message vocal impossible.");
        setPhase({ ...phase, sending: false }); // l'enregistrement est conservé : on peut réessayer
        return;
      }
      onSent(data.message as MessageView);
      window.dispatchEvent(new Event("valyo:progress"));
      reset();
    } catch {
      onError("Connexion impossible. Votre enregistrement est conservé : réessayez.");
      setPhase({ ...phase, sending: false });
    }
  }

  if (phase.step === "idle") {
    return (
      <button type="button" onClick={start} className="btn-secondary" aria-label="Enregistrer un message vocal">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></svg>
        Vocal
      </button>
    );
  }

  if (phase.step === "recording") {
    return (
      <div className="flex w-full flex-wrap items-center gap-3 rounded-lg bg-accent-soft px-3 py-2" role="status">
        <span aria-hidden className="h-2.5 w-2.5 animate-pulse rounded-full bg-accent" />
        <span className="text-sm font-semibold">Enregistrement… <span className="font-mono">{clock(elapsed)}</span> <span className="font-normal text-soft">/ {clock(MAX_MS)}</span></span>
        <span className="ml-auto flex gap-2">
          <button type="button" onClick={() => stop(false)} className="btn-link">Annuler</button>
          <button type="button" onClick={() => stop(true)} className="btn-primary">Terminer</button>
        </span>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-wrap items-center gap-3 rounded-lg bg-accent-soft px-3 py-2">
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio controls src={phase.url} className="h-10 w-full max-w-xs" aria-label={`Votre enregistrement de ${clock(phase.ms)}`} />
      <span className="font-mono text-xs text-soft">{clock(phase.ms)}</span>
      <span className="ml-auto flex gap-2">
        <button type="button" onClick={reset} disabled={phase.sending} className="btn-link">Supprimer</button>
        <button type="button" onClick={send} disabled={phase.sending} className="btn-primary">{phase.sending ? "Envoi…" : "Envoyer le vocal"}</button>
      </span>
    </div>
  );
}
