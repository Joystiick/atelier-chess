import { Fraunces, Outfit } from "next/font/google";
import type { Metadata } from "next";
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
  title: "Atelier Chess",
  description: "Two-player chess with room codes, or play against AI.",
  openGraph: {
    title: "Atelier Chess",
    description: "Two-player chess with room codes, or play against AI.",
  },
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
        <div className="app-shell">{children}</div>
      </body>
    </html>
  );
}
