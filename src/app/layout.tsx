import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Printer Toolkit",
  description:
    "Multi-tenant printer security auditing for corporate fleets. Non-destructive assessment of exposed printing protocols, SNMP, and management interfaces.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
