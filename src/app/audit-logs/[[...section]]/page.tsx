import { AppShell } from "@/components/app-shell";
import { AuditWorkspace } from "@/features/audit-logs/audit-workspace";

type PageProps = { params: Promise<{ section?: string[] }>; searchParams: Promise<Record<string, string | string[] | undefined>> };
export default async function AuditLogsPage({ params, searchParams }: PageProps) {
  const [{ section = [] }, query] = await Promise.all([params, searchParams]);
  return <AppShell><AuditWorkspace section={section} initialSearch={query} /></AppShell>;
}
