"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/client";

function useAction() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  async function run(method: string, url: string, body: unknown, success: string) {
    setBusy(true);
    setMessage(null);
    const result = await api(method, url, body);
    setBusy(false);
    setMessage(result.ok ? { ok: true, text: success } : { ok: false, text: result.data.error ?? "Action impossible." });
    if (result.ok) router.refresh();
    return result;
  }
  const feedback = message && (
    <p role={message.ok ? "status" : "alert"} className={message.ok ? "text-sm font-semibold text-accent" : "error-text"}>{message.text}</p>
  );
  return { busy, run, feedback };
}

export function ReportActions({
  reportId,
  targetUserId,
  targetKind,
  targetId,
}: {
  reportId: string;
  targetUserId: string | null;
  targetKind: string;
  targetId: string;
}) {
  const { busy, run, feedback } = useAction();
  const [reason, setReason] = useState("");
  const [context, setContext] = useState<{ author: string; body: string | null; created_at: string; signale: boolean }[] | null>(null);

  const act = (kind: string, extra: Record<string, unknown> = {}) => {
    if (!targetUserId) return;
    return run("POST", "/api/admin/moderation/actions", { targetUserId, reportId, kind, reason, ...extra }, "Action enregistrée, décision notifiée.");
  };
  const contentKind = targetKind === "post" || targetKind === "comment" || targetKind === "message" ? targetKind : undefined;

  async function loadContext() {
    const result = await run("POST", `/api/admin/moderation/reports/${reportId}`, { action: "context" }, "Contexte consulté (consultation journalisée).");
    if (result.ok) setContext(result.data.messages as never);
  }

  return (
    <div className="mt-2 space-y-2 text-sm">
      <label className="block">
        Motif de la décision (notifié à la personne concernée)
        <input value={reason} onChange={(e) => setReason(e.target.value)} minLength={5} maxLength={500} className="input mt-1 w-full" />
      </label>
      <div className="flex flex-wrap gap-2">
        {contentKind && (
          <button type="button" disabled={busy || reason.length < 5} className="btn-secondary px-2 py-1" onClick={() => act("remove_content", { contentKind, contentId: targetId })}>
            Retirer le contenu
          </button>
        )}
        <button type="button" disabled={busy || reason.length < 5} className="btn-secondary px-2 py-1" onClick={() => act("warn")}>
          Avertir
        </button>
        <button type="button" disabled={busy || reason.length < 5} className="btn-secondary px-2 py-1" onClick={() => act("suspend", { durationDays: 7 })}>
          Suspendre 7 j
        </button>
        <button type="button" disabled={busy || reason.length < 5} className="btn-secondary px-2 py-1" onClick={() => act("ban")}>
          Bannir
        </button>
        <button
          type="button"
          disabled={busy || reason.length < 3}
          className="btn-link"
          onClick={() => run("POST", `/api/admin/moderation/reports/${reportId}`, { action: "dismiss", reason }, "Classé sans suite.")}
        >
          Sans suite
        </button>
        {targetKind === "message" && (
          <button type="button" disabled={busy} className="btn-link" onClick={loadContext}>
            Contexte borné (journalisé)
          </button>
        )}
      </div>
      {context && (
        <ol className="rounded-card border border-line p-2">
          {context.map((m, i) => (
            <li key={i} className={m.signale ? "bg-amber-50 font-semibold" : ""}>
              <span className="text-muted">{new Date(m.created_at).toLocaleTimeString("fr-BE")}</span> {m.author} :{" "}
              {m.body ?? <em>message retiré</em>}
            </li>
          ))}
        </ol>
      )}
      {feedback}
    </div>
  );
}

export function AppealDecision({ appealId }: { appealId: string }) {
  const { busy, run, feedback } = useAction();
  const [reason, setReason] = useState("");
  return (
    <div className="mt-2 space-y-2 text-sm">
      <label className="block">
        Réponse motivée
        <input value={reason} onChange={(e) => setReason(e.target.value)} minLength={5} maxLength={1000} className="input mt-1 w-full" />
      </label>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={busy || reason.length < 5}
          className="btn-secondary px-2 py-1"
          onClick={() => run("POST", `/api/admin/moderation/appeals/${appealId}`, { decision: "levee", reason }, "Sanction levée, décision notifiée.")}
        >
          Lever la sanction
        </button>
        <button
          type="button"
          disabled={busy || reason.length < 5}
          className="btn-secondary px-2 py-1"
          onClick={() => run("POST", `/api/admin/moderation/appeals/${appealId}`, { decision: "maintenue", reason }, "Sanction maintenue, décision notifiée.")}
        >
          Maintenir
        </button>
      </div>
      {feedback}
    </div>
  );
}

export function LiftSanction({ actionId, targetUserId }: { actionId: string; targetUserId: string }) {
  const { busy, run, feedback } = useAction();
  const [reason, setReason] = useState("");
  return <form className="mt-2 space-y-2" onSubmit={async (event) => {
    event.preventDefault();
    if (!confirm("Lever uniquement cette sanction ? Les autres sanctions restent applicables.")) return;
    await run("POST", "/api/admin/moderation/actions", { actionId, targetUserId, kind: "lift", reason }, "Cette sanction est levée. Les autres décisions restent applicables.");
  }}>
    <label className="label" htmlFor={`lift-${actionId}`}>Motif de la levée</label>
    <input id={`lift-${actionId}`} className="field" required minLength={5} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />
    <button className="btn-secondary" disabled={busy || reason.trim().length < 5}>Lever cette sanction</button>
    {feedback}
  </form>;
}
