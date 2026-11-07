import { cookies } from "next/headers";
import type { Organization } from "@/types/database";

export const ORGANIZATION_CONTEXT_COOKIE = "atlas_organization_id";

type OrganizationAccess = "member" | "manager" | "administrator" | "platform_admin";

export type TenantActor = {
  userId: string;
  platformRole?: "platform_admin";
  memberships: Array<{ organizationId: string; access: Exclude<OrganizationAccess, "platform_admin">; status: "invited" | "active" | "suspended" | "archived" }>;
};

export type OrganizationContext = {
  organizationId: string;
  actor: TenantActor;
  access: OrganizationAccess;
  organizationStatus: Organization["status"];
};

export class TenantContextError extends Error {
  constructor(public readonly code: "missing_actor" | "missing_organization" | "access_denied" | "organization_unavailable", message: string) {
    super(message);
    this.name = "TenantContextError";
  }
}

export function requireTenantActor(actor: TenantActor | null | undefined): TenantActor {
  if (!actor?.userId) throw new TenantContextError("missing_actor", "An authenticated application actor is required.");
  return actor;
}

export function requireOrganizationAccess(actor: TenantActor | null | undefined, organizationId: string, organizationStatus: Organization["status"]): OrganizationContext {
  const verifiedActor = requireTenantActor(actor);
  if (verifiedActor.platformRole === "platform_admin") return { organizationId, actor: verifiedActor, access: "platform_admin", organizationStatus };
  const membership = verifiedActor.memberships.find((item) => item.organizationId === organizationId);
  if (!membership || membership.status !== "active") throw new TenantContextError("access_denied", "The current user is not an active member of this organization.");
  if (["suspended", "archived", "inactive"].includes(organizationStatus)) throw new TenantContextError("organization_unavailable", "This organization is not available for normal tenant operations.");
  return { organizationId, actor: verifiedActor, access: membership.access, organizationStatus };
}

export function requireOrganizationAdmin(context: OrganizationContext): OrganizationContext {
  if (context.access !== "administrator" && context.access !== "platform_admin") throw new TenantContextError("access_denied", "Administrator access is required for this operation.");
  return context;
}

export function validateTenantOwnership(context: OrganizationContext, recordOrganizationId: string, recordCommunityId?: string | null, expectedCommunityOrganizationId?: string | null) {
  if (context.organizationId !== recordOrganizationId) throw new TenantContextError("access_denied", "The requested record belongs to another organization.");
  if (recordCommunityId && expectedCommunityOrganizationId && recordCommunityId !== expectedCommunityOrganizationId) throw new TenantContextError("access_denied", "The community does not belong to the selected organization.");
  return true;
}

export async function getSelectedOrganizationId(): Promise<string | null> {
  return (await cookies()).get(ORGANIZATION_CONTEXT_COOKIE)?.value ?? null;
}

export async function getOrganizationContext(actor: TenantActor | null | undefined, organizations: Array<Pick<Organization, "id" | "status">>, requestedOrganizationId?: string): Promise<OrganizationContext> {
  const selectedId = requestedOrganizationId ?? await getSelectedOrganizationId();
  if (!selectedId) throw new TenantContextError("missing_organization", "Select an organization before accessing tenant data.");
  const organization = organizations.find((item) => item.id === selectedId);
  if (!organization) throw new TenantContextError("access_denied", "The selected organization is not available to this actor.");
  return requireOrganizationAccess(actor, organization.id, organization.status);
}

export function getOrganizationScopedQuery<T extends { organization_id: string }>(context: OrganizationContext, rows: T[]): T[] {
  return rows.filter((row) => row.organization_id === context.organizationId);
}

export function getCommunityScopedQuery<T extends { organization_id: string; community_id?: string | null }>(context: OrganizationContext, rows: T[], communityId: string): T[] {
  return rows.filter((row) => row.organization_id === context.organizationId && row.community_id === communityId);
}
