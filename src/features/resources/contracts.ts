import { z } from "zod";

export const resourceTypes = [
  "Research Paper", "Research Report", "Policy Brief", "Policy Framework", "Dataset", "Toolkit", "Template", "Handbook", "Guideline", "Training Material", "Presentation", "Book / E-book", "Software / Digital Tool", "Video", "Audio", "Image / Infographic", "Reference Document", "Legal / Regulatory Document", "Other / Custom",
] as const;
export const resourceStatuses = ["draft", "submitted_for_review", "under_review", "changes_requested", "approved", "published", "archived"] as const;
export const visibilityOptions = ["public", "organization_members", "community_members", "selected_roles", "private"] as const;
export type ResourceStatus = typeof resourceStatuses[number];
export type ResourceVisibility = typeof visibilityOptions[number];

export type ResourceRow = {
  id: string; organization_id: string; organization_name: string; community_id: string | null; community_name: string | null;
  title: string; short_description: string; resource_type: string; category: string; tags: string[]; language: string;
  license: string; format: string; version: string; updated_at: string; published_at: string | null; status: ResourceStatus;
  visibility: ResourceVisibility; owner_name: string; file_size: string; downloads: number; views: number; collection_names: string[];
  file_name: string | null; external_url: string | null; geographic_coverage: string | null; subject_area: string | null;
  citation: string | null; detailed_description: string | null; review_note?: string | null;
};

export const resourceSchema = z.object({
  organization_id: z.string().uuid(), community_id: z.string().uuid().nullable().optional(), title: z.string().trim().min(3).max(180),
  short_description: z.string().trim().min(10).max(300), detailed_description: z.string().trim().max(10000).optional().default(""),
  resource_type: z.string().trim().min(2).max(80), category_id: z.string().uuid().nullable().optional(), language: z.string().trim().min(2).max(20).default("en"),
  geographic_coverage: z.string().trim().max(120).optional().default(""), subject_area: z.string().trim().max(120).optional().default(""), publisher: z.string().trim().max(180).optional().default(""),
  version: z.string().trim().max(40).optional().default("1.0"), identifier: z.string().trim().max(180).optional().default(""), citation: z.string().trim().max(2000).optional().default(""),
  license: z.string().trim().max(120).optional().default("Unspecified"), attribution_requirements: z.string().trim().max(1000).optional().default(""),
  visibility: z.enum(visibilityOptions).default("organization_members"), publication_date: z.string().optional().nullable(), review_date: z.string().optional().nullable(),
  external_url: z.string().url().optional().or(z.literal("")), status: z.enum(resourceStatuses).default("draft"),
});

export const statusLabels: Record<ResourceStatus, string> = { draft: "Draft", submitted_for_review: "Submitted", under_review: "Under review", changes_requested: "Changes requested", approved: "Approved", published: "Published", archived: "Archived" };
export const visibilityLabels: Record<ResourceVisibility, string> = { public: "Public", organization_members: "Organization members", community_members: "Community members", selected_roles: "Selected roles", private: "Private" };
export function formatBytes(bytes: number) { if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`; return `${(bytes / 1024 / 1024).toFixed(1)} MB`; }
export function validateResourceFile(file: { name: string; type: string; size: number }) {
  const allowed = ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/vnd.ms-powerpoint", "application/vnd.openxmlformats-officedocument.presentationml.presentation", "text/csv", "text/plain", "application/zip", "application/json", "image/png", "image/jpeg", "image/svg+xml", "audio/mpeg", "video/mp4"];
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!allowed.includes(file.type) || ["exe", "sh", "js", "bat", "cmd", "msi"].includes(extension)) throw new Error("This file type is not approved for Resource Library uploads.");
  if (file.size > 100 * 1024 * 1024) throw new Error("Resource files must be 100 MB or smaller.");
  return true;
}
