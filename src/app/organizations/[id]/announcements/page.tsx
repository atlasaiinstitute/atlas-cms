import { AnnouncementDashboard } from "@/features/announcements/announcement-dashboard";

export default async function OrganizationAnnouncementsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AnnouncementDashboard scopeLabel="Organization announcements" organizationId={id} />;
}
