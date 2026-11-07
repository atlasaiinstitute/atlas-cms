import { ContentDashboard } from "@/features/content/content-dashboard";
export default async function CommunityContentPage({params}:{params:Promise<{id:string}>}){const {id}=await params;return <ContentDashboard scopeLabel="Community content" communityId={id}/>;}
