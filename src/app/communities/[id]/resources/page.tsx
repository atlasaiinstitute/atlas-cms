import { ResourceDashboard } from "@/features/resources/resource-dashboard";

export default async function CommunityResourcesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ResourceDashboard scopeLabel="Community resource library" communityId={id} />;
}
