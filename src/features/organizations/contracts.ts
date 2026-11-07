import { z } from "zod";
import type { Organization, OrganizationMembership, OrganizationSettings, UserProfile } from "@/types/database";

export const organizationFormSchema = z.object({
  name: z.string().trim().min(2, "Organization name is required").max(120),
  slug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers and hyphens"),
  description: z.string().trim().max(500).optional().or(z.literal("")),
  organization_type: z.string().min(1, "Select an organization type"),
  country: z.string().min(1, "Select a country"),
  website: z.string().url("Enter a valid website URL").optional().or(z.literal("")),
  contact_email: z.string().email("Enter a valid contact email"),
  status: z.enum(["active", "pending", "suspended", "archived"]),
});

export type OrganizationFormValues = z.infer<typeof organizationFormSchema>;
export type OrganizationStatus = Organization["status"];

export type OrganizationSummary = Organization & {
  community_count: number;
  member_count: number;
};

export type OrganizationWorkspace = {
  organization: OrganizationSummary;
  settings: OrganizationSettings;
  members: Array<OrganizationMembership & { profile: UserProfile; role: string }>;
};
