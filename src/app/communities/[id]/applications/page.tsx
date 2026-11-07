import { ApplicationDashboard } from "@/features/applications/application-dashboard";
export default async function CommunityApplicationsPage({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; return <ApplicationDashboard scopeLabel="Community applications" communityId={id} />; }
