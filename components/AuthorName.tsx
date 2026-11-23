import Link from "next/link";
import type { Author } from "@/lib/data/posts";
import { Avatar } from "./Avatar";

export function AuthorName({ author, avatar = true }: { author: Author; avatar?: boolean }) {
  if (author.isDeleted || !author.handle) {
    return (
      <span className="inline-flex items-center gap-1.5 text-muted">
        {avatar && <Avatar name={author.displayName} size="xs" deleted />}
        {author.displayName}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5">
      {avatar && <Avatar name={author.displayName} seed={author.handle} size="xs" agent={author.isAgent} imageId={author.avatarId} />}
      <Link href={`/m/${author.handle}`} className="font-semibold hover:underline">
        {author.displayName}
      </Link>
      {author.isAgent && <span className="chip bg-accent-soft text-accent">Agent éditorial</span>}
    </span>
  );
}
