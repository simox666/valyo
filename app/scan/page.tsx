"use client";

import { useEffect, useRef, useState } from "react";
import { fileToResizedImage } from "@/lib/image";
import { logEvent } from "@/lib/analytics";
import type { ImageInput } from "@/lib/types";
import type { ObjectAnalysis } from "@/lib/schema";
import PhotoInput from "@/components/PhotoInput";
import ResultCard from "@/components/ResultCard";

type Stage = "idle" | "analyzing" | "need_more" | "result" | "error";
const MAX_ROUNDS = 2;
// Comfortably above the server's own budget (120s, see app/api/analyze/route.ts)
// so a legitimately slow scan isn't aborted client-side before the server
// even has a chance to answer or time out itself.
const FETCH_TIMEOUT_MS = 150_000;

function analyzingMessage(seconds: number): string {
  if (seconds < 8) return "Analyse de la photo…";
  if (seconds < 20) return "Identification en cours…";
  if (seconds < 45) return "Recherche de prix en ligne…";
  // Honest, not a promise of imminent completion — some scans genuinely take
  // a minute or two (project.md R7).
  return "Toujours en cours — certains objets prennent jusqu'à deux minutes.";
}

function useElapsedSeconds(active: boolean): number {
  const [seconds, setSeconds] = useState(0);
  const startRef = useRef<number>(0);

  useEffect(() => {
    if (!active) {
      setSeconds(0);
      return;
    }
    startRef.current = Date.now();
    const id = setInterval(() => {
      setSeconds(Math.floor((Date.now() - startRef.current) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [active]);

  return seconds;
}

export default function ScanPage() {
  const [stage, setStage] = useState<Stage>("idle");
  const [images, setImages] = useState<ImageInput[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [analysis, setAnalysis] = useState<ObjectAnalysis | null>(null);
  const [partialAnalysis, setPartialAnalysis] = useState<ObjectAnalysis | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [correctionUsed, setCorrectionUsed] = useState(false);
  const elapsed = useElapsedSeconds(stage === "analyzing");

  // Guards against out-of-order responses: if the user fires a second
  // request (retry, or a fast double-tap before inputs were disabled), only
  // the latest request's response is applied (project.md R6).
  const requestIdRef = useRef(0);
  const previewsRef = useRef<string[]>([]);
  previewsRef.current = previews;
  // Lets the request actually be cancelled from outside runAnalysis (e.g. on
  // unmount) — a controller local to the function can only be aborted by its
  // own timeout, so a navigation mid-scan previously left the fetch (and the
  // billed provider call behind it) running with nothing to stop it
  // (project.md C5/C6 review note).
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      // Revoke every preview URL on unmount so repeated scans across a
      // session don't leak object URLs (project.md R8).
      for (const url of previewsRef.current) URL.revokeObjectURL(url);
      controllerRef.current?.abort();
    };
  }, []);

  async function runAnalysis(nextImages: ImageInput[], correction?: string) {
    const myRequestId = ++requestIdRef.current;
    setBusy(true);
    setStage("analyzing");
    setErrorMsg("");

    controllerRef.current?.abort(); // supersede any still-running request
    const controller = new AbortController();
    controllerRef.current = controller;
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(correction ? { images: nextImages, correction } : { images: nextImages }),
        signal: controller.signal,
      });
      if (requestIdRef.current !== myRequestId) return; // a newer request superseded this one

      if (res.status === 429) {
        setErrorMsg("Trop de scans récents. Patientez un peu avant de réessayer.");
        setStage("error");
        return;
      }
      if (!res.ok) throw new Error("request_failed");
      const data: { analysis: ObjectAnalysis } = await res.json();
      if (requestIdRef.current !== myRequestId) return;

      const canAskAgain = nextImages.length < MAX_ROUNDS && Boolean(data.analysis.next_photo_request);
      setAnalysis(data.analysis);
      if (canAskAgain) {
        setPartialAnalysis(data.analysis);
        logEvent("follow_up_requested");
        setStage("need_more");
      } else {
        logEvent("result_shown", {
          identification_confidence: data.analysis.identification_confidence,
          price_confidence: data.analysis.price_confidence,
          rounds: nextImages.length,
        });
        setStage("result");
      }
    } catch {
      if (requestIdRef.current !== myRequestId) return;
      logEvent("analysis_error");
      setErrorMsg("L'analyse a échoué ou a pris trop de temps. Réessayez.");
      setStage("error");
    } finally {
      clearTimeout(timeout);
      if (requestIdRef.current === myRequestId) setBusy(false);
    }
  }

  async function handleFile(file: File) {
    if (busy) return; // one capture/import at a time — avoids overlapping decodes
    setBusy(true);
    setErrorMsg("");

    let resized: Awaited<ReturnType<typeof fileToResizedImage>>;
    try {
      resized = await fileToResizedImage(file);
    } catch (err) {
      setBusy(false);
      setErrorMsg(err instanceof Error ? err.message : "Impossible de lire cette photo. Réessayez.");
      setStage("error");
      return;
    }

    const nextImages = [...images, resized.image];
    setImages(nextImages);
    setPreviews((p) => [...p, resized.previewUrl]);
    logEvent(nextImages.length === 1 ? "scan_started" : "follow_up_photo_submitted", {
      round: nextImages.length,
    });

    await runAnalysis(nextImages);
  }

  function retry() {
    if (busy || images.length === 0) return;
    void runAnalysis(images);
  }

  function submitCorrection(note: string) {
    if (busy || correctionUsed || images.length === 0) return;
    setCorrectionUsed(true); // one correction per scan — avoids an open-ended back-and-forth
    logEvent("correction_submitted");
    void runAnalysis(images, note);
  }

  function skipFollowUp() {
    if (partialAnalysis) {
      logEvent("follow_up_skipped");
      setAnalysis(partialAnalysis);
      logEvent("result_shown", {
        identification_confidence: partialAnalysis.identification_confidence,
        price_confidence: partialAnalysis.price_confidence,
        rounds: images.length,
        skipped_follow_up: true,
      });
      setStage("result");
    }
  }

  function reset() {
    logEvent("scan_again_clicked");
    for (const url of previews) URL.revokeObjectURL(url);
    requestIdRef.current++; // invalidate any in-flight request
    setStage("idle");
    setImages([]);
    setPreviews([]);
    setAnalysis(null);
    setPartialAnalysis(null);
    setErrorMsg("");
    setBusy(false);
    setCorrectionUsed(false);
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 py-16 bg-paper">
      {stage === "idle" && (
        <div className="w-full max-w-md space-y-4 text-center">
          <h1 className="text-2xl font-semibold text-ink">Photographiez votre objet</h1>
          <p className="text-neutral-600 text-sm">
            LEGO, électronique ou sneakers — cadrez l&apos;objet entier, bien éclairé.
          </p>
          <div className="space-y-3 pt-4">
            <PhotoInput label="Prendre une photo" capture disabled={busy} onSelect={handleFile} />
            <PhotoInput label="Importer une photo" variant="secondary" disabled={busy} onSelect={handleFile} />
          </div>
        </div>
      )}

      {stage === "analyzing" && (
        <div className="w-full max-w-md text-center space-y-6">
          {previews.length > 0 && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previews[previews.length - 1]}
              alt="Photo en cours d'analyse"
              className="w-48 h-48 object-cover rounded-2xl mx-auto"
            />
          )}
          <p className="text-neutral-600">{analyzingMessage(elapsed)}</p>
          <p className="text-xs text-neutral-400">{elapsed}s</p>
        </div>
      )}

      {stage === "need_more" && analysis?.next_photo_request && (
        <div className="w-full max-w-md space-y-4 text-center">
          <h1 className="text-xl font-semibold text-ink">Une photo de plus</h1>
          <p className="text-ink font-medium">{analysis.next_photo_request.instruction}</p>
          <p className="text-neutral-500 text-sm">{analysis.next_photo_request.reason}</p>
          <div className="space-y-3 pt-4">
            <PhotoInput label="Prendre cette photo" capture disabled={busy} onSelect={handleFile} />
            <PhotoInput label="Importer une photo" variant="secondary" disabled={busy} onSelect={handleFile} />
            <button onClick={skipFollowUp} disabled={busy} className="text-sm text-neutral-500 underline disabled:opacity-50">
              Passer — voir le résultat avec la confiance actuelle
            </button>
          </div>
        </div>
      )}

      {stage === "result" && analysis && (
        <ResultCard
          analysis={analysis}
          onScanAnother={reset}
          onCorrect={correctionUsed ? undefined : submitCorrection}
          correctionDisabled={busy}
        />
      )}

      {stage === "error" && (
        <div className="w-full max-w-md text-center space-y-4">
          <p className="text-neutral-700">{errorMsg}</p>
          <div className="flex flex-col gap-3 items-center">
            {images.length > 0 && (
              <button
                onClick={retry}
                disabled={busy}
                className="rounded-full bg-ink text-white py-3 px-6 font-medium disabled:opacity-50"
              >
                Réessayer
              </button>
            )}
            <button onClick={reset} className="text-sm text-neutral-500 underline">
              Recommencer avec une nouvelle photo
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
