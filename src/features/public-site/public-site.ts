import { organizationFixtures } from "@/data/mock/organizations";
import { communityFixtures } from "@/data/mock/communities";
import { contentFixtures } from "@/data/mock/content";
import { eventFixtures } from "@/data/mock/events";
import { announcementFixtures } from "@/data/mock/announcements";
import { resourceFixtures } from "@/data/mock/resources";
import { committeeFixtures } from "@/data/mock/governance";

export type PublicAccessSettings = {
  publicWebsiteEnabled: boolean;
  publicBrowsingEnabled: boolean;
  publicRegistrationEnabled: boolean;
  membershipApplicationsEnabled: boolean;
  commentsRequireLogin: boolean;
  reactionsRequireLogin: boolean;
  messagingRequiresLogin: boolean;
  postingRequiresLogin: boolean;
  eventRegistrationRequiresAccount: boolean;
  publicProfilesEnabled: boolean;
  publicContentTypes: string[];
  publiclyDownloadableResources: boolean;
  publicCommunityPagesEnabled: boolean;
  disabledFeatures: string[];
};

export const defaultPublicAccessSettings: PublicAccessSettings = {
  publicWebsiteEnabled: true,
  publicBrowsingEnabled: true,
  publicRegistrationEnabled: false,
  membershipApplicationsEnabled: false,
  commentsRequireLogin: true,
  reactionsRequireLogin: true,
  messagingRequiresLogin: true,
  postingRequiresLogin: true,
  eventRegistrationRequiresAccount: true,
  publicProfilesEnabled: false,
  publicContentTypes: ["article", "news", "research_report", "policy_brief", "publication", "report", "page"],
  publiclyDownloadableResources: true,
  publicCommunityPagesEnabled: true,
  disabledFeatures: [],
};

export type PublicOrganization = (typeof organizationFixtures)[number] & {
  publicSettings: PublicAccessSettings;
  branding: { displayName: string; eyebrow: string; welcomeMessage: string; footerText: string; logoUrl: string | null };
};

export function getPublicOrganization(slug = "atlas-ai-institute"): PublicOrganization | null {
  const organization = organizationFixtures.find((item) => item.slug === slug && item.status === "active");
  if (!organization) return null;
  return {
    ...organization,
    publicSettings: defaultPublicAccessSettings,
    branding: {
      displayName: organization.name,
      eyebrow: organization.organization_type ?? "Institutional network",
      welcomeMessage: "Research, policy, and practical work for a more accountable digital future.",
      footerText: "A public website experience powered by ATLAS CMS.",
      logoUrl: organization.logo_url,
    },
  };
}

export function resolvePublicOrganization(input: { slug?: string; hostname?: string }): PublicOrganization | null {
  if (input.slug) return getPublicOrganization(input.slug);
  const host = input.hostname?.toLowerCase().replace(/^www\./, "");
  const match = host && organizationFixtures.find((organization) => organization.status === "active" && organization.website?.replace(/^https?:\/\//, "").replace(/\/$/, "") === host);
  return match ? getPublicOrganization(match.slug) : getPublicOrganization();
}

export function getPublicSiteData(organizationId: string, settings = defaultPublicAccessSettings) {
  const organization = organizationFixtures.find((item) => item.id === organizationId && item.status === "active");
  if (!organization || !settings.publicWebsiteEnabled || !settings.publicBrowsingEnabled) return null;
  const publicCommunities = settings.publicCommunityPagesEnabled
    ? communityFixtures.filter((item) => item.organization_id === organizationId && item.status === "active" && item.visibility === "public")
    : [];
  const publicContent = contentFixtures.filter((item) => item.organization_id === organizationId && item.status === "published" && item.published_at && settings.publicContentTypes.includes(item.content_type));
  const publicEvents = eventFixtures.filter((item) => item.organization_id === organizationId && ["published", "registration_open"].includes(item.status));
  const publicAnnouncements = announcementFixtures.filter((item) => item.organization_id === organizationId && item.status === "published" && item.visibility === "public");
  const publicResources = resourceFixtures.filter((item) => item.organization_id === organizationId && item.status === "published" && item.visibility === "public");
  const publicCommittees = committeeFixtures.filter((item) => item.organization_id === organizationId && item.status === "active");
  const publicEducation = publicContent.filter((item) => item.category === "Education" || item.community_name?.toLowerCase().includes("education"));
  return { organization, publicCommunities, publicContent, publicEvents, publicAnnouncements, publicResources, publicCommittees, publicEducation, missingSources: { projects: "No dedicated projects/initiatives module exists in the current CMS source model; no project records are invented for the public site.", leadership: "Leadership profiles and approved appointments are not yet present as a public projection in the current source model; private member records are not exposed." } };
}

export function isProtectedAction(action: "create_post" | "edit_post" | "message" | "comment" | "react" | "upload" | "manage_organization" | "private_document") {
  return ["create_post", "edit_post", "message", "comment", "react", "upload", "manage_organization", "private_document"].includes(action);
}

export function registrationDecision(settings = defaultPublicAccessSettings) {
  return settings.publicRegistrationEnabled
    ? { allowed: true, message: "Registration is enabled by this organization and remains subject to verification rules." }
    : { allowed: false, message: "Public registration is disabled. Use an administrator-issued invitation or an approved membership application." };
}
