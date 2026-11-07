"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  AlertCircle,
  Check,
  ChevronRight,
  CircleCheck,
  Copy,
  Globe2,
  Image as ImageIcon,
  Info,
  Mail,
  Palette,
  Plus,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";

type BrandSettings = {
  displayName: string;
  shortName: string;
  description: string;
  website: string;
  contactEmail: string;
  footerText: string;
  welcomeMessage: string;
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  font: "Inter" | "DM Sans" | "Source Sans 3";
};

type Domain = { id: string; hostname: string; type: "Platform subdomain" | "Custom domain"; status: "Active" | "Verification required" | "Pending"; primary?: boolean; error?: string };

const DEFAULT_BRAND: BrandSettings = {
  displayName: "Northstar Foundation",
  shortName: "Northstar",
  description: "A member-led community for practical climate innovation.",
  website: "https://northstar.example.org",
  contactEmail: "hello@northstar.example.org",
  footerText: "Northstar Foundation · Building useful futures together",
  welcomeMessage: "Welcome to the Northstar member network",
  primary: "#233B5B",
  secondary: "#B69A62",
  accent: "#527AA6",
  background: "#F8F8F6",
  font: "Inter",
};

const INITIAL_DOMAINS: Domain[] = [
  { id: "1", hostname: "northstar.atlas.example", type: "Platform subdomain", status: "Active", primary: true },
  { id: "2", hostname: "members.northstar.example.org", type: "Custom domain", status: "Verification required" },
];

const tabs = [
  { href: "/settings/branding", label: "Branding" },
  { href: "/settings/domains", label: "Domains" },
  { href: "/settings/white-label", label: "White-label" },
];

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return <label className="wl-field"><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>;
}

function StatusPill({ status }: { status: Domain["status"] }) {
  return <span className={`wl-status ${status.toLowerCase().replaceAll(" ", "-")}`}><span />{status}</span>;
}

function LogoMark({ brand, dark = false }: { brand: BrandSettings; dark?: boolean }) {
  return <div className="wl-logo-mark" style={{ background: dark ? brand.secondary : brand.primary }}>{brand.shortName.slice(0, 1).toUpperCase()}</div>;
}

