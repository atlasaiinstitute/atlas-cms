"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  AlertCircle,
  BarChart3,
  Bell,
  BookOpen,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  ClipboardList,
  FileText,
  GalleryVerticalEnd,
  Globe2,
  LayoutDashboard,
  LifeBuoy,
  ListChecks,
  LogOut,
  Menu,
  MessageSquare,
  Moon,
  MoreHorizontal,
  Network,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Sun,
  Users,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { OrganizationSwitcher } from "@/components/organization-switcher";

const navigation = [
  { label: "OVERVIEW", items: [{ label: "Dashboard", href: "/dashboard", icon: LayoutDashboard }] },
  {
    label: "MANAGEMENT",
    items: [
      { label: "Organizations", href: "/organizations", icon: Globe2 },
      { label: "Communities", href: "/communities", icon: Network },
      { label: "Members", href: "/members", icon: Users },
      { label: "Applications", href: "/applications", icon: ClipboardList },
    ],
  },
  {
    label: "GOVERNANCE",
    items: [
      { label: "Committees", href: "/governance", icon: ShieldCheck },
      { label: "Roles & Permissions", href: "/roles", icon: ListChecks },
    ],
  },
  {
    label: "OPERATIONS",
    items: [
      { label: "Events", href: "/events", icon: CalendarDays },
      { label: "Content", href: "/content", icon: FileText },
      { label: "Resources", href: "/resources", icon: BookOpen },
      { label: "Announcements", href: "/announcements", icon: Bell },
      { label: "Messages", href: "/messages", icon: MessageSquare },
    ],
  },
  {
    label: "INSIGHTS",
    items: [
      { label: "Analytics", href: "/analytics", icon: BarChart3 },
      { label: "Audit Logs", href: "/audit-logs", icon: Activity },
    ],
  },
  { label: "SYSTEM", items: [{ label: "Settings", href: "/settings", icon: Settings }, { label: "Branding & domains", href: "/settings/branding", icon: Globe2 }] },
] as const;

const pageNames: Record<string, { eyebrow: string; title: string; description: string }> = {
  dashboard: { eyebrow: "Overview", title: "Good morning, Alex", description: "Here’s what’s happening across your Atlas network today." },
  organizations: { eyebrow: "Management", title: "Organizations", description: "Manage the organizations connected to Atlas AI Institute." },
  communities: { eyebrow: "Management", title: "Communities", description: "Organize your network into focused communities and cohorts." },
  members: { eyebrow: "Management", title: "Members", description: "View and manage people across your organization and communities." },
  applications: { eyebrow: "Management", title: "Applications", description: "Review applications and route candidates to the right community." },
  committees: { eyebrow: "Governance", title: "Committees", description: "Coordinate governance groups, members and meeting records." },
  roles: { eyebrow: "Governance", title: "Roles & Permissions", description: "Define access boundaries for your multi-tenant workspace." },
  events: { eyebrow: "Operations", title: "Events", description: "Plan gatherings, workshops and community programming." },
  content: { eyebrow: "Operations", title: "Content", description: "Create and maintain useful knowledge for your network." },
  resources: { eyebrow: "Operations", title: "Resources", description: "Curate resources and manage access across communities." },
  announcements: { eyebrow: "Operations", title: "Announcements", description: "Share timely updates with the people who need them." },
  messages: { eyebrow: "Operations", title: "Messages", description: "Keep conversations organized across your network." },
  analytics: { eyebrow: "Insights", title: "Analytics", description: "Understand the health and momentum of your communities." },
  platform: { eyebrow: "Insights", title: "Platform analytics", description: "Privacy-safe aggregate platform metrics." },
  governance: { eyebrow: "Insights", title: "Governance analytics", description: "Aggregate committee and action-item metrics." },
  engagement: { eyebrow: "Insights", title: "Engagement analytics", description: "Announcements, notification states and aggregate activity." },
  reports: { eyebrow: "Insights", title: "Report centre", description: "Create, preview and export authorized aggregate reports." },
  "audit-logs": { eyebrow: "Insights", title: "Audit Logs", description: "Trace important activity across the Atlas workspace." },
  settings: { eyebrow: "System", title: "Settings", description: "Configure your workspace preferences and organization details." },
  branding: { eyebrow: "System", title: "Branding settings", description: "Configure your organization identity and tenant branding tokens." },
  domains: { eyebrow: "System", title: "Custom domains", description: "Connect verified organization subdomains and custom domains." },
  "white-label": { eyebrow: "System", title: "White-label controls", description: "Configure the organization welcome experience and email identity." },
};

