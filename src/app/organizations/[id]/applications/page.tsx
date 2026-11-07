import { ApplicationDashboard } from "@/features/applications/application-dashboard";
export default async function OrganizationApplicationsPage({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; return <ApplicationDashboard scopeLabel="Organization applications" organizationId={id} />; }
