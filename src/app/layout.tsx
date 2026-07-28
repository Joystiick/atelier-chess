import { AuthProvider } from "@/components/auth/AuthProvider";
import { Fraunces, Outfit } from "next/font/google";
import type { Metadata, Viewport } from "next";
import { DesktopBridge } from "@/components/ui/DesktopBridge";
import { InstallPrompt } from "@/components/ui/InstallPrompt";
import { PatchNotes } from "@/components/ui/PatchNotes";
import { PresenceHeartbeat } from "@/components/ui/PresenceHeartbeat";
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
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://atelierchess.netlify.app",
  ),
  title: "Atelier Chess",
  description:
    "Download Atelier Chess for Windows and Mac, or play two-player chess in the browser with room codes and AI.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/icons/favicon-16.png", sizes: "16x16", type: "image/png" },
      { url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
  appleWebApp: {
    capable: true,
    title: "Atelier",
    statusBarStyle: "black-translucent",
  },
  openGraph: {
    title: "Atelier Chess",
    description:
      "Download Atelier Chess for Windows and Mac, or play two-player chess in the browser with room codes and AI.",
    images: [{ url: "/icons/icon-512.png", width: 512, height: 512 }],
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
        <DesktopBridge />
        <AuthProvider>
          <PresenceHeartbeat />
          <InstallPrompt />
          <div className="app-shell">{children}</div>
          <PatchNotes />
        </AuthProvider>
      </body>
    </html>
  );
}
