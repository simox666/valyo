"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { api } from "@/lib/client";
import { ThemePicker } from "@/components/ThemePicker";
import { Avatar } from "@/components/Avatar";

export interface ProfileValues {
  displayName: string;
  bio: string;
  themeIds: string[];
  headline: string;
  specialties: string[];
  links: string[];
  askMe: string;
  lookingFor: string;
  avatarImageId: string | null;
  bannerImageId: string | null;
}

/** Envoi d'une photo de profil ou d'une bannière (recadrée côté serveur). */
function ImageField({ purpose, value, onChange, name }: { purpose: "avatar" | "banner"; value: string | null; onChange: (id: string | null) => void; name: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function upload(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError(null);
    const form = new FormData();
    form.append("file", file);
    form.append("purpose", purpose);
    try {
      const res = await fetch("/api/uploads", { method: "POST", body: form });
      const data = await res.json().catch(() => ({}));
      if (res.ok) onChange(data.id);
      else setError(data.error ?? "Image refusée.");
    } catch {
      setError("Connexion interrompue pendant l’envoi.");
    }
    setBusy(false);
    if (input.current) input.current.value = "";
  }
  return (
    <div>
      <p className="label">{purpose === "avatar" ? "Photo de profil" : "Bannière"}</p>
      <div className="flex flex-wrap items-center gap-3">
        {purpose === "avatar" ? (
          <Avatar name={name || "?"} size="lg" imageId={value} />
        ) : value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`/media/${value}`} alt="" className="aspect-[3/1] w-48 rounded-lg object-cover ring-1 ring-line" />
        ) : (
          <span className="flex aspect-[3/1] w-48 items-center justify-center rounded-lg bg-chip text-xs text-muted">Aucune bannière</span>
        )}
        <button type="button" className="btn-secondary" disabled={busy} onClick={() => input.current?.click()}>
          {busy ? "Envoi…" : value ? "Changer" : "Ajouter"}
        </button>
        {value && <button type="button" className="text-sm font-semibold text-muted hover:text-ink" onClick={() => onChange(null)}>Retirer</button>}
      </div>
      <input ref={input} type="file" accept="image/*" aria-label={purpose === "avatar" ? "Choisir une photo de profil" : "Choisir une bannière"} className="sr-only" tabIndex={-1} onChange={(e) => void upload(e.target.files?.[0])} />
      {error && <p className="error-text">{error}</p>}
      <p className="hint">{purpose === "avatar" ? "Recadrée en carré." : "Recadrée au format 3 : 1."} Les données cachées (position GPS, appareil) sont supprimées.</p>
    </div>
  );
}

