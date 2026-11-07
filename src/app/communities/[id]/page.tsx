import { notFound } from "next/navigation";
import { CommunityDetail } from "@/features/communities/community-detail";
import { getDevelopmentCommunityWorkspace } from "@/services/communities";

export default async function CommunityDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const workspace = await getDevelopmentCommunityWorkspace(id);
  if (!workspace) notFound();
  return <CommunityDetail workspace={workspace} />;
}
