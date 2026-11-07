import { notFound } from "next/navigation";
import { PublicWebsite } from "@/features/public-site/public-website";
import { getPublicOrganization, getPublicSiteData } from "@/features/public-site/public-site";
import type { PublicSiteData } from "@/features/public-site/types";

export function PublicRoute({ section }: { section: string }) {
  const organization = getPublicOrganization();
  if (!organization) notFound();
  const data = getPublicSiteData(organization.id, organization.publicSettings);
  if (!data) notFound();
  return <PublicWebsite organization={organization} data={{ ...data, organizationId: organization.id } as PublicSiteData} section={section} />;
}
