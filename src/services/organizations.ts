import type { OrganizationSettings, UserProfile } from "@/types/database";
import type { OrganizationSummary, OrganizationWorkspace } from "@/features/organizations/contracts";
import { getOrganizationScopedQuery, requireOrganizationAccess, type TenantActor } from "@/lib/tenant/context";
import { organizationFixtures } from "@/data/mock/organizations";

const now = "2026-11-06T09:00:00.000Z";

const profiles: UserProfile[] = [
  { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", full_name: "Alex Morgan", email: "alex@atlas.ai", avatar_url: null, designation: "Platform Administrator", organization_name: "Atlas AI Institute", country: "United States", preferred_language: "en", profile_visibility: "members", created_at: now, updated_at: now },
  { id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", full_name: "Priya Shah", email: "priya@atlas.ai", avatar_url: null, designation: "Program Director", organization_name: "Atlas AI Institute", country: "India", preferred_language: "en", profile_visibility: "members", created_at: now, updated_at: now },
  { id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", full_name: "Daniel Wong", email: "daniel@atlas.ai", avatar_url: null, designation: "Community Lead", organization_name: "Atlas AI Institute", country: "Singapore", preferred_language: "en", profile_visibility: "members", created_at: now, updated_at: now },
];

export async function listOrganizations(): Promise<OrganizationSummary[]> { return organizationFixtures; }
export async function listOrganizationsForActor(actor: TenantActor): Promise<OrganizationSummary[]> {
  return organizationFixtures.filter((organization) => {
    try {
      requireOrganizationAccess(actor, organization.id, organization.status);
      return true;
    } catch {
      return false;
    }
  });
}

export async function listScopedRows<T extends { organization_id: string }>(actor: TenantActor, organizationId: string, rows: T[]): Promise<T[]> {
  const organization = organizationFixtures.find((item) => item.id === organizationId);
  if (!organization) return [];
  const context = requireOrganizationAccess(actor, organizationId, organization.status);
  return getOrganizationScopedQuery(context, rows);
}
export async function getOrganizationWorkspace(id: string): Promise<OrganizationWorkspace | null> {
  const organization = organizationFixtures.find((item) => item.id === id);
  if (!organization) return null;
  const settings: OrganizationSettings = { id: `settings-${organization.id}`, organization_id: organization.id, default_language: "en", default_timezone: "UTC", notification_preferences: { announcements: true }, security_settings: { require_approval: true }, created_at: now, updated_at: now };
  return { organization, settings, members: profiles.map((profile, index) => ({ id: `membership-${index}`, organization_id: organization.id, user_id: profile.id, membership_status: index === 2 ? "invited" : "active", joined_at: index === 2 ? null : now, created_at: now, updated_at: now, profile, role: index === 0 ? "Administrator" : index === 1 ? "Manager" : "Member" })) };
}
