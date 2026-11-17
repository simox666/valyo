"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/client";

export interface ThemeOption {
  id: string;
  name: string;
}

export function NewRoomForm({ themes, postId, initialThemeId }: { themes: ThemeOption[]; postId: string | null; initialThemeId: string | null }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [themeId, setThemeId] = useState(initialThemeId ?? "");
  const [visibility, setVisibility] = useState<"public" | "private">("public");
  const [format, setFormat] = useState<"chat" | "chat_vocal">("chat");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const result = await api("POST", "/api/rooms", { name, description, themeId: themeId || null, visibility, format, postId });
    setBusy(false);
    if (result.ok) router.push(`/s/${result.data.roomId}`);
    else setError(result.data.error ?? "Création impossible.");
  }

  return (
    <form onSubmit={submit} className="card space-y-4 p-5">
      <label className="block font-semibold">
        Nom du salon
        <input value={name} onChange={(e) => setName(e.target.value)} required minLength={3} maxLength={60} className="input mt-1 w-full" />
      </label>
      <label className="block font-semibold">
        Courte description <span className="font-normal text-neutral-500">(facultative)</span>
        <input value={description} onChange={(e) => setDescription(e.target.value)} maxLength={280} className="input mt-1 w-full" />
      </label>
      <label className="block font-semibold">
        Thème
        <select value={themeId} onChange={(e) => setThemeId(e.target.value)} className="input mt-1 w-full">
          <option value="">Sans thème</option>
          {themes.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </label>
      <fieldset>
        <legend className="font-semibold">Accès</legend>
        <p className="mt-1 text-sm text-neutral-600">Fixé à la création : un salon privé ne devient jamais public par accident.</p>
        <div className="mt-2 flex flex-wrap gap-4">
          <label className="inline-flex items-center gap-2">
            <input type="radio" name="visibility" checked={visibility === "public"} onChange={() => setVisibility("public")} />
            Public
          </label>
          <label className="inline-flex items-center gap-2">
            <input type="radio" name="visibility" checked={visibility === "private"} onChange={() => setVisibility("private")} />
            Sur invitation
          </label>
        </div>
      </fieldset>
      <fieldset>
        <legend className="font-semibold">Format</legend>
        <div className="mt-2 flex flex-wrap gap-4">
          <label className="inline-flex items-center gap-2">
            <input type="radio" name="format" checked={format === "chat"} onChange={() => setFormat("chat")} />
            Chat uniquement
          </label>
          <label className="inline-flex items-center gap-2">
            <input type="radio" name="format" checked={format === "chat_vocal"} onChange={() => setFormat("chat_vocal")} />
            Chat + vocal (le vocal arrive plus tard)
          </label>
        </div>
      </fieldset>
      {error && <p className="error-text">{error}</p>}
      <button type="submit" disabled={busy} className="btn-primary px-4 py-2">
        Créer le salon
      </button>
    </form>
  );
}
