import { AnnouncementDetail } from "@/features/announcements/announcement-detail";
export default async function AnnouncementDetailPage({params}:{params:Promise<{id:string}>}){const {id}=await params;return <AnnouncementDetail id={id}/>;}
