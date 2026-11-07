import { ApplicationDetail } from "@/features/applications/application-detail";
export default async function ApplicationDetailPage({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; return <ApplicationDetail id={id} />; }
