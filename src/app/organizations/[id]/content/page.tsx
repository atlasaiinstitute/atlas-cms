import { ContentDashboard } from "@/features/content/content-dashboard";
export default async function OrganizationContentPage({params}:{params:Promise<{id:string}>}){const {id}=await params;return <ContentDashboard scopeLabel="Organization content" organizationId={id}/>;}
