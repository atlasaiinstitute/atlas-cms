import { OrganizationDetail } from "@/features/organizations/organization-detail";
import { getOrganizationWorkspace } from "@/services/organizations";
import { notFound } from "next/navigation";

export default async function OrganizationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const workspace = await getOrganizationWorkspace(id);
  if (!workspace) notFound();
  return <OrganizationDetail workspace={workspace} />;
}
