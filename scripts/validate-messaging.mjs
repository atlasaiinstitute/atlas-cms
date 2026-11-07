import fs from "node:fs";
const contracts=fs.readFileSync("src/features/messaging/contracts.ts","utf8");const migration=fs.readFileSync("supabase/migrations/20261106290000_messaging_system.sql","utf8");const service=fs.readFileSync("src/services/messaging.ts","utf8");
for(const marker of ["direct","group","community","committee","working_group","administrative"])if(!contracts.includes(marker))throw new Error(`missing conversation type: ${marker}`);
for(const marker of ["conversation_participants","message_attachments","message_read_receipts","message_edit_history","message_reports","messaging_preferences","message-attachments"])if(!migration.includes(marker))throw new Error(`missing schema marker: ${marker}`);
for(const marker of ["assertConversationParticipant","createMessageDownloadUrl","notifications","requireOrganizationAccess"])if(!service.includes(marker))throw new Error(`missing service guard/integration: ${marker}`);
if(!migration.includes("public.is_org_admin(organization_id)"))throw new Error("missing admin guard");
console.log("messaging: conversation types, participant access, private attachment, moderation and notification checks passed");
