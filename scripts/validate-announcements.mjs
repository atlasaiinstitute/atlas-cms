import fs from "node:fs";
const contracts = fs.readFileSync("src/features/announcements/contracts.ts", "utf8");
const migration = fs.readFileSync("supabase/migrations/20261106280000_announcements_notifications.sql", "utf8");
const requiredStatuses = ["draft", "submitted_for_review", "under_review", "approved", "scheduled", "published", "expired", "archived", "rejected", "cancelled"];
for (const status of requiredStatuses) if (!contracts.includes(status)) throw new Error(`missing workflow status: ${status}`);
for (const marker of ["announcement_audiences", "announcement_recipients", "notification_preferences", "notification_delivery_logs", "notification_events", "announcement-attachments", "notifications_user_related_uidx"]) if (!migration.includes(marker)) throw new Error(`missing migration marker: ${marker}`);
if (!migration.includes("public.is_org_admin(organization_id)")) throw new Error("missing tenant admin policy guard");
if (!migration.includes("unique(notification_id,channel,attempt_count)")) throw new Error("missing delivery attempt uniqueness");
console.log("announcements-notifications: workflow, tenant policy, audience, delivery and idempotency checks passed");
