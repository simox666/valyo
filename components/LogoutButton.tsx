"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/client";
import { unsubscribeThisDevice } from "./PushToggle";

export function LogoutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      className="btn-link"
      onClick={async () => {
        setBusy(true);
        // Appareil potentiellement partagé : plus de notifications de ce compte une fois déconnecté.
        await unsubscribeThisDevice();
        await api("POST", "/api/auth/logout");
        // Politique SEC-05 : la déconnexion purge les brouillons locaux de tous les comptes
        // (appareil potentiellement partagé), y compris l'ancienne clé commune.
        try {
          for (const key of Object.keys(localStorage)) {
            if (key.startsWith("valyo:brouillon-publication")) localStorage.removeItem(key);
          }
        } catch {}
        router.push("/");
        router.refresh();
      }}
    >
      Se déconnecter
    </button>
  );
}
