import { z } from "zod";
import type { CommunityMembership, OrganizationMembership, UserProfile } from "@/types/database";

export const memberStatuses = ["pending", "active", "suspended", "rejected", "left", "archived"] as const;
export type MemberStatus = typeof memberStatuses[number];

export const memberProfileSchema = z.object({
  full_name: z.string().trim().min(2, "Full name is required").max(160),
  email: z.string().trim().email("Enter a valid email address"),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  designation: z.string().trim().max(160).optional().or(z.literal("")),
  organization_name: z.string().trim().max(160).optional().or(z.literal("")),
  country: z.string().trim().max(80).optional().or(z.literal("")),
  city: z.string().trim().max(100).optional().or(z.literal("")),
  professional_bio: z.string().trim().max(3000).optional().or(z.literal("")),
  areas_of_expertise: z.string().trim().max(500).optional().or(z.literal("")),
  institution: z.string().trim().max(160).optional().or(z.literal("")),
  initial_organization_id: z.string().uuid("Select an organization"),
});

export const memberFiltersSchema = z.object({ search: z.string().max(120).optional(), organizationId: z.string().uuid().optional(), communityId: z.string().uuid().optional(), status: z.enum(memberStatuses).optional(), location: z.string().max(100).optional() });
export type MemberProfileFormValues = z.infer<typeof memberProfileSchema>;
export type MemberWithMemberships = UserProfile & { organization_memberships: OrganizationMembership[]; community_memberships: CommunityMembership[]; organization_names?: string[]; community_names?: string[] };
export type MemberDirectoryRow = MemberWithMemberships & { organization_count: number; community_count: number; membership_status: MemberStatus };
