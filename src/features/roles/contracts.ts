import { z } from "zod";
export const roleScopes = ["system", "organization", "community"] as const;
export type RoleScope = typeof roleScopes[number];
export type Permission = { id: string; key: string; name: string; description: string | null; module: string; scope: RoleScope };
export type Role = { id: string; name: string; key: string; description: string; scope: RoleScope; is_system: boolean; is_active: boolean; assigned_members: number; permissions: string[] };
export const roleSchema = z.object({ name: z.string().trim().min(2).max(100), key: z.string().trim().regex(/^[a-z][a-z0-9_]*$/), description: z.string().trim().max(500), scope: z.enum(roleScopes), permission_keys: z.array(z.string()).min(1), is_active: z.boolean() });
export type RoleFormValues = z.infer<typeof roleSchema>;
export type RoleAssignment = { user_id: string; role_id: string; assignment_scope: "platform" | "organization" | "community"; organization_id?: string; community_id?: string; revoked_at?: string | null };