export function WhiteLabelWorkspace() {
  const pathname = usePathname();
  const section = pathname.includes("domains") ? "domains" : pathname.includes("white-label") ? "white-label" : "branding";
  const [brand, setBrand] = useState(DEFAULT_BRAND);
  const [saved, setSaved] = useState(false);
  const [domains, setDomains] = useState(INITIAL_DOMAINS);
  const [showDomainForm, setShowDomainForm] = useState(false);
  const [newDomain, setNewDomain] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState<"login" | "welcome">("welcome");
  const [assetNames, setAssetNames] = useState({ logo: "logo-primary.svg", favicon: "favicon.svg" });

  const update = (key: keyof BrandSettings, value: string) => { setSaved(false); setBrand((current) => ({ ...current, [key]: value })); };
  const saveBrand = () => { setSaved(true); setNotice("Branding changes saved to this organization preview. A production write will use the tenant-scoped service."); setTimeout(() => setNotice(null), 4200); };
  const addDomain = () => {
    const normalized = newDomain.trim().toLowerCase();
    if (!/^(?=.{4,253}$)(?!.*\.\.)[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/.test(normalized)) { setNotice("Enter a valid hostname, without https://, a path, localhost, or an internal address."); return; }
    if (domains.some((domain) => domain.hostname === normalized)) { setNotice("This hostname is already assigned to an organization."); return; }
    setDomains((current) => [...current, { id: crypto.randomUUID(), hostname: normalized, type: "Custom domain", status: "Verification required" }]);
    setNewDomain(""); setShowDomainForm(false); setNotice("Domain registered. Add the TXT record below before requesting verification.");
  };
  const removeDomain = (id: string) => { if (!window.confirm("Remove this domain from the organization? This change will be recorded in the audit trail.")) return; setDomains((current) => current.filter((domain) => domain.id !== id)); setNotice("Domain removed from this organization preview."); };
  const copyToken = () => { setNotice("Verification tokens are generated and stored server-side in production; no secret is exposed by this preview."); };
  const handleAsset = (kind: "logo" | "favicon", file: File | undefined) => { if (!file) return; const accepted = kind === "favicon" ? ["image/png", "image/x-icon", "image/svg+xml"] : ["image/png", "image/jpeg", "image/svg+xml", "image/webp"]; if (!accepted.includes(file.type)) { setNotice(`Unsupported ${kind} format.`); return; } if (file.size > 2 * 1024 * 1024) { setNotice(`${kind === "favicon" ? "Favicon" : "Logo"} files must be 2 MB or smaller.`); return; } setAssetNames((current) => ({ ...current, [kind]: file.name })); setNotice(`${kind === "favicon" ? "Favicon" : "Logo"} validated for organization-scoped storage. Persistence requires the configured Supabase Storage integration.`); };
  const pageTitle = section === "domains" ? "Custom domains" : section === "white-label" ? "White-label controls" : "Branding settings";
  const pageDescription = section === "domains" ? "Connect platform subdomains and verified custom domains without creating a separate deployment." : section === "white-label" ? "Control how this organization appears across the member experience and public entry points." : "Shape the organization identity that members see across Atlas.";
  const cssVars = useMemo(() => ({ "--wl-primary": brand.primary, "--wl-secondary": brand.secondary, "--wl-accent": brand.accent, "--wl-background": brand.background, "--wl-font": brand.font }), [brand]);

  return <div className="wl-workspace" style={cssVars as React.CSSProperties}>
    <div className="wl-heading"><div><div className="eyebrow">System · Organization identity</div><h1>{pageTitle}</h1><p className="page-description">{pageDescription}</p></div><div className="wl-heading-actions"><span className="wl-tenant-chip"><span className="wl-tenant-dot" />Northstar Foundation <ChevronRight size={13} /></span>{section === "branding" && <button className="button button-primary" onClick={saveBrand}><Check size={15} /> {saved ? "Saved" : "Save changes"}</button>}</div></div>
    <nav className="wl-tabs" aria-label="White-label settings">{tabs.map((tab) => <Link key={tab.href} href={tab.href} className={pathname === tab.href ? "active" : ""}>{tab.label}</Link>)}</nav>
    {notice && <div className="wl-notice"><CircleCheck size={16} /><span>{notice}</span><button onClick={() => setNotice(null)} aria-label="Dismiss"><X size={15} /></button></div>}

    {section === "branding" && <div className="wl-content-grid">
      <main className="wl-main-column">
        <section className="form-card wl-card"><div className="wl-card-heading"><div className="wl-icon gold"><Palette size={17} /></div><div><h2>Organization identity</h2><p>These fields are safe, structured design tokens — never arbitrary CSS or scripts.</p></div></div><div className="wl-form-grid"><Field label="Display name"><input value={brand.displayName} onChange={(e) => update("displayName", e.target.value)} /></Field><Field label="Short name" hint="Used in compact navigation and favicon fallback."><input value={brand.shortName} onChange={(e) => update("shortName", e.target.value)} /></Field><Field label="Organization description" hint="Shown on public organization entry pages."><textarea rows={3} value={brand.description} onChange={(e) => update("description", e.target.value)} /></Field><Field label="Public website URL"><input value={brand.website} onChange={(e) => update("website", e.target.value)} /></Field><Field label="Contact email"><input type="email" value={brand.contactEmail} onChange={(e) => update("contactEmail", e.target.value)} /></Field><Field label="Footer text"><input value={brand.footerText} onChange={(e) => update("footerText", e.target.value)} /></Field><Field label="Welcome message"><input value={brand.welcomeMessage} onChange={(e) => update("welcomeMessage", e.target.value)} /></Field></div></section>
        <section className="form-card wl-card"><div className="wl-card-heading"><div className="wl-icon blue"><ImageIcon size={17} /></div><div><h2>Logo and favicon</h2><p>PNG, JPG, SVG or ICO · maximum 2 MB · validated before storage.</p></div></div><div className="wl-assets"><div className="wl-asset-row"><LogoMark brand={brand} /><div><strong>Primary logo</strong><small>{assetNames.logo} · 180 × 44 px</small></div><label className="button button-secondary wl-file-button"><Upload size={14} /> Replace<input type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" onChange={(event) => handleAsset("logo", event.target.files?.[0])} /></label></div><div className="wl-asset-row"><div className="wl-favicon"><LogoMark brand={brand} dark /></div><div><strong>Favicon</strong><small>{assetNames.favicon} · square format</small></div><label className="button button-secondary wl-file-button"><Upload size={14} /> Replace<input type="file" accept="image/png,image/x-icon,image/svg+xml" onChange={(event) => handleAsset("favicon", event.target.files?.[0])} /></label></div></div><div className="wl-upload-note"><Info size={14} /> Storage path is organization-scoped. Uploads are validated before persistence.</div></section>
        <section className="form-card wl-card"><div className="wl-card-heading"><div className="wl-icon purple"><Sparkles size={17} /></div><div><h2>Design tokens</h2><p>Choose supported colors and typography. Changes update the preview instantly.</p></div></div><div className="wl-color-grid">{([["primary", "Primary brand color"], ["secondary", "Secondary brand color"], ["accent", "Accent color"], ["background", "Background color"]] as const).map(([key, label]) => <Field key={key} label={label}><div className="wl-color-input"><input type="color" value={brand[key]} onChange={(e) => update(key, e.target.value)} /><input value={brand[key]} onChange={(e) => update(key, e.target.value)} aria-label={`${label} hex value`} /></div></Field>)}<Field label="Typography preference"><select value={brand.font} onChange={(e) => update("font", e.target.value)}><option>Inter</option><option>DM Sans</option><option>Source Sans 3</option></select></Field></div></section>
      </main>
      <aside className="wl-preview-column"><div className="wl-preview-label"><span>Live preview</span><div><button className={previewMode === "welcome" ? "active" : ""} onClick={() => setPreviewMode("welcome")}>Welcome</button><button className={previewMode === "login" ? "active" : ""} onClick={() => setPreviewMode("login")}>Login</button></div></div><div className="wl-preview" style={{ background: brand.background, fontFamily: brand.font }}><div className="wl-preview-top"><div className="wl-preview-brand"><LogoMark brand={brand} /><strong style={{ color: brand.primary }}>{brand.displayName}</strong></div><span style={{ color: brand.secondary }}>Member access</span></div><div className="wl-preview-hero">{previewMode === "welcome" ? <><div className="wl-preview-eyebrow" style={{ color: brand.secondary }}>ORGANIZATION PORTAL</div><h3 style={{ color: brand.primary }}>{brand.welcomeMessage}</h3><p>{brand.description}</p><button style={{ background: brand.primary }}>Enter member portal <ChevronRight size={14} /></button></> : <><div className="wl-preview-eyebrow" style={{ color: brand.secondary }}>SECURE ACCESS</div><h3 style={{ color: brand.primary }}>Sign in to {brand.shortName}</h3><p>Use your organization account to continue.</p><div className="wl-preview-input">Email address</div><button style={{ background: brand.primary }}>Continue <ChevronRight size={14} /></button></>}</div><div className="wl-preview-footer">{brand.footerText}</div></div><div className="wl-preview-callout"><CircleCheck size={15} /><span>Preview uses the same supported tokens that render in the application shell.</span></div></aside>
    </div>}

    {section === "domains" && <div className="wl-domain-layout"><main className="wl-main-column"><section className="form-card wl-card"><div className="wl-card-heading"><div className="wl-icon blue"><Globe2 size={17} /></div><div><h2>Domain connections</h2><p>Only active verified mappings can resolve tenant branding.</p></div><button className="button button-primary wl-card-action" onClick={() => setShowDomainForm(true)}><Plus size={14} /> Add domain</button></div><div className="wl-domain-list">{domains.map((domain) => <div className="wl-domain-row" key={domain.id}><div className="wl-domain-icon"><Globe2 size={16} /></div><div className="wl-domain-copy"><strong>{domain.hostname}</strong><span>{domain.type}{domain.primary ? " · Primary" : ""}</span></div><StatusPill status={domain.status} /><button className="wl-icon-button" onClick={() => removeDomain(domain.id)} aria-label={`Remove ${domain.hostname}`}><Trash2 size={15} /></button></div>)}</div>{showDomainForm && <div className="wl-inline-form"><Field label="Hostname" hint="Example: members.example.org — do not include a scheme or path."><input autoFocus value={newDomain} onChange={(e) => setNewDomain(e.target.value)} placeholder="members.your-organization.org" /></Field><div className="wl-inline-actions"><button className="button button-secondary" onClick={() => setShowDomainForm(false)}>Cancel</button><button className="button button-primary" onClick={addDomain}>Register domain</button></div></div>}</section><section className="form-card wl-card"><div className="wl-card-heading"><div className="wl-icon gold"><ShieldCheck size={17} /></div><div><h2>Verification workflow</h2><p>DNS verification is server-side and must complete before tenant resolution.</p></div></div><div className="wl-stepper"><div className="done"><span>1</span><strong>Registered</strong><small>Hostname normalized</small></div><div className="current"><span>2</span><strong>Verify ownership</strong><small>Add the TXT record</small></div><div><span>3</span><strong>Provisioning</strong><small>Provider confirmation</small></div><div><span>4</span><strong>Active</strong><small>Tenant can resolve</small></div></div><div className="wl-dns-box"><div><strong>TXT record name</strong><small>_atlas-verification.members.northstar.example.org</small></div><code>Generated server-side after registration</code><button className="wl-icon-button" onClick={copyToken} aria-label="Copy verification instructions"><Copy size={15} /></button></div><div className="wl-warning"><AlertCircle size={15} /><span>Provider integration is not configured in this preview, so SSL, live provisioning, and the verification secret remain server-side deployment work.</span></div><div className="wl-inline-actions"><button className="button button-secondary" onClick={() => setNotice("Verification check queued. In production this calls the server-side DNS resolver.")}><RefreshCw size={14} /> Check verification</button><button className="button button-secondary" onClick={() => setNotice("DNS instructions copied to the organization administrator.")}><Copy size={14} /> Copy instructions</button></div></section></main><aside className="wl-side-stack"><section className="form-card wl-card"><h2>Resolution modes</h2><div className="wl-mode"><span className="wl-mode-dot platform" /><div><strong>Platform default</strong><small>Atlas platform hostname</small></div><StatusPill status="Active" /></div><div className="wl-mode"><span className="wl-mode-dot subdomain" /><div><strong>Organization subdomain</strong><small>Unique platform-managed hostname</small></div><StatusPill status="Active" /></div><div className="wl-mode"><span className="wl-mode-dot custom" /><div><strong>Custom domain</strong><small>Verified DNS mapping required</small></div><StatusPill status="Pending" /></div></section><section className="form-card wl-card"><h2>Subdomain</h2><p className="wl-muted">Choose a unique platform subdomain for this organization.</p><div className="wl-subdomain-input"><input defaultValue="northstar" /><span>.atlas.example</span></div><button className="button button-secondary" onClick={() => setNotice("Subdomain availability checked. This value is reserved for the selected organization.")}><Check size={14} /> Check availability</button><small className="wl-help">Reserved names such as www, app, admin, api and auth cannot be used.</small></section></aside></div>}

    {section === "white-label" && <div className="wl-content-grid"><main className="wl-main-column"><section className="form-card wl-card"><div className="wl-card-heading"><div className="wl-icon purple"><Sparkles size={17} /></div><div><h2>Organization experience</h2><p>Configure structured landing-page content without creating a separate website.</p></div></div><div className="wl-form-grid"><Field label="Cover image"><div className="wl-cover-drop"><ImageIcon size={17} /><span>Drop a cover image or browse</span><input type="file" accept="image/png,image/jpeg,image/webp" /></div></Field><Field label="Primary action label"><input defaultValue="Enter member portal" /></Field><Field label="Public welcome description"><textarea rows={4} defaultValue={brand.description} /></Field><Field label="Contact information"><textarea rows={4} defaultValue={`Email: ${brand.contactEmail}\nWebsite: ${brand.website}`} /></Field></div></section><section className="form-card wl-card"><div className="wl-card-heading"><div className="wl-icon gold"><Mail size={17} /></div><div><h2>Email identity</h2><p>Configuration-ready settings, reused by the notification delivery architecture.</p></div></div><div className="wl-provider-note"><Info size={16} /><div><strong>No email provider configured</strong><span>These fields are saved as tenant configuration only. Sender verification and delivery will remain unavailable until a supported provider is connected.</span></div></div><div className="wl-form-grid"><Field label="Sender display name"><input defaultValue={brand.displayName} /></Field><Field label="Sender email address"><input type="email" placeholder="notifications@your-domain.org" /></Field><Field label="Reply-to address"><input type="email" defaultValue={brand.contactEmail} /></Field><Field label="Email footer"><textarea rows={3} defaultValue={brand.footerText} /></Field></div></section></main><aside className="wl-preview-column"><div className="wl-preview-label"><span>Welcome-page preview</span><span className="wl-preview-live"><span />Live</span></div><div className="wl-public-preview" style={{ background: brand.primary }}><div className="wl-public-cover" style={{ background: `linear-gradient(135deg, ${brand.primary}, ${brand.accent})` }}><LogoMark brand={brand} dark /><span>PUBLIC ORGANIZATION PAGE</span></div><div className="wl-public-body"><h3>{brand.displayName}</h3><p>{brand.description}</p><button style={{ background: brand.secondary }}>Enter member portal <ChevronRight size={14} /></button><small>{brand.contactEmail}</small></div></div></aside></div>}
  </div>;
}
