"use client";

import { Check, ChevronsUpDown } from "lucide-react";
import { useEffect, useState } from "react";
import { organizationFixtures } from "@/data/mock/organizations";

const availableOrganizations = organizationFixtures.filter((organization) => ["active", "pending"].includes(organization.status));

export function OrganizationSwitcher() {
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState(availableOrganizations[0]?.id ?? "");
  const selected = availableOrganizations.find((organization) => organization.id === selectedId) ?? availableOrganizations[0];
  useEffect(() => { const stored = window.localStorage.getItem("atlas.selectedOrganization"); if (stored && availableOrganizations.some((organization) => organization.id === stored)) setSelectedId(stored); }, []);
  function select(id: string) { setSelectedId(id); window.localStorage.setItem("atlas.selectedOrganization", id); document.cookie = `atlas_organization_id=${id}; Path=/; SameSite=Lax`; setOpen(false); }
  if (!selected) return null;
  return <div className="org-switcher-wrap"><button className="org-switcher" type="button" aria-expanded={open} onClick={() => setOpen(!open)}><span className="org-avatar">{selected.name.split(" ").map((part) => part[0]).join("").slice(0, 2)}</span><span className="org-details"><strong>{selected.name}</strong><small>Selected organization</small></span><ChevronsUpDown size={15} /></button>{open && <div className="org-switcher-menu">{availableOrganizations.map((organization) => <button key={organization.id} onClick={() => select(organization.id)}><span className="org-avatar">{organization.name.split(" ").map((part) => part[0]).join("").slice(0, 2)}</span><span><strong>{organization.name}</strong><small>{organization.status === "pending" ? "Pending activation" : "Active membership"}</small></span>{organization.id === selected.id && <Check size={15} />}</button>)}</div>}</div>;
}
