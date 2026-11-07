import { z } from "zod";

export const brandingSchema = z.object({
  displayName: z.string().trim().min(2).max(120),
  shortName: z.string().trim().min(2).max(40),
  description: z.string().trim().max(500),
  website: z.string().url().or(z.literal("")),
  contactEmail: z.string().email().or(z.literal("")),
  footerText: z.string().trim().max(240),
  welcomeMessage: z.string().trim().max(160),
  primary: z.string().regex(/^#[0-9a-f]{6}$/i),
  secondary: z.string().regex(/^#[0-9a-f]{6}$/i),
  accent: z.string().regex(/^#[0-9a-f]{6}$/i),
  background: z.string().regex(/^#[0-9a-f]{6}$/i),
  font: z.enum(["Inter", "DM Sans", "Source Sans 3"]),
});

export const hostnameSchema = z.string().trim().toLowerCase().refine((value) => value.length <= 253 && !value.includes(".."), "Invalid hostname").refine((value) => !/^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.)/.test(value), "Internal hostnames are not allowed").refine((value) => /^(?=.{4,253}$)[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/.test(value), "Use a valid hostname without a scheme or path");

export type OrganizationBranding = z.infer<typeof brandingSchema> & { organizationId: string; logoUrl: string | null; faviconUrl: string | null; updatedAt: string };
export type OrganizationDomain = { id: string; organizationId: string; hostname: string; normalizedHostname: string; kind: "subdomain" | "custom"; status: "pending" | "verification_required" | "verified" | "provisioning" | "active" | "failed" | "removed"; isPrimary: boolean; verifiedAt: string | null; providerError: string | null };

export const RESERVED_SUBDOMAINS = new Set(["www", "app", "admin", "api", "auth", "docs", "support", "status", "mail"]);

export function normalizeHostname(input: string) {
  return hostnameSchema.parse(input).replace(/\.$/, "");
}

export function assertAvailableSubdomain(value: string, taken: Iterable<string>) {
  const subdomain = value.trim().toLowerCase();
  if (!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(subdomain)) throw new Error("Subdomain must use lowercase letters, numbers and hyphens.");
  if (RESERVED_SUBDOMAINS.has(subdomain)) throw new Error("This subdomain is reserved by the platform.");
  if (new Set(Array.from(taken, (item) => item.toLowerCase())).has(subdomain)) throw new Error("This subdomain is already assigned.");
  return subdomain;
}

export function shouldUseForwardedHost(headers: Headers, trustedProxy = false) {
  return trustedProxy ? headers.get("x-forwarded-host") ?? headers.get("host") : headers.get("host");
}
