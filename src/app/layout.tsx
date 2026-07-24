import { Fraunces, Outfit } from "next/font/google";
import type { Metadata, Viewport } from "next";
import { RegisterSW } from "@/components/ui/RegisterSW";
import { StarfieldBackground } from "@/components/ui/StarfieldBackground";
import "./globals.css";

const display = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
});

const sans = Outfit({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://atelier-chess-5585.netlify.app",
  ),
  title: "Atelier Chess",
  description: "Two-player chess with room codes, or play against AI.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Atelier",
    statusBarStyle: "black-translucent",
  },
  openGraph: {
    title: "Atelier Chess",
    description: "Two-player chess with room codes, or play against AI.",
  },
};

export const viewport: Viewport = {
  themeColor: "#1a2e24",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable} h-full`}>
      <body className="min-h-full font-[family-name:var(--font-sans)] antialiased">
        <StarfieldBackground />
        <RegisterSW />
        <div className="app-shell">{children}</div>
      </body>
    </html>
  );
}
