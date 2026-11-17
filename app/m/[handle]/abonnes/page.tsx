import type { Metadata } from "next";
import { FollowPage } from "@/components/FollowPage";

export const metadata: Metadata = { title: "Abonnés" };

export default async function FollowersPage({ params }: { params: Promise<{ handle: string }> }) {
  return <FollowPage handle={(await params).handle} direction="followers" />;
}
