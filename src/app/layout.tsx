import type { Metadata } from "next";
import "./globals.css";
import { SkipToContent } from "@/components/layout/SkipToContent";
import { PublicHeader } from "@/components/layout/PublicHeader";
import { PublicFooter } from "@/components/layout/PublicFooter";

export const metadata: Metadata = {
  title: {
    default: "TNP Portal | Department of Architecture & Planning, VNIT Nagpur",
    template: "%s | TNP Portal — Architecture & Planning, VNIT Nagpur",
  },
  description:
    "Official Training & Placement Portal for the Department of Architecture & Planning, Visvesvaraya National Institute of Technology, Nagpur.",
  keywords: [
    "VNIT Nagpur",
    "Architecture and Planning",
    "Training and Placement",
    "B.Arch",
    "M.Plan",
    "Campus Placements",
    "Architectural Internships",
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-[var(--color-bg)] text-[var(--color-text-primary)]">
        <SkipToContent />
        <PublicHeader />
        <main
          id="main-content"
          tabIndex={-1}
          className="flex-1 w-full min-w-0 focus:outline-none"
        >
          {children}
        </main>
        <PublicFooter />
      </body>
    </html>
  );
}
