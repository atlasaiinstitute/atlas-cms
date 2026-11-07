import { ResourceDashboard } from "@/features/resources/resource-dashboard";

export default async function OrganizationResourcesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ResourceDashboard scopeLabel="Organization resource library" organizationId={id} />;
}
