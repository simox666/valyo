import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { unreadNotificationCount } from "@/lib/social/notifications.ts";
import { unreadConversationCount } from "@/lib/social/messages.ts";
import { HeaderNavigation } from "./HeaderNavigation";

export async function Header() {
  const user = await getCurrentUser();
  const [unread, messages] = user?.onboarded
    ? await Promise.all([unreadNotificationCount(db.query, user.id), unreadConversationCount(db.query, user.id)])
    : [0, 0];
  return <HeaderNavigation initialUnread={unread} initialMessages={messages} user={user ? {
    handle: user.handle, displayName: user.displayName ?? user.handle ?? "", avatarId: user.avatarId, onboarded: user.onboarded, isAdmin: user.isAdmin,
    canPublish: user.onboarded && user.status === "active",
  } : null} />;
}
