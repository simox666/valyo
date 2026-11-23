"use client";

import { useEffect, useId, useRef, useState } from "react";
import { guessLang, speechChunks } from "@/lib/lecture.ts";

const EVENT = "valyo:lecture";

// Les appareils proposent souvent plusieurs voix pour une même langue, de qualité très inégale :
// on préfère les voix « naturelles », « premium » ou « améliorées », puis celles de Google ou Siri.
function quality(voice: SpeechSynthesisVoice) {
  const name = voice.name.toLowerCase();
  return (/natural|neural/.test(name) ? 50 : 0) + (/premium/.test(name) ? 40 : 0) + (/enhanced|améliorée|amelioree/.test(name) ? 30 : 0)
    + (/siri/.test(name) ? 25 : 0) + (/google/.test(name) ? 20 : 0) + (/compact|espeak/.test(name) ? -30 : 0) + (voice.default ? 2 : 0);
}
function pickVoice(code: string): SpeechSynthesisVoice | null {
  const prefix = code.slice(0, 2).toLowerCase();
  const tag = (v: SpeechSynthesisVoice) => v.lang.replace("_", "-").toLowerCase();
  const voices = window.speechSynthesis.getVoices().filter((v) => tag(v).startsWith(prefix));
  const score = (v: SpeechSynthesisVoice) => quality(v) + (tag(v) === code.toLowerCase() ? 5 : 0);
  return voices.sort((x, y) => score(y) - score(x))[0] ?? null;
}

/**
 * Lecture à voix haute par la voix de synthèse de l'appareil : gratuit, sans rien envoyer à un service.
 * Le texte est lu passage par passage ; « Pause » s'arrête et « Reprendre » repart du passage en cours.
 * Un seul lecteur à la fois sur la page. Rien ne s'affiche si l'appareil n'a pas de voix de synthèse.
 */
export function ListenButton({ text, lang, label = "Écouter" }: { text: string; lang?: "fr" | "en"; label?: string }) {
  const id = useId();
  const [supported, setSupported] = useState(false);
  const [state, setState] = useState<"idle" | "playing" | "paused">("idle");
  const chunks = useRef<string[]>([]);
  const index = useRef(0);
  const run = useRef(0); // chaque démarrage ou arrêt invalide les rappels de la lecture précédente

  useEffect(() => {
    if (!("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) return;
    setSupported(true);
    window.speechSynthesis.getVoices(); // certains navigateurs ne chargent les voix qu'à la première demande
    const stopIfOther = (event: Event) => {
      if ((event as CustomEvent<string>).detail !== id) { run.current++; setState("idle"); }
    };
    const leave = () => { if (run.current) window.speechSynthesis.cancel(); };
    window.addEventListener(EVENT, stopIfOther);
    window.addEventListener("pagehide", leave);
    return () => {
      window.removeEventListener(EVENT, stopIfOther);
      window.removeEventListener("pagehide", leave);
      // On quitte la page (ou la synthèse se referme) : la lecture de ce bouton s'arrête.
      if (chunksPlaying.current) window.speechSynthesis.cancel();
    };
  }, [id]);
  const chunksPlaying = useRef(false);

  function speakFrom(position: number) {
    const mine = ++run.current;
    const code = (lang ?? guessLang(text)) === "en" ? "en-US" : "fr-FR";
    index.current = position;
    chunksPlaying.current = true;
    const next = () => {
      if (run.current !== mine) return;
      if (index.current >= chunks.current.length) { chunksPlaying.current = false; setState("idle"); return; }
      const utterance = new SpeechSynthesisUtterance(chunks.current[index.current]);
      utterance.lang = code;
      const voice = pickVoice(code);
      if (voice) utterance.voice = voice;
      utterance.onend = () => { if (run.current === mine) { index.current++; next(); } };
      utterance.onerror = () => { if (run.current === mine) { chunksPlaying.current = false; setState("idle"); } };
      window.speechSynthesis.speak(utterance);
    };
    window.speechSynthesis.cancel();
    window.dispatchEvent(new CustomEvent(EVENT, { detail: id }));
    setState("playing");
    next();
  }
  function halt(to: "idle" | "paused") {
    run.current++;
    chunksPlaying.current = false;
    window.speechSynthesis.cancel();
    setState(to);
  }
  function toggle() {
    if (state === "playing") return halt("paused");
    if (state === "paused") return speakFrom(index.current);
    chunks.current = speechChunks(text);
    if (chunks.current.length) speakFrom(0);
  }

  if (!supported || !text.trim()) return null;
  return (
    <span className="inline-flex items-center gap-1">
      <button type="button" onClick={toggle} aria-pressed={state === "playing"}
        className={`inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold text-accent ring-1 transition ${state === "idle" ? "ring-accent-line hover:bg-accent-soft" : "bg-accent-soft ring-accent"}`}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          {state === "playing" ? <path d="M8 5v14M16 5v14" /> : state === "paused" ? <path d="M7 4.5v15l12-7.5z" /> : <><path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5z" /><path d="M15.5 9a4.5 4.5 0 0 1 0 6M18 6.5a8 8 0 0 1 0 11" /></>}
        </svg>
        {state === "playing" ? "Pause" : state === "paused" ? "Reprendre" : label}
      </button>
      {state !== "idle" && (
        <button type="button" onClick={() => halt("idle")} aria-label="Arrêter la lecture" className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-soft hover:bg-chip hover:text-ink">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden><rect x="5" y="5" width="14" height="14" rx="2" /></svg>
        </button>
      )}
    </span>
  );
}