function Brand({ collapsed = false }: { collapsed?: boolean }) {
  return (
    <div className={`brand ${collapsed ? "brand-collapsed" : ""}`}>
      <span className="brand-mark"><span>A</span></span>
      {!collapsed && <span className="brand-copy"><strong>ATLAS</strong><small>CMS</small></span>}
    </div>
  );
}

function Sidebar({ collapsed, onCollapse, onClose }: { collapsed: boolean; onCollapse: () => void; onClose?: () => void }) {
  const pathname = usePathname();
  return (
    <aside className={`sidebar ${collapsed ? "sidebar-collapsed" : ""}`}>
      <div className="sidebar-top">
        <Brand collapsed={collapsed} />
        {onClose && <button className="icon-button sidebar-close" aria-label="Close navigation" onClick={onClose}><X size={18} /></button>}
      </div>
      {!collapsed && <OrganizationSwitcher />}
      <nav className="sidebar-nav" aria-label="Primary navigation">
        {navigation.map((group) => (
          <div className="nav-group" key={group.label}>
            {!collapsed && <div className="nav-label">{group.label}</div>}
            {group.items.map((item) => {
              const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
              const Icon = item.icon;
              return <Link key={item.href} href={item.href} onClick={onClose} className={`nav-item ${active ? "active" : ""}`} title={collapsed ? item.label : undefined}><Icon size={17} strokeWidth={active ? 2.2 : 1.8} /><span>{item.label}</span>{active && !collapsed && <span className="active-bar" />}</Link>;
            })}
          </div>
        ))}
      </nav>
      <div className="sidebar-footer">
        {!collapsed && <Link href="/help" className="sidebar-footer-link"><LifeBuoy size={17} /> Help &amp; support</Link>}
        <div className="user-card">
          <div className="avatar avatar-blue">AM</div>
          {!collapsed && <span className="user-details"><strong>Alex Morgan</strong><small>Administrator</small></span>}
          {!collapsed && <MoreHorizontal size={17} className="muted-icon" />}
        </div>
        <button className="collapse-control" onClick={onCollapse} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}>{collapsed ? <PanelLeftOpen size={17} /> : <><PanelLeftClose size={17} /><span>Collapse sidebar</span></>}</button>
      </div>
    </aside>
  );
}

function Topbar({ onMenu, onToggleTheme, dark }: { onMenu: () => void; onToggleTheme: () => void; dark: boolean }) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const pathname = usePathname();
  const slug = pathname.split("/").filter(Boolean).pop() ?? "dashboard";
  const current = pageNames[slug] ?? pageNames.dashboard;
  return <header className="topbar">
    <div className="topbar-left"><button className="icon-button mobile-menu" onClick={onMenu} aria-label="Open navigation"><Menu size={20} /></button><div className="breadcrumbs"><span>Workspace</span><ChevronRight size={13} /><strong>{current.title}</strong></div></div>
    <div className="topbar-actions">
      <div className={`global-search ${searchOpen ? "search-open" : ""}`}><Search size={17} /><input aria-label="Search workspace" placeholder="Search workspace" onFocus={() => setSearchOpen(true)} onBlur={() => setSearchOpen(false)} /><kbd>⌘ K</kbd></div>
      <button className="icon-button theme-button" onClick={onToggleTheme} aria-label="Toggle theme">{dark ? <Sun size={18} /> : <Moon size={18} />}</button>
      <div className="popover-wrap"><button className="icon-button notification-button" onClick={() => setNotificationsOpen(!notificationsOpen)} aria-label="Notifications"><Bell size={18} /><span className="notification-dot" /></button>{notificationsOpen && <div className="popover notification-popover"><div className="popover-heading"><strong>Notifications</strong><span className="badge badge-gold">2 unread</span></div><p><span className="notification-pip pip-gold" />New announcement published</p><p><span className="notification-pip pip-blue" />New resource available</p><Link href="/notifications" className="text-link">Open notification inbox</Link><Link href="/notifications/preferences" className="text-link">Manage preferences</Link></div>}</div>
      <button className="icon-button help-button" aria-label="Help"><CircleHelp size={18} /></button>
      <div className="popover-wrap"><button className="top-user" onClick={() => setUserOpen(!userOpen)}><span className="avatar avatar-blue">AM</span><span className="top-user-name">Alex Morgan</span><ChevronDown size={14} /></button>{userOpen && <div className="popover user-popover"><strong>Alex Morgan</strong><small>alex@atlas.ai</small><hr /><button><Settings size={15} /> Account settings</button><button><LogOut size={15} /> Sign out</button></div>}</div>
    </div>
  </header>;
}

