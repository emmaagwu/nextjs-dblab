import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";
import { NavBar } from "@/components/NavBar";

export const metadata: Metadata = {
  title: { default: "DBLab — Phase 4", template: "%s · DBLab" },
  description: "Master Prisma 7, Neon, and PostgreSQL patterns for Next.js 15",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="font-sans min-h-screen bg-zinc-950">
        <NavBar />
        <main>{children}</main>
      </body>
    </html>
  );
}