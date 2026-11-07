import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireOrganizationAccess, requireOrganizationAdmin, type TenantActor } from "@/lib/tenant/context";
import { resourceSchema, validateResourceFile, type ResourceStatus } from "@/features/resources/contracts";

export { validateResourceFile };
export const RESOURCE_BUCKET = "resource-files";
export function safeResourcePath(organizationId: string, resourceId: string, version: string, fileName: string) {
  const safeName = fileName.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  return `${organizationId}/${resourceId}/${version}/${safeName || "resource-file"}`;
}
export async function createResource(actor: TenantActor, raw: unknown) {
  const values = resourceSchema.parse(raw);
  const context = requireOrganizationAdmin(requireOrganizationAccess(actor, values.organization_id, "active"));
  const supabase = await createSupabaseServerClient();
  if (values.community_id) {
    const { data: community } = await supabase.from("communities").select("id").eq("id", values.community_id).eq("organization_id", context.organizationId).maybeSingle();
    if (!community) throw new Error("The selected community does not belong to this organization.");
  }
  const { data, error } = await supabase.from("resources").insert({ organization_id: context.organizationId, community_id: values.community_id ?? null, category_id: values.category_id ?? null, uploaded_by: context.actor.userId, name: values.title, title: values.title, description: values.short_description, short_description: values.short_description, detailed_description: values.detailed_description, resource_type: values.resource_type, language: values.language, geographic_coverage: values.geographic_coverage || null, subject_area: values.subject_area || null, publisher: values.publisher || null, version: values.version, identifier: values.identifier || null, citation: values.citation || null, license: values.license, attribution_requirements: values.attribution_requirements || null, visibility: values.visibility, publication_date: values.publication_date || null, review_date: values.review_date || null, external_url: values.external_url || null, status: values.status }).select("id").single();
  if (error) throw new Error(`Resource creation failed: ${error.message}`);
  await supabase.from("resource_activity_logs").insert({ resource_id: data.id, organization_id: context.organizationId, actor_user_id: context.actor.userId, activity_type: "created" });
  return data;
}
export async function transitionResource(actor: TenantActor, organizationId: string, resourceId: string, from: ResourceStatus, to: ResourceStatus, internalNotes?: string) {
  const context = requireOrganizationAdmin(requireOrganizationAccess(actor, organizationId, "active"));
  const allowed: Record<ResourceStatus, ResourceStatus[]> = { draft: ["submitted_for_review"], submitted_for_review: ["under_review", "changes_requested"], under_review: ["changes_requested", "approved"], changes_requested: ["draft", "submitted_for_review"], approved: ["published", "changes_requested"], published: ["archived"], archived: ["published"] };
  if (!allowed[from]?.includes(to)) throw new Error(`Invalid resource transition: ${from} → ${to}`);
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("resources").update({ status: to, published_at: to === "published" ? new Date().toISOString() : undefined, archived_at: to === "archived" ? new Date().toISOString() : null }).eq("id", resourceId).eq("organization_id", context.organizationId).eq("status", from).select("id").single();
  if (error) throw new Error(`Resource transition failed: ${error.message}`);
  await supabase.from("resource_reviews").insert({ resource_id: resourceId, organization_id: context.organizationId, reviewer_user_id: context.actor.userId, decision: to === "published" ? "approved" : to, internal_notes: internalNotes || null });
  await supabase.from("resource_activity_logs").insert({ resource_id: resourceId, organization_id: context.organizationId, actor_user_id: context.actor.userId, activity_type: to === "published" ? "published" : to === "archived" ? "archived" : "reviewed" });
  return data;
}
export async function createResourceDownloadUrl(actor: TenantActor, organizationId: string, storagePath: string, expiresIn = 300) {
  const context = requireOrganizationAccess(actor, organizationId, "active");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.storage.from(RESOURCE_BUCKET).createSignedUrl(storagePath, expiresIn);
  if (error || !data?.signedUrl) throw new Error("The resource file could not be authorized for download.");
  return { ...data, organizationId: context.organizationId, expiresIn };
}
