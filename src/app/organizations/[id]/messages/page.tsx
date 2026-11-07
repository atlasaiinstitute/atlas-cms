import { MessagingInbox } from "@/features/messaging/messaging-inbox";

export default async function OrganizationMessagesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <MessagingInbox scopeLabel="Organization messages" organizationId={id} />;
}
