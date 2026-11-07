import { MemberDirectory } from "@/features/members/member-directory";
export default async function CommunityMembersPage({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; return <MemberDirectory scopeLabel="Community members" communityId={id} />; }
