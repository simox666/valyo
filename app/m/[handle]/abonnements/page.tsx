import type { Metadata } from "next";
import { FollowPage } from "@/components/FollowPage";

export const metadata: Metadata = { title: "Abonnements" };

export default async function FollowingPage({ params }: { params: Promise<{ handle: string }> }) {
  return <FollowPage handle={(await params).handle} direction="following" />;
}
