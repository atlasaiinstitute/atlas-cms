import { notFound } from "next/navigation";
import { PublicWebsite } from "@/features/public-site/public-website";
import { getPublicOrganization, getPublicSiteData } from "@/features/public-site/public-site";
import type { PublicSiteData } from "@/features/public-site/types";

export default function HomePage() {
  const organization = getPublicOrganization();
  if (!organization) notFound();
  const data = getPublicSiteData(organization.id, organization.publicSettings);
  if (!data) notFound();
  return <PublicWebsite organization={organization} data={{ ...data, organizationId: organization.id } as PublicSiteData} />;
}
