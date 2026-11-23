"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/client";
import { fieldErrors, KIND_LABELS, POST_KINDS, postSchema, type PostKind } from "@/lib/validation";
import { MentionTextarea } from "./MentionTextarea";
import { ThemePicker } from "./ThemePicker";
import { PostPreview } from "./PostPreview";
import { CopyLinkButton } from "./CopyLinkButton";
import { PhotoPicker } from "./PhotoPicker";

export interface PostFormValues {
  kind: PostKind;
  title: string;
  body: string;
  sources: string[];
  themeIds: string[];
  demoUrl: string;
  /** Photos déjà envoyées, dans l'ordre d'affichage. */
  images?: { id: string; width: number; height: number }[];
}

// Brouillons isolés PAR COMPTE (SEC-05) : la clé porte l'identifiant du compte, le contenu
// enregistre son propriétaire (revérifié à la restauration), et la déconnexion purge tout
// (LogoutButton). L'ancienne clé partagée entre comptes est supprimée sans être restaurée.
const LEGACY_DRAFT_KEY = "valyo:brouillon-publication";
export const DRAFT_PREFIX = "valyo:brouillon-publication:";

const KIND_GUIDE: Record<PostKind, { icon: string; help: string; title: string; body: string; tip: string }> = {
  news: { icon: "↗", help: "Une découverte à partager, avec sa source.", title: "Quelle découverte souhaitez-vous partager ?", body: "Résumez la nouvelle, ce qu’elle apporte et ses limites…", tip: "Distinguez les faits de votre avis et citez la source d’origine." },
  question: { icon: "?", help: "Un sujet à explorer avec la communauté.", title: "Quelle question vous posez-vous ?", body: "Décrivez votre contexte, ce que vous avez déjà cherché et ce qui vous aiderait…", tip: "Une question précise, avec un peu de contexte, facilite les réponses utiles." },
  experience: { icon: "✎", help: "Ce que vous avez essayé et appris.", title: "Quel outil ou usage avez-vous essayé ?", body: "Expliquez votre usage, ce qui a fonctionné, les limites et vos conseils…", tip: "Parlez de votre expérience concrète : conditions d’essai, résultats et limites." },
};

