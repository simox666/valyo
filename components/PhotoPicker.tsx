"use client";

import { useRef, useState } from "react";

type Img = { id: string; width: number; height: number };
const MAX = 4;

/** Ajout de photos (4 au plus) : envoi immédiat, aperçu, retrait. */
export function PhotoPicker({ images, onChange }: { images: Img[]; onChange: (images: Img[]) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(0);
  const [error, setError] = useState<string | null>(null);

  async function add(files: FileList | null) {
    if (!files?.length) return;
    setError(null);
    const room = MAX - images.length;
    const picked = Array.from(files).slice(0, room);
    if (files.length > room) setError(`${MAX} photos maximum par publication.`);
    let current = images;
    setBusy(picked.length);
    for (const file of picked) {
      const form = new FormData();
      form.append("file", file);
      try {
        const res = await fetch("/api/uploads", { method: "POST", body: form });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) setError(data.error ?? "Photo refusée.");
        else {
          current = [...current, { id: data.id, width: data.width, height: data.height }];
          onChange(current);
        }
      } catch {
        setError("Connexion interrompue pendant l’envoi.");
      }
      setBusy((n) => n - 1);
    }
    if (input.current) input.current.value = "";
  }

  return (
    <div id="photos">
      <p className="label">Photos <span className="font-normal text-neutral-500">· facultatif, {MAX} au plus</span></p>
      <div className="flex flex-wrap gap-2">
        {images.map((img) => (
          <div key={img.id} className="relative h-24 w-24 overflow-hidden rounded-xl bg-chip">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/media/${img.id}`} alt="" className="h-full w-full object-cover" />
            <button
              type="button"
              aria-label="Retirer cette photo"
              onClick={() => onChange(images.filter((i) => i.id !== img.id))}
              className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-sm text-white hover:bg-black/80"
            >
              ✕
            </button>
          </div>
        ))}
        {Array.from({ length: busy }).map((_, i) => (
          <div key={`envoi-${i}`} className="flex h-24 w-24 animate-pulse items-center justify-center rounded-xl bg-chip text-xs text-neutral-500">Envoi…</div>
        ))}
        {images.length + busy < MAX && (
          <button
            type="button"
            onClick={() => input.current?.click()}
            className="flex h-24 w-24 flex-col items-center justify-center rounded-xl border-2 border-dashed border-line text-sm font-semibold text-neutral-600 hover:border-accent hover:text-accent"
          >
            <span aria-hidden className="text-2xl">📷</span> Ajouter
          </button>
        )}
      </div>
      <input ref={input} type="file" accept="image/*" multiple aria-label="Choisir des photos à joindre" className="sr-only" tabIndex={-1} onChange={(e) => void add(e.target.files)} />
      {error && <p className="error-text mt-2">{error}</p>}
      <p className="mt-1 text-xs text-neutral-500">Les photos sont compressées et leurs données cachées (position GPS, appareil) supprimées.</p>
    </div>
  );
}
