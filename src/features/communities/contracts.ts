import { z } from "zod";
import type { Community, UserProfile } from "@/types/database";

export const communityTypes = ["Professional Network", "Research Community", "Policy Network", "Education Community", "Advocacy Network", "Expert Network", "Institutional Network", "General Community"] as const;
export const membershipPolicies = ["open", "application", "invitation", "administrator_approval"] as const;
export const communityStatuses = ["draft", "pending", "active", "suspended", "archived"] as const;

export const communityFormSchema = z.object({
  name: z.string().trim().min(2, "Community name is required").max(160),
  slug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers and hyphens"),
  short_description: z.string().trim().max(240).optional().or(z.literal("")),
  description: z.string().trim().max(1500).optional().or(z.literal("")),
  organization_id: z.string().uuid("Select an organization"),
  community_type: z.enum(communityTypes),
  focus_area: z.string().trim().max(120).optional().or(z.literal("")),
  geographic_coverage: z.string().trim().max(120).optional().or(z.literal("")),
  primary_language: z.string().min(2),
  additional_languages: z.string().optional().or(z.literal("")),
  contact_email: z.string().email("Enter a valid contact email"),
  website: z.string().url("Enter a valid website URL").optional().or(z.literal("")),
  visibility: z.enum(["public", "members", "private"]),
  membership_type: z.enum(membershipPolicies),
  status: z.enum(communityStatuses),
});

export type CommunityFormValues = z.infer<typeof communityFormSchema>;
export type CommunityStatus = Community["status"];
export type CommunitySummary = Community & { short_description: string | null; community_type: string | null; focus_area: string | null; member_count: number; administrator_count: number };
export type CommunityWorkspace = { community: CommunitySummary; administrators: Array<{ profile: UserProfile; role: string }>; recentActivity: Array<{ action: string; created_at: string }> };
