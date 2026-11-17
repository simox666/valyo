import Link from "next/link";

// Texte avec mentions @pseudo cliquables (profil du membre). Composant pur, utilisable
// côté serveur comme côté client. React échappe le texte : rien d'autre n'est interprété.

const RENDER_RE = /(^|[^\w@/])@([a-zA-Z0-9_]{3,24})\b/g;

export function MentionText({ text }: { text: string }) {
  const parts: React.ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(RENDER_RE)) {
    const start = (m.index ?? 0) + m[1].length;
    if (start > last) parts.push(text.slice(last, start));
    parts.push(
      <Link key={start} href={`/m/${m[2].toLowerCase()}`} className="font-semibold text-accent hover:underline">
        @{m[2]}
      </Link>,
    );
    last = start + m[2].length + 1;
  }
  if (parts.length === 0) return <>{text}</>;
  if (last < text.length) parts.push(text.slice(last));
  return <>{parts}</>;
}
