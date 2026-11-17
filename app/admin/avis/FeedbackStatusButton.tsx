"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/client";

export function FeedbackStatusButton({ id, status }: { id: string; status: "nouveau" | "traite" }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const next = status === "nouveau" ? "traite" : "nouveau";
  return (
    <button
      type="button"
      disabled={busy}
      className="btn-secondary px-3 py-1.5 text-sm"
      onClick={async () => {
        setBusy(true);
        const result = await api("PATCH", `/api/admin/avis/${id}`, { status: next });
        setBusy(false);
        if (result.ok) router.refresh();
      }}
    >
      {status === "nouveau" ? "Marquer traité" : "Rouvrir"}
    </button>
  );
}
