import { ResourceDetail } from "@/features/resources/resource-detail";
export default async function ResourceDetailPage({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; return <ResourceDetail id={id} />; }
