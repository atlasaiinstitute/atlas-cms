import { CommitteeDetail } from "@/features/committees/committee-detail";
export default async function CommitteeDetailPage({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; return <CommitteeDetail id={id} />; }
