# Step 09 — Roles & Permissions

ATLAS now has a reusable, deny-by-default permission engine. Platform assignments are explicit and only apply to platform operations. Organization assignments apply only to their organization. Community assignments apply only to their community and never inherit organization administration. A community administrator therefore cannot change organization roles or settings unless separately assigned an authorized organization role.

`hasPermission`, `hasAnyPermission`, `hasAllPermissions`, `requirePermission`, `getEffectivePermissions`, `canAssignRole`, and `validateRoleScope` are available from `src/lib/authorization/permissions.ts`. Permission checks use the resolved scope and explicit role-to-permission mappings, not role names, member designations, browser-supplied IDs, or UI visibility. Missing permissions deny access. The current model has grants only; future explicit-deny rules should take precedence before grants if introduced.

The existing role and permission tables are extended. Platform assignments use a dedicated `platform_role_assignments` table because the pre-existing tenant assignment table requires an organization ID. `role_assignment_history` records assignment, change, revoke, delegation, and denied-escalation events. RLS policies require the existing Step 05 helpers and authentication context when enabled.

The UI uses development fixtures until Step 19 authentication is available. Live service methods validate organization membership, community membership, role scope, and tenant ownership before writing. System roles are protected by `is_system`; custom roles can be disabled or removed only through authorized server operations. No login, registration, password, or authentication UI was added.
