"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { api } from "@/lib/client";
import { Avatar } from "./Avatar";
import { MentionTextarea } from "./MentionTextarea";
import { PhotoPicker } from "./PhotoPicker";
import { ThemeTile } from "./ThemeTile";

// Publication directement depuis le fil : on écrit dans le champ, les options se déplient
// (type, thème, lien, photos), on publie sans changer de page. La première ligne devient
// le titre, la suite le texte. Le formulaire complet reste accessible (« Plus d'options »).

type Kind = "news" | "question" | "experience";
const KINDS: [Kind, string][] = [["news", "Découverte"], ["question", "Question"], ["experience", "Expérience"]];
type Theme = { id: string; slug: string; name: string };

export function QuickComposer({ user, themes, myThemeIds }: { user: { name: string; handle: string | null; avatarId: string | null }; themes: Theme[]; myThemeIds: string[] }) {
  const router = useRouter();
  const area = useRef<HTMLTextAreaElement>(null);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [kind, setKind] = useState<Kind>("news");
  const [themeIds, setThemeIds] = useState<string[]>(myThemeIds.slice(0, 1));
  const [link, setLink] = useState("");
  const [showLink, setShowLink] = useState(false);
  const [images, setImages] = useState<{ id: string; width: number; height: number }[]>([]);
  const [showPhotos, setShowPhotos] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duplicates, setDuplicates] = useState<{ id: string; title: string }[] | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const ordered = [...themes.filter((t) => myThemeIds.includes(t.id)), ...themes.filter((t) => !myThemeIds.includes(t.id))];
  const lines = text.trim().split("\n");
  const title = lines[0]?.trim() ?? "";
  const body = lines.slice(1).join("\n").trim();
  const ready = title.length >= 5 && themeIds.length > 0;

  function toggleTheme(id: string) {
    setThemeIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : ids.length >= 3 ? ids : [...ids, id]));
  }

  async function publish(allowDuplicate = false) {
    if (!ready || busy) return;
    setBusy(true);
    setError(null);
    const result = await api<{ id: string; duplicates?: { id: string; title: string }[] }>("POST", "/api/posts", {
      kind,
      title: title.slice(0, 200),
      body,
      themeIds,
      sources: link.trim() ? [link.trim()] : [],
      imageIds: images.map((i) => i.id),
      allowDuplicate,
    });
    setBusy(false);
    if (result.ok) {
      setText("");
      setLink("");
      setShowLink(false);
      setImages([]);
      setShowPhotos(false);
      setDuplicates(null);
      setOpen(false);
      setDone(result.data.id);
      router.refresh();
      return;
    }
    if (result.status === 409 && result.data.duplicates) {
      setDuplicates(result.data.duplicates);
      return;
    }
    const fields = result.data.fields as Record<string, string> | undefined;
    setError(fields ? Object.values(fields)[0] : result.data.error ?? "Publication impossible.");
  }

  return (
    <div className="card px-3.5 py-3">
      <div className="flex items-start gap-3">
        <Avatar name={user.name} seed={user.handle} size="sm" imageId={user.avatarId} />
        <div className="min-w-0 flex-1">
          <label htmlFor="publication-rapide" className="sr-only">Partager une découverte, une question, un lien</label>
          <MentionTextarea
            id="publication-rapide"
            ref={area}
            rows={open ? 3 : 1}
            value={text}
            maxLength={10200}
            onFocus={() => { setOpen(true); setDone(null); }}
            onValueChange={setText}
            onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void publish(); } }}
            placeholder="Partagez une découverte…"
            className="block w-full resize-none bg-transparent py-1.5 text-[15px] leading-relaxed placeholder:text-muted focus:outline-none"
          />
          {done && !open && (
            <p role="status" className="text-sm text-soft">Publié ✓ <Link href={`/p/${done}`} className="font-semibold text-accent hover:underline">Voir la publication</Link></p>
          )}
        </div>
      </div>

      {open && (
        <div className="mt-2 space-y-3 border-t border-hairline pt-3">
          <p className="text-xs text-muted">La première ligne sert de titre ; la suite, de texte. {title && title.length < 5 && <span className="text-accent">Le titre doit faire au moins 5 caractères.</span>}</p>

          <div className="flex flex-wrap items-center gap-1.5" role="radiogroup" aria-label="Type de publication">
            {KINDS.map(([k, label]) => (
              <button key={k} type="button" role="radio" aria-checked={kind === k} onClick={() => setKind(k)}
                className={`rounded-md px-2.5 py-1 text-sm ${kind === k ? "bg-ink font-semibold text-white" : "bg-chip text-soft hover:text-ink"}`}>
                {label}
              </button>
            ))}
          </div>

          <div>
            <p className="label-mono mb-1.5">Thème · 1 à 3</p>
            <div className="flex flex-wrap gap-1.5">
              {ordered.map((t) => {
                const on = themeIds.includes(t.id);
                return (
                  <button key={t.id} type="button" aria-pressed={on} title={t.name} onClick={() => toggleTheme(t.id)}
                    className={`flex items-center gap-1.5 rounded-md py-0.5 pl-0.5 pr-2 text-xs ${on ? "bg-accent-soft font-semibold text-accent ring-1 ring-accent" : "text-soft ring-1 ring-line hover:ring-ink"}`}>
                    <ThemeTile slug={t.slug} name={t.name} size="sm" active={on} />
                    {t.name}
                  </button>
                );
              })}
            </div>
          </div>

          {showLink && (
            <div>
              <label htmlFor="publication-lien" className="label-mono mb-1 block">Lien vers la source</label>
              <input id="publication-lien" type="url" inputMode="url" placeholder="https://" value={link} onChange={(e) => setLink(e.target.value)} className="field py-2" />
            </div>
          )}
          {showPhotos && <PhotoPicker images={images} onChange={setImages} />}

          {duplicates && (
            <div role="alert" className="rounded-lg bg-accent-soft p-3 text-sm">
              <p className="font-semibold">Ce lien a déjà été partagé :</p>
              <ul className="mt-1">{duplicates.map((d) => <li key={d.id}><Link href={`/p/${d.id}`} className="text-accent hover:underline">{d.title || "Publication existante"} →</Link></li>)}</ul>
              <button type="button" onClick={() => void publish(true)} className="btn-secondary mt-2">Publier quand même</button>
            </div>
          )}
          {error && <p role="alert" className="error-text">{error}</p>}

          <div className="flex flex-wrap items-center gap-1">
            <button type="button" onClick={() => setShowLink(!showLink)} aria-pressed={showLink} className="inline-flex h-9 items-center gap-1.5 rounded-md px-2 text-sm text-soft hover:bg-chip hover:text-ink">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1" /><path d="M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" /></svg>
              Lien
            </button>
            <button type="button" onClick={() => setShowPhotos(!showPhotos)} aria-pressed={showPhotos} className="inline-flex h-9 items-center gap-1.5 rounded-md px-2 text-sm text-soft hover:bg-chip hover:text-ink">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="10" r="2" /><path d="m21 16-5-5-9 9" /></svg>
              Photo
            </button>
            <Link href="/publier" className="inline-flex h-9 items-center rounded-md px-2 text-sm text-soft hover:bg-chip hover:text-ink">Plus d’options</Link>
            <span className="ml-auto flex items-center gap-2">
              <button type="button" onClick={() => { setOpen(false); area.current?.blur(); }} className="h-9 rounded-md px-2.5 text-sm text-muted hover:text-ink">Annuler</button>
              <button type="button" disabled={!ready || busy} onClick={() => void publish()} className="inline-flex h-9 items-center rounded-md bg-accent px-4 text-sm font-semibold text-white hover:bg-accent-dark disabled:cursor-not-allowed disabled:opacity-50">
                {busy ? "Publication…" : "Publier"}
              </button>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
