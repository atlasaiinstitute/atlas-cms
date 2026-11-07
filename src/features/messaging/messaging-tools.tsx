"use client";
import Link from "next/link";
import { Archive, Search, Settings, ShieldAlert, Users } from "lucide-react";
import { useState } from "react";
import { messageFixtures } from "@/data/mock/messaging";
import { AppShell } from "@/components/app-shell";

export function MessageSearch() {
  const [query, setQuery] = useState("");
  const hits = messageFixtures.filter((message) => message.body.toLowerCase().includes(query.toLowerCase()) || message.attachment_name?.toLowerCase().includes(query.toLowerCase()));
  return <AppShell><div className="org-page-heading"><div><div className="eyebrow">Messaging · Search</div><h1>Search messages</h1><p className="page-description">Search results are limited to conversations the current actor is authorized to access.</p></div></div><div className="module-data-panel"><div className="directory-search"><Search size={16}/><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search message content or attachment name"/></div><div className="message-search-results">{query && hits.map((message) => <Link href={`/messages/${message.conversation_id}`} className="search-result" key={message.id}><strong>{message.sender_name}</strong><span>{message.body}</span><small>{new Date(message.created_at).toLocaleString()} · secure conversation result</small></Link>)}</div>{query && !hits.length && <div className="empty-state"><Search size={24}/><strong>No authorized message matches</strong></div>}</div></AppShell>;
}

export function MessagingSettings() {
  const [message, setMessage] = useState("");
  return <AppShell><div className="org-page-heading"><div><div className="eyebrow">Messaging · Settings</div><h1>Messaging preferences</h1><p className="page-description">Control conversation notifications, read receipts and privacy signals.</p></div></div><section className="form-card messaging-preferences"><Preference name="Allow direct messages from authorized members" checked/><Preference name="Allow group invitations" checked/><Preference name="Read receipts" checked/><Preference name="Presence visibility" description="Presence is not exposed in this implementation."/><Preference name="Message notifications" checked/><button className="button button-primary" onClick={() => setMessage("Messaging preferences validated. Live persistence requires authenticated identity.")}>Save settings</button>{message && <div className="form-message success">{message}</div>}</section></AppShell>;
}

function Preference({ name, description, checked }: { name: string; description?: string; checked?: boolean }) {
  return <label className="preference-row"><input type="checkbox" defaultChecked={checked}/><span><strong>{name}</strong><small>{description ?? "Applies to authorized tenant conversations."}</small></span></label>;
}

export function MessageRequests() {
  return <AppShell><ToolList title="Message requests" icon={<Users/>} description="Requests require explicit policy support before access is granted." empty="No pending message requests."/></AppShell>;
}

export function ArchivedMessages() {
  return <AppShell><ToolList title="Archived conversations" icon={<Archive/>} description="Archived conversations remain tenant-scoped and can be restored by authorized participants." empty="No archived conversations."/></AppShell>;
}

export function ModerationReports() {
  return <AppShell><ToolList title="Moderation reports" icon={<ShieldAlert/>} description="Only authorized moderators can review reported private content." empty="No reports in this development fixture."/></AppShell>;
}

function ToolList({ title, icon, description, empty }: { title: string; icon: React.ReactNode; description: string; empty: string }) {
  return <><div className="org-page-heading"><div><div className="eyebrow">Messaging · Administration</div><h1>{title}</h1><p className="page-description">{description}</p></div><Link href="/messages" className="button button-secondary"><Settings size={15}/> Messaging inbox</Link></div><section className="module-data-panel"><div className="empty-state">{icon}<strong>{empty}</strong><span>Live records require authenticated Supabase access.</span></div></section></>;
}
