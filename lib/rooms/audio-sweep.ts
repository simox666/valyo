import "server-only";
import { db } from "../db";
import { sweepAudio } from "./audio.ts";

declare global {
  // eslint-disable-next-line no-var
  var __valyoAudioSweep: ReturnType<typeof setInterval> | undefined;
}

/** Nettoyage périodique des fichiers audio sans message (toutes les 15 minutes). */
export function startAudioSweep(): void {
  if (globalThis.__valyoAudioSweep) return;
  globalThis.__valyoAudioSweep = setInterval(() => {
    sweepAudio(db.query).catch((error) => console.error("[audio] nettoyage en échec :", (error as Error).message));
  }, 15 * 60 * 1000);
  globalThis.__valyoAudioSweep.unref?.();
}
