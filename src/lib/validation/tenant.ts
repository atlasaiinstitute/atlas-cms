import { z } from "zod";

export const organizationSchema = z.object({
  name: z.string().trim().min(2).max(120),
  slug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
});

export const communitySchema = z.object({
  organizationId: z.string().uuid(),
  name: z.string().trim().min(2).max(160),
  slug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  visibility: z.enum(["public", "members", "private"]),
});

export type OrganizationInput = z.infer<typeof organizationSchema>;
export type CommunityInput = z.infer<typeof communitySchema>;
