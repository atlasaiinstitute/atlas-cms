import { MessagingInbox } from "@/features/messaging/messaging-inbox";

export default async function CommunityMessagesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <MessagingInbox scopeLabel="Community messages" communityId={id} />;
}
