import type { Metadata } from "next";
import "./globals.css";
import "./app-shell.css";
import "@/features/analytics/analytics.css";
import "@/features/audit-logs/audit-logs.css";
import "@/features/white-label/white-label.css";
import "@/features/public-site/public-site.css";
import "@/features/public-site/expanded-public.css";

export const metadata: Metadata = {
  title: "ATLAS CMS · Atlas AI Institute",
  description: "Centralized Community, Organization & Network Management Platform.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
