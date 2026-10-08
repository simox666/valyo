"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

export interface SessionUser {
  email: string;
  totalPoints: number;
  badge: string | null;
  nextBadge: { key: string; threshold: number } | null;
}

export function useSession() {
  const [state, setState] = useState<{ loading: boolean; user: SessionUser | null }>({
    loading: true,
    user: null,
  });

  useEffect(() => {
    let cancelled = false;
    let interval: ReturnType<typeof setInterval> | undefined;

    function poll() {
      fetch("/api/me")
        .then((r) => r.json())
        .then((data: { user: SessionUser | null }) => {
          if (cancelled) return;
          setState({ loading: false, user: data.user });
          // The magic link is usually opened in a new tab (email client +
          // browser on the same device) — this tab wouldn't otherwise know
          // sign-in succeeded, since the session cookie lands on the other
          // tab's navigation, not this one's. Cookies are shared across
          // tabs on the same browser, so a short poll picks it up without
          // the user having to manually come back and refresh.
          if (data.user && interval) clearInterval(interval);
        })
        .catch(() => {
          if (!cancelled) setState({ loading: false, user: null });
        });
    }

    poll();
    interval = setInterval(poll, 3000);
    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
    };
  }, []);

  return state;
}

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const t = useTranslations("authGate");
  const locale = useLocale();
  const { loading, user } = useSession();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  async function submit() {
    setBusy(true);
    setError(false);
    try {
      const res = await fetch("/api/auth/request-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          locale,
          redirect: window.location.pathname + window.location.search,
        }),
      });
      if (!res.ok) throw new Error("request_failed");
      setSent(true);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  if (loading) return null;
  if (user) return <>{children}</>;

  if (sent) {
    return <p className="text-sm text-neutral-600 text-center py-6">{t("checkEmail")}</p>;
  }

  return (
    <div className="space-y-3 text-center py-4">
      <p className="text-sm text-neutral-600">{t("prompt")}</p>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder={t("emailPlaceholder")}
        className="w-full rounded-lg border border-neutral-300 p-3 text-center"
      />
      {error && <p className="text-xs text-red-600">{t("error")}</p>}
      <button
        onClick={submit}
        disabled={busy || email.trim().length === 0}
        className="w-full rounded-full bg-ink text-white py-3 font-medium disabled:opacity-50"
      >
        {t("send")}
      </button>
    </div>
  );
}