function DashboardContent() {
  return <>
    <div className="welcome-row"><div><div className="eyebrow">Monday, November 6, 2026</div><h1>Good morning, Alex <span className="wave">✦</span></h1><p className="page-description">Here’s what’s happening across your Atlas network today.</p></div><button className="button button-primary"><Sparkles size={16} /> Create new</button></div>
    <div className="stat-grid"><div className="stat-card"><div className="stat-head"><span>Total members</span><span className="stat-icon blue"><Users size={17} /></span></div><strong>1,284</strong><p><span className="trend up">↑ 12.5%</span> <span>vs. last month</span></p></div><div className="stat-card"><div className="stat-head"><span>Active communities</span><span className="stat-icon gold"><Network size={17} /></span></div><strong>24</strong><p><span className="trend up">↑ 2</span> <span>new this quarter</span></p></div><div className="stat-card"><div className="stat-head"><span>Pending applications</span><span className="stat-icon purple"><ClipboardList size={17} /></span></div><strong>38</strong><p><span className="trend neutral">7 due soon</span> <span>within 48 hours</span></p></div><div className="stat-card"><div className="stat-head"><span>Upcoming events</span><span className="stat-icon green"><CalendarDays size={17} /></span></div><strong>12</strong><p><span className="trend neutral">Next: Nov 8</span> <span>Community forum</span></p></div></div>
    <div className="content-grid"><section className="panel activity-panel"><div className="panel-heading"><div><h2>Network overview</h2><p>Member growth over the last 6 months</p></div><button className="select-button">Last 6 months <ChevronDown size={14} /></button></div><div className="chart"><div className="chart-y"><span>1.5k</span><span>1.0k</span><span>500</span><span>0</span></div><div className="chart-main"><div className="grid-lines"><i /><i /><i /><i /></div><svg viewBox="0 0 640 210" preserveAspectRatio="none" aria-label="Member growth chart" role="img"><defs><linearGradient id="area" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#9db9d8" stopOpacity=".38" /><stop offset="100%" stopColor="#9db9d8" stopOpacity="0" /></linearGradient></defs><path d="M0,172 C50,166 78,157 108,160 S164,134 214,146 S261,128 320,124 S362,91 426,105 S477,77 532,72 S594,45 640,38 L640,210 L0,210Z" fill="url(#area)" /><path d="M0,172 C50,166 78,157 108,160 S164,134 214,146 S261,128 320,124 S362,91 426,105 S477,77 532,72 S594,45 640,38" fill="none" stroke="#527aa6" strokeWidth="3" vectorEffect="non-scaling-stroke" /></svg><div className="chart-x"><span>Jun</span><span>Jul</span><span>Aug</span><span>Sep</span><span>Oct</span><span>Nov</span></div></div></div></section><section className="panel upcoming-panel"><div className="panel-heading"><div><h2>Upcoming events</h2><p>What’s next for your network</p></div><Link href="/events" className="text-link">View all</Link></div><div className="event-list"><div className="event-item"><div className="date-tile"><strong>08</strong><span>NOV</span></div><div><strong>Community Leadership Forum</strong><span>Thu, 10:00 AM · Main Auditorium</span></div><button className="more-button" aria-label="More event options"><MoreHorizontal size={17} /></button></div><div className="event-item"><div className="date-tile"><strong>14</strong><span>NOV</span></div><div><strong>AI Ethics Working Group</strong><span>Wed, 2:00 PM · Virtual meeting</span></div><button className="more-button" aria-label="More event options"><MoreHorizontal size={17} /></button></div><div className="event-item"><div className="date-tile"><strong>21</strong><span>NOV</span></div><div><strong>Member networking evening</strong><span>Thu, 6:30 PM · Atlas House</span></div><button className="more-button" aria-label="More event options"><MoreHorizontal size={17} /></button></div></div></section></div>
    <div className="content-grid bottom-grid"><section className="panel table-panel"><div className="panel-heading"><div><h2>Recent applications</h2><p>Latest membership applications to review</p></div><Link href="/applications" className="text-link">View all</Link></div><div className="table-wrap"><table><thead><tr><th>Applicant</th><th>Community</th><th>Applied</th><th>Status</th></tr></thead><tbody><tr><td><span className="table-person"><span className="avatar avatar-lilac">JR</span><strong>Jordan Reed</strong></span></td><td>AI Researchers</td><td>Today, 9:42 AM</td><td><span className="badge badge-gold">In review</span></td></tr><tr><td><span className="table-person"><span className="avatar avatar-peach">SK</span><strong>Samira Khan</strong></span></td><td>Future Leaders</td><td>Yesterday</td><td><span className="badge badge-blue">New</span></td></tr><tr><td><span className="table-person"><span className="avatar avatar-mint">DW</span><strong>Daniel Wong</strong></span></td><td>AI Researchers</td><td>Nov 3, 2026</td><td><span className="badge badge-green">Approved</span></td></tr></tbody></table></div></section><section className="panel quick-panel"><div className="panel-heading"><div><h2>Quick actions</h2><p>Common workspace tasks</p></div></div><div className="quick-actions"><Link href="/members"><Users size={18} /><span>Add a member</span><ChevronRight size={15} /></Link><Link href="/events"><CalendarDays size={18} /><span>Schedule an event</span><ChevronRight size={15} /></Link><Link href="/announcements"><Bell size={18} /><span>Post an announcement</span><ChevronRight size={15} /></Link></div></section></div>
  </>;
}

