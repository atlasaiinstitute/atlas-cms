import { EventDashboard } from "@/features/events/event-dashboard";
export default async function CommunityEventsPage({params}:{params:Promise<{id:string}>}){const {id}=await params;return <EventDashboard scopeLabel="Community events" communityId={id}/>;}