export function PostForm({ themes, initial, postId, authorName = "Vous", userKey = "" }: {
  themes: { id: string; name: string }[];
  initial?: PostFormValues;
  postId?: string;
  authorName?: string;
  /** Identifiant stable du compte connecté : isole le brouillon local de ce compte. */
  userKey?: string;
}) {
  const router = useRouter();
  const editing = Boolean(postId);
  const [values, setValues] = useState<PostFormValues>(initial ?? { kind: "news", title: "", body: "", sources: [""], themeIds: [], demoUrl: "" });
  const [preview, setPreview] = useState(false);
  const [publishedId, setPublishedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [duplicates, setDuplicates] = useState<{ id: string; title: string }[] | null>(null);
  const stageRef = useRef<HTMLHeadingElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  useEffect(() => { stageRef.current?.focus(); }, [preview, publishedId, duplicates]);
  useEffect(() => { if (error) errorRef.current?.focus(); }, [error, fields]);

  // Brouillon automatique (création seulement) : la saisie survit à la fermeture de
  // l'onglet, sur cet appareil. Proposé à la reprise, jamais imposé ; effacé à la publication.
  const [savedDraft, setSavedDraft] = useState<{ values: PostFormValues; at: string } | null>(null);
  const [draftReady, setDraftReady] = useState(editing);
  const draftKey = userKey ? `${DRAFT_PREFIX}${userKey}` : null;
  useEffect(() => {
    if (editing) return;
    try {
      // La clé historique, sans propriétaire, peut venir d'un autre compte : jamais restaurée.
      localStorage.removeItem(LEGACY_DRAFT_KEY);
      if (draftKey) {
        const raw = localStorage.getItem(draftKey);
        const draft = raw ? (JSON.parse(raw) as { owner?: string; values: PostFormValues; at: string }) : null;
        if (draft && draft.owner === userKey && (draft.values.title.trim() || draft.values.body.trim())) setSavedDraft(draft);
        else if (draft) localStorage.removeItem(draftKey);
      }
    } catch {}
    setDraftReady(true);
  }, [editing, draftKey, userKey]);
  useEffect(() => {
    if (editing || !draftReady || savedDraft || publishedId || !draftKey) return;
    const timer = setTimeout(() => {
      try {
        if (values.title.trim() || values.body.trim()) localStorage.setItem(draftKey, JSON.stringify({ owner: userKey, values, at: new Date().toISOString() }));
        else localStorage.removeItem(draftKey);
      } catch {}
    }, 600);
    return () => clearTimeout(timer);
  }, [values, editing, draftReady, savedDraft, publishedId, draftKey, userKey]);
  const clearDraft = () => { try { if (draftKey) localStorage.removeItem(draftKey); } catch {} };

  const set = <K extends keyof PostFormValues>(key: K, value: PostFormValues[K]) => setValues(v => ({ ...v, [key]: value }));
  const sources = values.sources.length ? values.sources : [""];
  const guide = KIND_GUIDE[values.kind];
  const payload = () => {
    const { images, ...rest } = values;
    return { ...rest, imageIds: (images ?? []).map(i => i.id), sources: values.sources.map(s => s.trim()).filter(Boolean), demoUrl: values.kind === "question" ? "" : values.demoUrl.trim() };
  };

  function validate() {
    const result = postSchema.safeParse(payload());
    if (!result.success) {
      setFields(fieldErrors(result.error));
      setError("Quelques détails restent à compléter avant l’aperçu.");
      setPreview(false);
      return false;
    }
    setFields({});
    setError(null);
    return true;
  }

  async function submit(allowDuplicate = false) {
    if (submitting.current || !validate()) return;
    submitting.current = true;
    setBusy(true);
    const result = await api<{ id: string; duplicates?: { id: string; title: string }[] }>(
      editing ? "PATCH" : "POST", editing ? `/api/posts/${postId}` : "/api/posts", { ...payload(), allowDuplicate },
    );
    submitting.current = false;
    setBusy(false);
    if (result.ok) {
      setDuplicates(null);
      if (editing) {
        router.push(`/p/${result.data.id}`);
        router.refresh();
      } else {
        clearDraft();
        setPublishedId(result.data.id);
        router.refresh();
      }
      return;
    }
    if (result.status === 409 && result.data.duplicates) {
      setDuplicates(result.data.duplicates);
      return;
    }
    // Conserver la saisie, y compris après une confirmation de doublon refusée.
    setDuplicates(null);
    setFields(result.data.fields ?? {});
    setError(result.data.error ?? "Une erreur est survenue.");
    if (result.data.fields) setPreview(false);
  }

  const errorProps = (key: string) => ({ "aria-invalid": Boolean(fields[key]), "aria-describedby": fields[key] ? `${key}-error` : undefined });
  const fieldError = (key: string) => fields[key] ? <p id={`${key}-error`} className="error-text">{fields[key]}</p> : null;

  if (publishedId) return <section className="card mx-auto max-w-3xl space-y-6 p-6 sm:p-10">
    <span aria-hidden className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-accent-soft text-2xl text-accent">✓</span>
    <div>
      <h2 ref={stageRef} tabIndex={-1} className="text-2xl font-bold">Votre publication est en ligne.</h2>
      <p className="mt-2 text-soft">Les membres peuvent maintenant la lire et y répondre.</p>
    </div>
    <div className="rounded-card bg-chip p-4"><span className="chip bg-white">{KIND_LABELS[values.kind]}</span><p className="mt-2 text-xl font-bold">{values.title.trim()}</p></div>
    <div className="flex flex-wrap gap-3"><Link href={`/p/${publishedId}`} className="btn-primary">Voir ma publication →</Link><CopyLinkButton path={`/p/${publishedId}`} /></div>
    <div className="border-t border-line pt-5">
      <h3 className="font-bold">Envie de poursuivre ensemble ?</h3>
      <p className="mb-4 mt-1 text-sm text-soft">Créez un salon associé pour échanger en groupe autour de votre publication.</p>
      <Link href={`/salons/nouveau?post=${publishedId}`} className="btn-secondary">Créer un salon sur ce sujet</Link>
    </div>
    <Link href="/" className="btn-link inline-block">Retour au fil</Link>
  </section>;

  return <div className="space-y-6">
    {savedDraft && <section role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-accent/30 bg-accent-soft p-4">
      <div className="min-w-0">
        <p className="font-bold text-accent">Brouillon retrouvé</p>
        <p className="truncate text-sm text-soft">« {savedDraft.values.title.trim() || savedDraft.values.body.trim().slice(0, 60)} » · enregistré le {new Date(savedDraft.at).toLocaleString("fr-BE", { dateStyle: "short", timeStyle: "short" })}</p>
      </div>
      <div className="flex gap-2">
        <button type="button" className="btn-primary" onClick={() => { setValues({ ...savedDraft.values, sources: savedDraft.values.sources.length ? savedDraft.values.sources : [""] }); setSavedDraft(null); }}>Reprendre</button>
        <button type="button" className="btn-secondary" onClick={() => { clearDraft(); setSavedDraft(null); }}>Ignorer</button>
      </div>
    </section>}
    {!editing && !savedDraft && (values.title.trim() || values.body.trim()) && <p className="text-xs text-muted" aria-live="polite">Brouillon enregistré automatiquement sur cet appareil.</p>}
    <ol aria-label="Étapes de publication" className="flex flex-wrap gap-x-6 gap-y-2 text-sm font-semibold">
      <li aria-current={!preview ? "step" : undefined} className={!preview ? "text-accent" : "text-muted"}>1. Rédiger</li>
      <li aria-current={preview ? "step" : undefined} className={preview ? "text-accent" : "text-muted"}>2. Relire l’aperçu</li>
      <li className="text-muted">3. {editing ? "Enregistrer" : "Publier et discuter"}</li>
    </ol>
    {error && <div ref={errorRef} tabIndex={-1} role="alert" className="rounded-card border border-red-200 bg-red-50 p-4 text-red-800">
      <p className="font-semibold">{error}</p>
      {Object.keys(fields).length > 0 && <ul className="mt-2 list-inside list-disc text-sm">{Object.entries(fields).map(([key, message]) => <li key={key}><a className="underline" href={`#${key === "sources" ? "source-0" : key === "themeIds" ? "post-themes" : key}`}>{message}</a></li>)}</ul>}
    </div>}
    {duplicates ? <section className="card space-y-4 border-amber-300 p-5 sm:p-8">
      <h2 ref={stageRef} tabIndex={-1} className="text-xl font-bold">Cette source a déjà été partagée.</h2>
      <p>Vous pouvez rejoindre la discussion existante :</p>
      <ul className="space-y-2">{duplicates.map(d => <li key={d.id}><Link href={`/p/${d.id}`} className="btn-link">{d.title || "Publication existante"} →</Link></li>)}</ul>
      <p className="text-sm text-soft">Si votre publication apporte un autre point de vue, vous pouvez la maintenir. Elle restera séparée de la discussion existante.</p>
      <div className="flex flex-wrap gap-3">
        <button type="button" className="btn-primary" disabled={busy} onClick={() => submit(true)}>{busy ? "Publication…" : "Publier quand même"}</button>
        <button type="button" className="btn-secondary" disabled={busy} onClick={() => { setDuplicates(null); setPreview(false); }}>Revenir à ma publication</button>
      </div>
    </section> : <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <form className="min-w-0 space-y-5" noValidate onSubmit={e => { e.preventDefault(); if (preview) void submit(); else if (validate()) setPreview(true); }}>
        {preview ? <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 ref={stageRef} tabIndex={-1} className="text-xl font-bold">Relisez votre publication</h2>
            <button type="button" className="btn-secondary" disabled={busy} onClick={() => setPreview(false)}>← Revenir à la rédaction</button>
          </div>
          <PostPreview values={values} themes={themes} authorName={authorName} />
        </> : <>
          <h2 ref={stageRef} tabIndex={-1} className="sr-only">Rédiger votre publication</h2>
          {!editing ? <fieldset>
            <legend className="mb-3 text-lg font-bold">Que souhaitez-vous partager ?</legend>
            <div className="grid gap-3 sm:grid-cols-3">{POST_KINDS.map(kind => <label key={kind} className={`min-w-0 cursor-pointer rounded-card border p-4 transition ${values.kind === kind ? "border-accent bg-accent-soft ring-1 ring-accent" : "border-line bg-white hover:border-accent/50"}`}>
              <span className="mb-3 flex items-center justify-between"><span aria-hidden className="text-2xl font-bold text-accent">{KIND_GUIDE[kind].icon}</span><input type="radio" name="kind" value={kind} checked={values.kind === kind} onChange={() => set("kind", kind)} className="h-4 w-4 accent-[#1C4F3C]" /></span>
              <span className="block font-bold">{KIND_LABELS[kind]}</span><span className="mt-1 block text-sm text-soft">{KIND_GUIDE[kind].help}</span>
            </label>)}</div>
          </fieldset> : <p className="text-sm text-soft">Type : <span className="chip">{KIND_LABELS[values.kind]}</span> · Le type d’une publication reste inchangé.</p>}
          <section className="card space-y-5 p-5 sm:p-6" aria-label="Contenu de la publication">
            <div>
              <label htmlFor="title" className="label">{guide.title}</label>
              <input id="title" value={values.title} maxLength={200} placeholder={values.kind === "question" ? "Une question précise pour lancer l’échange…" : "Un titre clair qui donne envie de lire…"} onChange={e => set("title", e.target.value)} className={`field ${fields.title ? "field-invalid" : ""}`} {...errorProps("title")} />
              <p className="mt-1 text-right text-xs text-muted">{values.title.length}/200</p>{fieldError("title")}
            </div>
            <div>
              <label htmlFor="body" className="label">{values.kind === "news" ? "Texte ou résumé" : values.kind === "question" ? "Le contexte de votre question" : "Votre retour d’expérience"}</label>
              <MentionTextarea id="body" rows={9} maxLength={10000} value={values.body} placeholder={guide.body} onValueChange={body => set("body", body)} className={`field ${fields.body ? "field-invalid" : ""}`} {...errorProps("body")} />
              <p className="mt-1 text-right text-xs text-muted">{values.body.length.toLocaleString("fr")}/10 000</p>{fieldError("body")}
            </div>
            {!editing && <PhotoPicker images={values.images ?? []} onChange={images => set("images", images)} />}
            <fieldset id="post-themes" tabIndex={-1}>
              <legend className="label">Quels thèmes ? <span className="font-normal text-muted">1 à 3</span></legend>
              <ThemePicker themes={themes} selected={values.themeIds} onChange={ids => set("themeIds", ids)} max={3} invalid={Boolean(fields.themeIds)} describedBy={fields.themeIds ? "themeIds-error" : undefined} />
              {fieldError("themeIds")}
            </fieldset>
          </section>
          <section className="card space-y-5 p-5 sm:p-6" aria-label="Sources et liens">
            <fieldset>
              <legend className="label">Sources <span className="font-normal text-muted">· facultatif{values.kind === "news" ? ", mais un lien vers l’article d’origine aide les autres à vérifier" : ""}</span></legend>
              <p className="mb-3 text-sm text-soft">{values.kind === "news" ? "Donnez à chacun la possibilité de retrouver l’information d’origine." : "Ajoutez les références qui aident à comprendre votre contribution."}</p>
              <div className="space-y-2">{sources.map((source, index) => <div key={index} className="flex gap-2">
                <input id={`source-${index}`} type="url" inputMode="url" placeholder="https://" aria-label={`Source ${index + 1}`} value={source} onChange={e => set("sources", sources.map((s, i) => i === index ? e.target.value : s))} className={`field min-w-0 ${fields.sources ? "field-invalid" : ""}`} {...errorProps("sources")} />
                {sources.length > 1 && <button type="button" className="btn-secondary px-3" aria-label={`Retirer la source ${index + 1}`} onClick={() => set("sources", sources.filter((_, i) => i !== index))}>✕</button>}
              </div>)}</div>
              {fieldError("sources")}
              {sources.length < 5 && <button type="button" className="btn-link mt-3" onClick={() => set("sources", [...sources, ""])}>+ Ajouter une source</button>}
            </fieldset>
            {values.kind !== "question" && <div className="border-t border-line pt-5">
              <label htmlFor="demoUrl" className="label">{values.kind === "news" ? "Lien de démonstration (facultatif)" : "Lien de l’outil testé (facultatif)"}</label>
              <input id="demoUrl" type="url" inputMode="url" placeholder="https://" value={values.demoUrl} onChange={e => set("demoUrl", e.target.value)} className={`field ${fields.demoUrl ? "field-invalid" : ""}`} {...errorProps("demoUrl")} />
              {fieldError("demoUrl")}<p className="hint">Un bouton « Tester » mènera vers ce service externe.</p>
            </div>}
          </section>
        </>}
        <div className="card flex flex-wrap items-center justify-between gap-3 p-4">
          <p className="text-sm text-soft">{preview ? "L’envoi se fait uniquement avec le bouton ci-dessous." : "Vous pourrez tout relire avant l’envoi."}</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={busy} className="btn-secondary" onClick={() => router.back()}>Annuler</button>
            <button type="submit" disabled={busy} className="btn-primary">{busy ? "Enregistrement…" : preview ? editing ? "Enregistrer les modifications" : "Publier maintenant" : "Voir l’aperçu →"}</button>
          </div>
        </div>
      </form>
      <aside className="space-y-4 lg:sticky lg:top-28" aria-label="Conseils de rédaction">
        <section className="rounded-card bg-accent-soft p-5">
          <h2 className="font-bold text-accent">Pour une discussion utile</h2>
          <p className="mt-3 text-sm leading-relaxed text-soft">{guide.tip}</p>
          <p className="mt-3 text-sm leading-relaxed text-soft">Choisissez les thèmes qui aideront les bonnes personnes à vous trouver.</p>
        </section>
        <section className="card p-5">
          <h2 className="font-bold">Et après ?</h2>
          <p className="mt-2 text-sm leading-relaxed text-soft">Votre contribution rejoint le fil. Les membres peuvent commenter, et vous pouvez créer un salon pour poursuivre la discussion.</p>
          <Link href="/regles" target="_blank" rel="noopener noreferrer" className="btn-link mt-3 inline-block">Les règles de la communauté ↗</Link>
        </section>
      </aside>
    </div>}
  </div>;
}
