import { ConversationView } from "@/features/messaging/conversation-view";
export default async function ConversationPage({params}:{params:Promise<{conversationId:string}>}){const {conversationId}=await params;return <ConversationView id={conversationId}/>;}
