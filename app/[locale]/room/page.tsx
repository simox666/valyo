"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { fileToResizedImage } from "@/lib/image";
import { logEvent } from "@/lib/analytics";
import { formatMoney } from "@/lib/money";
import type { ImageInput } from "@/lib/types";
import { MAX_ROOM_ITEMS, type RoomItem, type ObjectAnalysis } from "@/lib/schema";
import PhotoInput from "@/components/PhotoInput";
import ResultCard from "@/components/ResultCard";

type Stage = "idle" | "analyzing" | "results" | "error";
// Comfortably above the server's own ROOM_SCAN_TIMEOUT_MS (60s, see
// lib/vision.ts) — same margin convention as app/scan/page.tsx.
const FETCH_TIMEOUT_MS = 75_000;
const DETAIL_FETCH_TIMEOUT_MS = 200_000; // reuses /api/analyze, same deadline as app/scan/page.tsx

type DetailState =
  | { stage: "analyzing"; item: RoomItem }
  | { stage: "result"; item: RoomItem; analysis: ObjectAnalysis }
  | { stage: "error"; item: RoomItem; message: string };

export default function RoomScanPage() {
  const t = useTranslations("room");
  const tScan = useTranslations("scan");
  const locale = useLocale();
  const [stage, setStage] = useState<Stage>("idle");
  const [roomImage, setRoomImage] = useState<ImageInput | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [items, setItems] = useState<RoomItem[]>([]);
  const [errorMsg, setErrorMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [detail, setDetail] = useState<DetailState | null>(null);

  async function handleFile(file: File) {
    if (busy) return;
    setBusy(true);
    setErrorMsg("");

    let resized: Awaited<ReturnType<typeof fileToResizedImage>>;
    try {
      resized = await fileToResizedImage(file);
    } catch (err) {
      setBusy(false);
      setErrorMsg(err instanceof Error ? err.message : tScan("analysisFailed"));
      setStage("error");
      return;
    }

    setRoomImage(resized.image);
    setPreview(resized.previewUrl);
    setStage("analyzing");
    logEvent("room_scan_started");

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      const res = await fetch("/api/room-scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ images: [resized.image], locale }),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error("request_failed");
      const data: { analysis: { items: RoomItem[] } } = await res.json();
      setItems(data.analysis.items);
      logEvent("room_scan_result_shown", { item_count: data.analysis.items.length });
      setStage("results");
    } catch {
      logEvent("room_scan_error");
      setErrorMsg(tScan("analysisFailed"));
      setStage("error");
    } finally {
      clearTimeout(timeout);
      setBusy(false);
    }
  }

  async function requestDetail(item: RoomItem) {
    if (!roomImage) return;
    logEvent("room_item_detail_requested");
    setDetail({ stage: "analyzing", item });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), DETAIL_FETCH_TIMEOUT_MS);

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          images: [roomImage],
          locale,
          focusHint: `${item.label} (${item.category}) — ${item.location_hint}`,
        }),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error("request_failed");
      const data: { analysis: ObjectAnalysis } = await res.json();
      setDetail({ stage: "result", item, analysis: data.analysis });
    } catch {
      setDetail({ stage: "error", item, message: tScan("analysisFailed") });
    } finally {
      clearTimeout(timeout);
    }
  }

  function reset() {
    setStage("idle");
    setRoomImage(null);
    setPreview(null);
    setItems([]);
    setErrorMsg("");
    setBusy(false);
    setDetail(null);
  }

  if (detail) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center px-6 py-16 bg-paper">
        <div className="w-full max-w-md space-y-4">
          <button onClick={() => setDetail(null)} className="text-sm text-neutral-500 underline">
            {t("backToList")}
          </button>

          {detail.stage === "analyzing" && (
            <div className="text-center space-y-4 pt-8">
              <p className="text-neutral-600">{t("detailAnalyzing", { label: detail.item.label })}</p>
            </div>
          )}

          {detail.stage === "result" && <ResultCard analysis={detail.analysis} onScanAnother={() => setDetail(null)} />}

          {detail.stage === "error" && (
            <div className="text-center space-y-4 pt-8">
              <p className="text-neutral-700">{detail.message}</p>
              <button
                onClick={() => requestDetail(detail.item)}
                className="rounded-2xl bg-accent text-white py-3 px-6 font-semibold"
              >
                {tScan("retry")}
              </button>
            </div>
          )}
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 py-16 bg-paper">
      {stage === "idle" && (
        <div className="w-full max-w-md space-y-4 text-center">
          <h1 className="text-2xl font-extrabold tracking-tight text-ink">{t("title")}</h1>
          <p className="text-neutral-600 text-sm">{t("subtitle")}</p>
          <div className="space-y-3 pt-4">
            <PhotoInput label={t("takePhoto")} capture disabled={busy} onSelect={handleFile} />
            <PhotoInput label={t("importPhoto")} variant="secondary" disabled={busy} onSelect={handleFile} />
          </div>
          <Link href="/" className="block text-sm text-neutral-500 underline pt-2">
            {t("backHome")}
          </Link>
        </div>
      )}

      {stage === "analyzing" && (
        <div className="w-full max-w-md text-center space-y-6">
          {preview && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt={t("photoAlt")} className="w-48 h-48 object-cover rounded-2xl mx-auto" />
          )}
          <p className="text-neutral-600">{t("analyzing")}</p>
        </div>
      )}

      {stage === "results" && (
        <div className="w-full max-w-md space-y-4">
          <h1 className="text-xl font-extrabold tracking-tight text-ink text-center">
            {t("resultsTitle", { count: items.length })}
          </h1>
          {items.length >= MAX_ROOM_ITEMS && (
            <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2 text-center">
              {t("possiblyMore", { max: MAX_ROOM_ITEMS })}
            </p>
          )}
          {items.length === 0 ? (
            <p className="text-sm text-neutral-500 text-center">{t("noItems")}</p>
          ) : (
            <ul className="space-y-3">
              {items.map((item, i) => (
                <li key={i} className="rounded-2xl border border-line p-4 space-y-1">
                  <p className="font-medium text-ink">{item.label}</p>
                  <p className="text-xs text-neutral-500">{item.location_hint}</p>
                  {item.price_basis === "general_estimate" &&
                  (item.estimated_value_low !== null || item.estimated_value_high !== null) ? (
                    <p className="text-sm text-neutral-700">
                      {item.estimated_value_low !== null && item.estimated_value_high !== null
                        ? `${formatMoney(item.estimated_value_low, item.currency, locale)} – ${formatMoney(item.estimated_value_high, item.currency, locale)}`
                        : formatMoney((item.estimated_value_low ?? item.estimated_value_high)!, item.currency, locale)}
                    </p>
                  ) : (
                    <p className="text-sm text-neutral-400">{t("itemUnavailable")}</p>
                  )}
                  <button
                    onClick={() => requestDetail(item)}
                    className="text-sm text-ink underline pt-1"
                  >
                    {t("getDetail")}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <button onClick={reset} className="w-full rounded-2xl bg-accent text-white py-[15px] font-semibold">
            {t("scanAnother")}
          </button>
        </div>
      )}

      {stage === "error" && (
        <div className="w-full max-w-md text-center space-y-4">
          <p className="text-neutral-700">{errorMsg}</p>
          <button onClick={reset} className="text-sm text-neutral-500 underline">
            {tScan("restart")}
          </button>
        </div>
      )}
    </main>
  );
}
