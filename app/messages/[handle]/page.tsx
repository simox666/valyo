import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { canMessage, findRecipient, readThread } from "@/lib/social/messages.ts";
import { Avatar } from "@/components/Avatar";
import { Thread } from "./Thread";

export const metadata: Metadata = { robots: { index: false }, title: "Conversation" };

export default async function ConversationPage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/connexion?next=${encodeURIComponent(`/messages/${handle}`)}`);
  if (!user.onboarded) redirect(`/bienvenue?next=${encodeURIComponent(`/messages/${handle}`)}`);
  const other = await findRecipient(db.query, user.id, handle);
  if (!other.ok) notFound();
  const [messages, allowed] = await Promise.all([readThread(db.query, user.id, other.value.id), canMessage(db.query, user.id, other.value.id)]);

  return (
    <div className="flex flex-col gap-3">
      <Link href="/messages" className="btn-link">← Messages</Link>
      <header className="card flex items-center gap-3 p-4">
        <Avatar name={other.value.displayName} seed={other.value.handle} size="md" imageId={other.value.avatarId} />
        <div className="min-w-0 flex-1">
          <h1 className="text-base font-semibold">{other.value.displayName}</h1>
          <Link href={`/m/${other.value.handle}`} className="text-sm text-muted hover:underline">@{other.value.handle} · voir le profil</Link>
        </div>
      </header>
      <Thread handle={other.value.handle} name={other.value.displayName} initial={messages} canSend={allowed} />
    </div>
  );
}
