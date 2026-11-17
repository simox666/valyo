"use client";

import { useEffect, useState } from "react";

// Les dates sont stockées en UTC et affichées dans le fuseau du visiteur :
// le serveur ne le connaît pas, donc le formatage final se fait dans le navigateur.

function relative(date: Date): string | null {
  const seconds = Math.round((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "à l’instant";
  const rtf = new Intl.RelativeTimeFormat("fr", { numeric: "auto" });
  if (seconds < 3600) return rtf.format(-Math.floor(seconds / 60), "minute");
  if (seconds < 86400) return rtf.format(-Math.floor(seconds / 3600), "hour");
  if (seconds < 7 * 86400) return rtf.format(-Math.floor(seconds / 86400), "day");
  return null;
}

export function LocalTime({ iso, prefix = "", mode = "relative" }: { iso: string; prefix?: string; mode?: "relative" | "full" | "time" }) {
  const date = new Date(iso);
  const [text, setText] = useState(() => date.toISOString().slice(0, 10).split("-").reverse().join("/"));
  useEffect(() => {
    const full = date.toLocaleString("fr", { dateStyle: "long", timeStyle: "short" });
    setText(mode === "time" ? date.toLocaleTimeString("fr", { hour: "2-digit", minute: "2-digit" }) : mode === "relative" ? relative(date) ?? date.toLocaleDateString("fr", { dateStyle: "medium" }) : full);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [iso, mode]);
  return (
    <time dateTime={iso} title={date.toISOString()} suppressHydrationWarning>
      {prefix}
      {text}
    </time>
  );
}
