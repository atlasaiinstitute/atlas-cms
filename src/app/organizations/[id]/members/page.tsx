import { MemberDirectory } from "@/features/members/member-directory";
export default async function OrganizationMembersPage({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; return <MemberDirectory scopeLabel="Organization members" organizationId={id} />; }
