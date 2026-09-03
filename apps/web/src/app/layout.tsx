import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

// next/font self-hosts and optimizes these instead of a manual <link> tag
// (which only loads for whichever page renders it first — Next's own
// no-page-custom-font lint rule flags exactly this). variable matches the
// --font-ui/--font-mono custom properties globals.css already expects.
const inter = Inter({ subsets: ["latin"], variable: "--font-ui" });
const jetbrainsMono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: "Arena OS — AI Agent Mission Control",
  description:
    "Personal AI operating system. Multi-model orchestration, autonomous agents, tool integrations, BMONI-settled x402 payments.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body className="min-h-screen bg-arena-bg">{children}</body>
    </html>
  );
}
