import type { Metadata } from "next";
import DownloadPageClient from "./DownloadPageClient";

export const metadata: Metadata = {
  title: "Download · Atelier Chess",
  description:
    "Download Atelier Chess for Windows x64 and macOS. Installer help for SmartScreen and Gatekeeper.",
};

export default function DownloadPage() {
  return <DownloadPageClient />;
}
