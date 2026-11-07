import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrganizationScopedQuery, requireOrganizationAccess, requireOrganizationAdmin, type TenantActor } from "@/lib/tenant/context";
import { communityFixtures } from "@/data/mock/communities";
import type { CommunityFormValues, CommunitySummary, CommunityWorkspace } from "@/features/communities/contracts";

const organizationStatus: Record<string, "active" | "archived"> = { "11111111-1111-4111-8111-111111111111": "active", "22222222-2222-4222-8222-222222222222": "active" };

export async function listCommunitiesForOrganization(actor: TenantActor, organizationId: string): Promise<CommunitySummary[]> {
  const status = organizationStatus[organizationId] ?? "archived";
  const context = requireOrganizationAccess(actor, organizationId, status);
  return getOrganizationScopedQuery(context, communityFixtures);
}

export async function getCommunityWorkspace(actor: TenantActor, communityId: string): Promise<CommunityWorkspace | null> {
  const community = communityFixtures.find((item) => item.id === communityId);
  if (!community) return null;
  const status = organizationStatus[community.organization_id] ?? "archived";
  const context = requireOrganizationAccess(actor, community.organization_id, status);
  const scoped = getOrganizationScopedQuery(context, communityFixtures).filter((item) => item.id === community.id);
  if (scoped.length === 0) return null;
  return { community, administrators: [], recentActivity: [] };
}

export async function getDevelopmentCommunityWorkspace(communityId: string): Promise<CommunityWorkspace | null> {
  const community = communityFixtures.find((item) => item.id === communityId);
  if (!community) return null;
  return { community, administrators: [], recentActivity: [] };
}

export async function createCommunityRecord(actor: TenantActor, values: CommunityFormValues): Promise<{ id: string; persisted: boolean }> {
  const context = requireOrganizationAdmin(requireOrganizationAccess(actor, values.organization_id, organizationStatus[values.organization_id] ?? "archived"));
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("communities").insert({ organization_id: context.organizationId, name: values.name, slug: values.slug, description: values.description || null, short_description: values.short_description || null, community_type: values.community_type, focus_area: values.focus_area || null, geographic_coverage: values.geographic_coverage || null, primary_language: values.primary_language, additional_languages: values.additional_languages ? values.additional_languages.split(",").map((item) => item.trim()).filter(Boolean) : [], contact_email: values.contact_email, website: values.website || null, visibility: values.visibility, membership_type: values.membership_type, status: values.status }).select("id").single();
  if (error) throw new Error(`Community creation failed: ${error.message}`);
  return { id: data.id, persisted: true };
}

export function getCommunityAssetPath(organizationId: string, communityId: string, fileName: string) {
  const safeName = fileName.toLowerCase().replace(/[^a-z0-9._-]/g, "-");
  return `organizations/${organizationId}/communities/${communityId}/${safeName}`;
}

export function validateCommunityAsset(file: { type: string; size: number }) {
  const allowed = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];
  if (!allowed.includes(file.type)) throw new Error("Community branding must be PNG, JPG, WEBP or SVG.");
  if (file.size > 2 * 1024 * 1024) throw new Error("Community branding files must be 2 MB or smaller.");
  return true;
}