export function ProfileForm({ themes, initial }: { themes: { id: string; name: string }[]; initial: ProfileValues }) {
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [specialtiesText, setSpecialtiesText] = useState(initial.specialties.join(", "));
  const [links, setLinks] = useState(initial.links.length ? initial.links : [""]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const set = <K extends keyof ProfileValues>(key: K, value: ProfileValues[K]) => setValues((v) => ({ ...v, [key]: value }));

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    const payload = {
      ...values,
      specialties: specialtiesText.split(",").map((s) => s.trim()).filter(Boolean),
      links: links.map((l) => l.trim()).filter(Boolean),
    };
    const result = await api("PATCH", "/api/me", payload);
    setBusy(false);
    setFields(result.data.fields ?? {});
    if (result.ok) {
      setMessage({ ok: true, text: "Modifications enregistrées." });
      router.refresh();
    } else setMessage({ ok: false, text: result.data.error ?? "Enregistrement impossible." });
  }

  const err = (key: string) => (fields[key] ? <p className="error-text">{fields[key]}</p> : null);

  return (
    <form onSubmit={submit} className="space-y-6" noValidate>
      <div className="grid gap-5 sm:grid-cols-2">
        <ImageField purpose="avatar" value={values.avatarImageId} onChange={(id) => set("avatarImageId", id)} name={values.displayName} />
        <ImageField purpose="banner" value={values.bannerImageId} onChange={(id) => set("bannerImageId", id)} name={values.displayName} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="displayName" className="label">Nom affiché</label>
          <input id="displayName" value={values.displayName} onChange={(e) => set("displayName", e.target.value)} className={`field ${fields.displayName ? "field-invalid" : ""}`} />
          {err("displayName")}
        </div>
        <div>
          <label htmlFor="headline" className="label">Métier ou statut</label>
          <input id="headline" maxLength={80} value={values.headline} placeholder="Astrophysicienne, dev Rust, étudiant en biologie, curieux…" onChange={(e) => set("headline", e.target.value)} className="field" />
          {err("headline")}
        </div>
      </div>

      <div>
        <label htmlFor="specialties" className="label">Spécialités <span className="font-normal text-muted">· séparées par des virgules, 8 au plus</span></label>
        <input id="specialties" value={specialtiesText} placeholder="LLM, exoplanètes, CRISPR, Rust" onChange={(e) => setSpecialtiesText(e.target.value)} className="field" />
        {err("specialties")}
      </div>

      <div>
        <label htmlFor="bio" className="label">Courte présentation</label>
        <textarea id="bio" rows={3} value={values.bio} onChange={(e) => set("bio", e.target.value)} className={`field ${fields.bio ? "field-invalid" : ""}`} />
        <p className={fields.bio ? "error-text" : "hint"}>{fields.bio ?? `${values.bio.length}/280 caractères`}</p>
      </div>

      <fieldset>
        <legend className="label">Liens <span className="font-normal text-muted">· GitHub, ORCID, Google Scholar, blog, Bluesky… 6 au plus</span></legend>
        <div className="space-y-2">
          {links.map((link, i) => (
            <div key={i} className="flex gap-2">
              <input type="url" inputMode="url" placeholder="https://" aria-label={`Lien ${i + 1}`} value={link} onChange={(e) => setLinks(links.map((l, j) => (j === i ? e.target.value : l)))} className="field" />
              {links.length > 1 && <button type="button" aria-label={`Retirer le lien ${i + 1}`} className="btn-secondary px-3" onClick={() => setLinks(links.filter((_, j) => j !== i))}>✕</button>}
            </div>
          ))}
        </div>
        {links.length < 6 && <button type="button" className="btn-link mt-2" onClick={() => setLinks([...links, ""])}>+ Ajouter un lien</button>}
        {err("links")}
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="askMe" className="label">Demandez-moi à propos de…</label>
          <textarea id="askMe" rows={2} maxLength={160} value={values.askMe} placeholder="L’IA en local, l’auto-hébergement, l’observation du ciel" onChange={(e) => set("askMe", e.target.value)} className="field" />
          <p className="hint">{values.askMe.length}/160</p>
        </div>
        <div>
          <label htmlFor="lookingFor" className="label">Je cherche…</label>
          <textarea id="lookingFor" rows={2} maxLength={160} value={values.lookingFor} placeholder="Un co-auteur, des testeurs, un mentor, un stage" onChange={(e) => set("lookingFor", e.target.value)} className="field" />
          <p className="hint">{values.lookingFor.length}/160</p>
        </div>
      </div>

      <fieldset>
        <legend className="label">Thèmes suivis <span className="font-normal text-muted">· ils composent votre fil « Pour vous »</span></legend>
        <ThemePicker themes={themes} selected={values.themeIds} onChange={(themeIds) => set("themeIds", themeIds)} />
      </fieldset>

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={busy} className="btn-primary">{busy ? "Enregistrement…" : "Enregistrer"}</button>
        {message && (
          <p role={message.ok ? "status" : "alert"} className={message.ok ? "text-sm font-semibold text-accent" : "error-text"}>{message.text}</p>
        )}
      </div>
    </form>
  );
}
