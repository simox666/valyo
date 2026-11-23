"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, loginUrl } from "@/lib/client";

export function FollowButton({
  target,
  keyValue,
  initialFollowing,
  signedIn,
  label,
}: {
  target: "member" | "theme";
  keyValue: string;
  initialFollowing: boolean;
  signedIn: boolean;
  label: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [following, setFollowing] = useState(initialFollowing);
  // Le même bouton sert d'un thème (ou d'un membre) à l'autre quand on navigue : il doit reprendre
  // l'état de la nouvelle cible, pas garder « Suivi » de la précédente.
  useEffect(() => { setFollowing(initialFollowing); setError(null); }, [initialFollowing, keyValue, target]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    if (!signedIn) {
      router.push(loginUrl(pathname + window.location.search));
      return;
    }
    setBusy(true);
    setError(null);
    const result = await api("POST", "/api/follows", { target, key: keyValue, follow: !following });
    setBusy(false);
    if (result.ok) {
      setFollowing(!following);
      router.refresh();
    } else if (result.status === 401) {
      router.push(loginUrl(pathname));
    } else {
      setError(result.data.error ?? "Action impossible.");
    }
  }

  return (
    <span className="inline-flex flex-col">
      <button
        type="button"
        onClick={toggle}
        disabled={busy}
        aria-pressed={following}
        className={following ? "btn-secondary" : "btn-primary"}
      >
        {following ? "Suivi ✓" : label ? `Suivre ${label}` : "Suivre"}
      </button>
      {error && (
        <span role="alert" className="error-text">
          {error}
        </span>
      )}
    </span>
  );
}
