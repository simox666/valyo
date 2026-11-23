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
 * Lecture à voix haute. Avec `src` : voix naturelle fabriquée par le serveur (fichier audio, fabriqué au
 * premier clic puis conservé). Sans `src`, ou si le serveur ne peut pas la fournir : voix de synthèse de
 * l'appareil, lue passage par passage. Un seul lecteur à la fois sur la page.
 */
export function ListenButton({ text, lang, label = "Écouter", src }: { text: string; lang?: "fr" | "en"; label?: string; src?: string }) {
  const id = useId();
  const [canSpeak, setCanSpeak] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [state, setState] = useState<"idle" | "loading" | "playing" | "paused">("idle");
  const [note, setNote] = useState("");
  const chunks = useRef<string[]>([]);
  const index = useRef(0);
  const run = useRef(0); // chaque démarrage ou arrêt invalide les rappels de la lecture précédente
  const speaking = useRef(false);
  const player = useRef<HTMLAudioElement | null>(null);
  const remoteFailed = useRef(false);

  useEffect(() => {
    setMounted(true);
    const speech = "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;
    setCanSpeak(speech);
    if (speech) window.speechSynthesis.getVoices(); // certains navigateurs ne chargent les voix qu'à la première demande
    const stopIfOther = (event: Event) => {
      if ((event as CustomEvent<string>).detail === id) return;
      run.current++;
      player.current?.pause();
      setState("idle");
    };
    const leave = () => { if (speaking.current) window.speechSynthesis.cancel(); player.current?.pause(); };
    window.addEventListener(EVENT, stopIfOther);
    window.addEventListener("pagehide", leave);
    return () => {
      window.removeEventListener(EVENT, stopIfOther);
      window.removeEventListener("pagehide", leave);
      leave(); // on quitte la page (ou la synthèse se referme) : la lecture de ce bouton s'arrête
    };
  }, [id]);

  const announce = () => window.dispatchEvent(new CustomEvent(EVENT, { detail: id }));

  // --- Voix naturelle (fichier audio du serveur)
  function playRemote() {
    const audio = player.current ?? new Audio();
    player.current = audio;
    audio.preload = "auto";
    audio.onplaying = () => setState("playing");
    audio.onended = () => setState("idle");
    audio.onerror = () => {
      // Pas de clé, plafond du jour atteint, service en panne : on proposera la voix de l'appareil.
      remoteFailed.current = true;
      setState("idle");
      setNote(canSpeak ? "Voix naturelle indisponible pour le moment : touchez de nouveau pour la voix de votre appareil." : "Lecture audio indisponible pour le moment.");
    };
    if (canSpeak) window.speechSynthesis.cancel();
    announce();
    setNote("");
    setState("loading");
    audio.src = src!;
    audio.play().catch((error: Error) => { if (error.name === "NotAllowedError") setState("idle"); });
  }

  // --- Voix de l'appareil
  function speakFrom(position: number) {
    const mine = ++run.current;
    const code = (lang ?? guessLang(text)) === "en" ? "en-US" : "fr-FR";
    index.current = position;
    speaking.current = true;
    const next = () => {
      if (run.current !== mine) return;
      if (index.current >= chunks.current.length) { speaking.current = false; setState("idle"); return; }
      const utterance = new SpeechSynthesisUtterance(chunks.current[index.current]);
      utterance.lang = code;
      const voice = pickVoice(code);
      if (voice) utterance.voice = voice;
      utterance.onend = () => { if (run.current === mine) { index.current++; next(); } };
      utterance.onerror = () => { if (run.current === mine) { speaking.current = false; setState("idle"); } };
      window.speechSynthesis.speak(utterance);
    };
    window.speechSynthesis.cancel();
    announce();
    setNote("");
    setState("playing");
    next();
  }

  const remote = Boolean(src) && !remoteFailed.current;
  function halt(to: "idle" | "paused") {
    run.current++;
    speaking.current = false;
    if (canSpeak) window.speechSynthesis.cancel();
    if (player.current) { player.current.pause(); if (to === "idle") player.current.currentTime = 0; }
    setState(to);
  }
  function toggle() {
    if (state === "playing" || state === "loading") return halt("paused");
    if (remote) {
      if (state === "paused" && player.current?.src) { announce(); setState("playing"); void player.current.play().catch(() => setState("idle")); return; }
      return playRemote();
    }
    if (!canSpeak) return;
    if (state === "paused") return speakFrom(index.current);
    chunks.current = speechChunks(text);
    if (chunks.current.length) speakFrom(0);
  }

  if (!mounted || !text.trim() || (!src && !canSpeak)) return null;
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <button type="button" onClick={toggle} aria-pressed={state === "playing"} aria-busy={state === "loading"}
        className={`inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold text-accent ring-1 transition ${state === "idle" ? "ring-accent-line hover:bg-accent-soft" : "bg-accent-soft ring-accent"}`}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden className={state === "loading" ? "animate-pulse" : ""}>
          {state === "playing" || state === "loading" ? <path d="M8 5v14M16 5v14" /> : state === "paused" ? <path d="M7 4.5v15l12-7.5z" /> : <><path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5z" /><path d="M15.5 9a4.5 4.5 0 0 1 0 6M18 6.5a8 8 0 0 1 0 11" /></>}
        </svg>
        {state === "loading" ? "Préparation de la voix…" : state === "playing" ? "Pause" : state === "paused" ? "Reprendre" : label}
      </button>
      {state !== "idle" && (
        <button type="button" onClick={() => halt("idle")} aria-label="Arrêter la lecture" className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-soft hover:bg-chip hover:text-ink">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden><rect x="5" y="5" width="14" height="14" rx="2" /></svg>
        </button>
      )}
      {note && <span role="status" className="basis-full text-xs text-muted">{note}</span>}
    </span>
  );
}
