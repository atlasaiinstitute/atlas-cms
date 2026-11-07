import { EventDashboard } from "@/features/events/event-dashboard";
export default async function OrganizationEventsPage({params}:{params:Promise<{id:string}>}){const {id}=await params;return <EventDashboard scopeLabel="Organization events" organizationId={id}/>;}
