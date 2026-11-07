import { AnnouncementDashboard } from "@/features/announcements/announcement-dashboard";

export default async function CommunityAnnouncementsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AnnouncementDashboard scopeLabel="Community announcements" communityId={id} />;
}
