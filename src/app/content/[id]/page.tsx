import { ContentDetail } from "@/features/content/content-detail";
export default async function ContentDetailPage({params}:{params:Promise<{id:string}>}){const {id}=await params;return <ContentDetail id={id}/>;}
