import type { Metadata } from "next";

type Props = {
  params: Promise<{ username: string }>;
  children: React.ReactNode;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const raw = (await params).username;
  const username = decodeURIComponent(raw ?? "").replace(/^@/, "").trim();
  const label = username ? `@${username}` : "a player";
  return {
    title: `Challenge ${label} · Atelier Chess`,
    description: `Sit at a rated Atelier table with ${label}.`,
    openGraph: {
      title: `Challenge ${label}`,
      description: "Atelier Chess — rated table, clocks, rematch.",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: `Challenge ${label}`,
      description: "Atelier Chess — rated table, clocks, rematch.",
    },
  };
}

export default function ChallengeLayout({ children }: Props) {
  return children;
}