export function AppShell({ children }: { children?: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dark, setDark] = useState(false);
  useEffect(() => { document.documentElement.dataset.theme = dark ? "dark" : "light"; }, [dark]);
  const pathname = usePathname();
  const slug = pathname.split("/").filter(Boolean).pop() ?? "dashboard";
  const current = useMemo(() => pageNames[slug] ?? pageNames.dashboard, [slug]);
  return <div className="app-frame"><div className={`mobile-overlay ${mobileOpen ? "visible" : ""}`} onClick={() => setMobileOpen(false)} /><div className={`sidebar-wrap ${mobileOpen ? "mobile-visible" : ""}`}><Sidebar collapsed={collapsed} onCollapse={() => setCollapsed(!collapsed)} onClose={() => setMobileOpen(false)} /></div><div className={`app-main ${collapsed ? "main-expanded" : ""}`}><Topbar onMenu={() => setMobileOpen(true)} onToggleTheme={() => setDark(!dark)} dark={dark} /><main className="workspace"><div className="mobile-page-title"><span>{current.eyebrow}</span><h1>{current.title}</h1></div>{children ?? <section className="module-state"><div className="module-icon"><GalleryVerticalEnd size={24} /></div><span className="eyebrow">{current.eyebrow}</span><h1>{current.title}</h1><p>{current.description}</p><div className="module-note"><AlertCircle size={16} /><span>This module is part of the ATLAS CMS foundation and will be implemented in the next stage.</span></div></section>}</main><footer className="app-footer"><span>ATLAS CMS · Atlas AI Institute</span><span>Foundation preview · <Link href="/settings">Workspace settings</Link></span></footer></div></div>;
}

export { DashboardContent };
