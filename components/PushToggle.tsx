"use client";

import { useEffect, useState } from "react";

// Activation des notifications push sur CET appareil. L'abonnement appartient au navigateur :
// il faut l'activer sur chaque appareil où l'on veut être prévenu.

type State = "loading" | "unsupported" | "ios-install" | "denied" | "off" | "on";

function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const padded = (base64url + "=".repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

/** Désabonne cet appareil, côté serveur puis côté navigateur. Sans effet s'il n'était pas abonné. */
export async function unsubscribeThisDevice(): Promise<void> {
  try {
    if (!("serviceWorker" in navigator)) return;
    const registration = await navigator.serviceWorker.getRegistration("/");
    const subscription = await registration?.pushManager?.getSubscription();
    if (!subscription) return;
    await fetch("/api/push", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: subscription.endpoint }) });
    await subscription.unsubscribe();
  } catch { /* Au pire l'abonnement expirera : le serveur le retire au premier envoi refusé. */ }
}

export function PushToggle() {
  const [state, setState] = useState<State>("loading");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [testNote, setTestNote] = useState("");

  useEffect(() => {
    (async () => {
      const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
      if (!supported) {
        // iPhone/iPad : le push n'existe que pour un site ajouté à l'écran d'accueil.
        const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
        setState(ios ? "ios-install" : "unsupported");
        return;
      }
      if (Notification.permission === "denied") { setState("denied"); return; }
      const registration = await navigator.serviceWorker.getRegistration("/");
      const subscription = await registration?.pushManager.getSubscription();
      setState(subscription && Notification.permission === "granted" ? "on" : "off");
    })().catch(() => setState("unsupported"));
  }, []);

  async function enable() {
    setBusy(true);
    setError("");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") { setState(permission === "denied" ? "denied" : "off"); return; }
      const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      await navigator.serviceWorker.ready;
      const keyResponse = await fetch("/api/push", { cache: "no-store" });
      if (!keyResponse.ok) throw new Error("clé");
      const { publicKey } = await keyResponse.json();
      const subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) });
      const saved = await fetch("/api/push", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(subscription.toJSON()) });
      if (!saved.ok) { await subscription.unsubscribe().catch(() => {}); throw new Error("enregistrement"); }
      setState("on");
    } catch {
      setError("L’activation n’a pas abouti. Réessayez dans un instant.");
    } finally {
      setBusy(false);
    }
  }

  async function test() {
    setBusy(true);
    setError("");
    setTestNote("");
    try {
      const response = await fetch("/api/push/test", { method: "POST" });
      const data = await response.json().catch(() => ({}));
      if (response.ok) setTestNote(`Notification de test envoyée à ${data.sent} appareil${data.sent > 1 ? "s" : ""}. Elle arrive en quelques secondes.`);
      else setError(data.error ?? "Le test n’a pas abouti.");
    } catch {
      setError("Connexion impossible. Réessayez.");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    await unsubscribeThisDevice();
    setState("off");
    setBusy(false);
  }

  return (
    <section className="card p-5">
      <h2 className="font-bold">Notifications sur cet appareil</h2>
      {state === "loading" && <p className="mt-2 text-sm text-muted">Vérification…</p>}
      {state === "on" && (
        <>
          <p className="mt-2 text-sm leading-relaxed text-soft">Activées : réponses, mentions, messages privés et salons suivis vous parviennent même site fermé.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" disabled={busy} onClick={test} className="btn-primary">Envoyer un test</button>
            <button type="button" disabled={busy} onClick={disable} className="btn-secondary">Désactiver</button>
          </div>
          {testNote && <p role="status" className="mt-2 text-sm text-accent">{testNote}</p>}
        </>
      )}
      {state === "off" && (
        <>
          <p className="mt-2 text-sm leading-relaxed text-soft">Soyez prévenu d’une réponse, d’une mention, d’un message privé ou d’un message dans un salon suivi, même site fermé.</p>
          <button type="button" disabled={busy} onClick={enable} className="btn-primary mt-3">Activer les notifications</button>
        </>
      )}
      {state === "denied" && <p className="mt-2 text-sm leading-relaxed text-soft">Les notifications sont bloquées pour Valyo dans ce navigateur. Autorisez-les dans les réglages du site, puis rechargez la page.</p>}
      {state === "ios-install" && (
        <p className="mt-2 text-sm leading-relaxed text-soft">
          Sur iPhone et iPad, ajoutez d’abord Valyo à l’écran d’accueil : dans Safari, touchez <strong>Partager</strong> puis <strong>Sur l’écran d’accueil</strong>. Ouvrez
          ensuite Valyo depuis cette icône et revenez ici pour activer les notifications.
        </p>
      )}
      {state === "unsupported" && <p className="mt-2 text-sm leading-relaxed text-soft">Ce navigateur ne permet pas les notifications push.</p>}
      {error && <p className="error-text">{error}</p>}
    </section>
  );
}
