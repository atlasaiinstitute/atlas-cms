import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireOrganizationAdmin, requireOrganizationAccess, type TenantActor } from "@/lib/tenant/context";
import type { MemberProfileFormValues } from "@/features/members/contracts";

export async function listMembersForOrganization(actor: TenantActor, organizationId: string, communityId?: string) {
  const context = requireOrganizationAccess(actor, organizationId, "active");
  const supabase = await createSupabaseServerClient();
  const memberships = communityId
    ? await supabase.from("community_memberships").select("*, user_profiles(*)").eq("organization_id", context.organizationId).eq("community_id", communityId)
    : await supabase.from("organization_memberships").select("*, user_profiles(*)").eq("organization_id", context.organizationId);
  if (memberships.error) throw new Error(`Member directory failed: ${memberships.error.message}`);
  return memberships.data ?? [];
}

export async function createMemberProfile(actor: TenantActor, values: MemberProfileFormValues) {
  const context = requireOrganizationAdmin(requireOrganizationAccess(actor, values.initial_organization_id, "active"));
  const supabase = await createSupabaseServerClient();
  const { data: profile, error: profileError } = await supabase.from("user_profiles").insert({ full_name: values.full_name, email: values.email, designation: values.designation || null, organization_name: values.institution || null, country: values.country || null, professional_bio: values.professional_bio || null, areas_of_expertise: values.areas_of_expertise ? values.areas_of_expertise.split(",").map((item) => item.trim()).filter(Boolean) : [], directory_visibility: "members", profile_visibility: "members", profile_completion_status: "partial" }).select("id").single();
  if (profileError) throw new Error(`Profile creation failed: ${profileError.message}`);
  const { error: membershipError } = await supabase.from("organization_memberships").insert({ organization_id: context.organizationId, user_id: profile.id, membership_status: "pending", membership_start_date: new Date().toISOString().slice(0, 10) });
  if (membershipError) throw new Error(`Membership creation failed: ${membershipError.message}`);
  return { id: profile.id, persisted: true };
}

export async function updateOrganizationMembership(actor: TenantActor, organizationId: string, membershipId: string, status: string, notes?: string) {
  const context = requireOrganizationAdmin(requireOrganizationAccess(actor, organizationId, "active"));
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("organization_memberships").update({ membership_status: status, administrative_notes: notes || null, archived_at: ["archived", "left"].includes(status) ? new Date().toISOString() : null }).eq("id", membershipId).eq("organization_id", context.organizationId).select("id").single();
  if (error) throw new Error(`Membership update failed: ${error.message}`);
  return data;
}
