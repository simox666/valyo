"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/client";

function useCall() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function call(method: string, url: string, body?: unknown): Promise<{ ok: boolean; data: { error?: string } & Record<string, unknown> }> {
    setBusy(true);
    setError(null);
    const result = await api(method, url, body);
    setBusy(false);
    if (result.ok) router.refresh();
    else setError(result.data.error ?? "Action impossible.");
    return result;
  }
  return { busy, error, call };
}

const Feedback = ({ error }: { error: string | null }) => (error ? <p role="alert" className="error-text mt-1">{error}</p> : null);

export function JoinButton({ roomId, openChat = false }: { roomId: string; openChat?: boolean }) {
  const router = useRouter();
  const { busy, error, call } = useCall();
  return (
    <div>
      <button type="button" disabled={busy} onClick={async () => {
        const result = await call("POST", `/api/rooms/${roomId}/join`);
        if (result.ok) router.push(`/s/${roomId}#chat`);
      }} className="btn-primary px-4 py-2">
        {busy ? "Adhésion…" : openChat ? "Rejoindre et discuter" : "Rejoindre le salon"}
      </button>
      <Feedback error={error} />
    </div>
  );
}

export function MemberBar({ roomId, roomName, following, isOwner, archived }: { roomId: string; roomName: string; following: boolean; isOwner: boolean; archived: boolean }) {
  const router = useRouter();
  const { busy, error, call } = useCall();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmName, setConfirmName] = useState("");
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button type="button" disabled={busy} onClick={() => call("POST", `/api/rooms/${roomId}/follow`, { following: !following })} className="btn-secondary px-3 py-1.5">
        {following ? "Ne plus suivre" : "Suivre (notifications)"}
      </button>
      <button type="button" disabled={busy} onClick={() => call("POST", `/api/rooms/${roomId}/leave`)} className="btn-link">
        Quitter le salon
      </button>
      {isOwner && !archived && (
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            if (confirm("Archiver le salon ? Il restera lisible par ses membres, sans nouveaux messages ni invitations.")) {
              call("PATCH", `/api/rooms/${roomId}`, { archive: true });
            }
          }}
          className="btn-link"
        >
          Archiver
        </button>
      )}
      {isOwner && !confirmOpen && (
        <button type="button" disabled={busy} className="btn-link" onClick={() => setConfirmOpen(true)}>
          Supprimer…
        </button>
      )}
      {isOwner && confirmOpen && (
        <span className="inline-flex flex-wrap items-center gap-2">
          <label htmlFor="confirm-suppression-salon" className="text-sm text-neutral-700">
            Définitif pour tout le monde, messages compris. Tapez le nom du salon :
          </label>
          <input
            id="confirm-suppression-salon"
            value={confirmName}
            onChange={(e) => setConfirmName(e.target.value)}
            placeholder={roomName}
            autoComplete="off"
            className="field w-48 px-2 py-1 text-sm"
          />
          <button
            type="button"
            className="btn-danger px-3 py-1.5"
            disabled={busy || confirmName.trim() !== roomName.trim()}
            onClick={async () => {
              const result = await call("DELETE", `/api/rooms/${roomId}`, { confirm: confirmName });
              if (result.ok) router.push("/salons");
            }}
          >
            Supprimer définitivement
          </button>
          <button type="button" className="btn-link" onClick={() => setConfirmOpen(false)}>
            Annuler
          </button>
        </span>
      )}
      <Feedback error={error} />
    </div>
  );
}

export function InviteButton({ roomId }: { roomId: string }) {
  const { busy, error, call } = useCall();
  const [url, setUrl] = useState<string | null>(null);
  async function create() {
    const result = await call("POST", `/api/rooms/${roomId}/invitations`);
    if (result.ok) setUrl(String(result.data.url));
  }
  return (
    <div className="rounded-xl border border-line p-3 text-sm">
      <button type="button" disabled={busy} onClick={create} className="btn-secondary px-3 py-1.5">
        Créer un lien d’invitation (7 jours, usage unique)
      </button>
      {url && (
        <p className="mt-2 break-all">
          À transmettre maintenant — il ne sera plus affiché : <code>{typeof location !== "undefined" ? location.origin : ""}{url}</code>
        </p>
      )}
      <Feedback error={error} />
    </div>
  );
}

export function MemberActions({ roomId, userId, role, viewerIsOwner }: { roomId: string; userId: string; role: string; viewerIsOwner: boolean }) {
  const { busy, error, call } = useCall();
  const act = (body: unknown) => call("POST", `/api/rooms/${roomId}/members/${userId}`, body);
  return (
    <span className="inline-flex flex-wrap items-center gap-2 text-sm">
      {viewerIsOwner && role !== "owner" && (
        <>
          <button type="button" disabled={busy} className="btn-link" onClick={() => act({ action: "role", role: role === "moderator" ? "member" : "moderator" })}>
            {role === "moderator" ? "Retirer la modération" : "Nommer modérateur"}
          </button>
          <button type="button" disabled={busy} className="btn-link" onClick={() => call("POST", `/api/rooms/${roomId}/transfer`, { toUserId: userId })}>
            Proposer la propriété
          </button>
        </>
      )}
      {role !== "owner" && (
        <>
          <button
            type="button"
            disabled={busy}
            className="btn-link"
            onClick={() => {
              const reason = prompt("Motif de l'exclusion (retour possible après 24 h) :");
              if (reason) act({ action: "kick", reason });
            }}
          >
            Exclure
          </button>
          <button
            type="button"
            disabled={busy}
            className="btn-link"
            onClick={() => {
              const reason = prompt("Motif du bannissement (7 jours) :");
              if (reason) act({ action: "ban", days: 7, reason });
            }}
          >
            Bannir 7 j
          </button>
        </>
      )}
      <Feedback error={error} />
    </span>
  );
}

export function TransferBanner({ transferId, roomName }: { transferId: string; roomName: string }) {
  const { busy, error, call } = useCall();
  return (
    <div role="status" className="rounded-xl border border-amber-300 bg-amber-50 p-3">
      <p className="font-semibold">On vous propose la propriété du salon « {roomName} ».</p>
      <div className="mt-2 flex gap-3">
        <button type="button" disabled={busy} onClick={() => call("POST", `/api/transfers/${transferId}`, { answer: "accept" })} className="btn-primary px-3 py-1.5">
          Accepter
        </button>
        <button type="button" disabled={busy} onClick={() => call("POST", `/api/transfers/${transferId}`, { answer: "decline" })} className="btn-link">
          Refuser
        </button>
      </div>
      <Feedback error={error} />
    </div>
  );
}
