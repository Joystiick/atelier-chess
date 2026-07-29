import { avatarEmoji } from "@/lib/auth/avatars";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Challenge card — Atelier Chess";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

type Props = { params: Promise<{ username: string }> };

export default async function ChallengeOgImage({ params }: Props) {
  const raw = (await params).username;
  const username = decodeURIComponent(raw ?? "").replace(/^@/, "").trim();
  let display = username || "Player";
  let elo = 1200;
  let avatar = "♞";

  if (username) {
    try {
      const [row] = await db
        .select({
          username: users.username,
          elo: users.elo,
          avatarId: users.avatarId,
        })
        .from(users)
        .where(eq(users.username, username))
        .limit(1);
      if (row) {
        display = row.username;
        elo = row.elo;
        avatar = avatarEmoji(row.avatarId);
      }
    } catch {
      // Share card still renders without DB
    }
  }

  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          background:
            "linear-gradient(145deg, #0c1210 0%, #1a2e24 45%, #0a0e0c 100%)",
          color: "#f4e8d0",
          fontFamily: "Georgia, serif",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          <div
            style={{
              fontSize: 28,
              letterSpacing: 8,
              textTransform: "uppercase",
              color: "#c9a227",
            }}
          >
            Challenge card
          </div>
          <div style={{ fontSize: 36, color: "#9aab9c" }}>Atelier Chess</div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 36 }}>
          <div
            style={{
              width: 140,
              height: 140,
              borderRadius: 24,
              background: "rgba(201, 162, 39, 0.12)",
              border: "1px solid rgba(201, 162, 39, 0.45)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 72,
            }}
          >
            {avatar}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ fontSize: 72, letterSpacing: -1 }}>@{display}</div>
            <div style={{ fontSize: 34, color: "#c9a227" }}>Elo {elo}</div>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            fontSize: 28,
            color: "#9aab9c",
          }}
        >
          <div>Rated table · clocks · rematch</div>
          <div style={{ color: "#c9a227" }}>Open to sit</div>
        </div>
      </div>
    ),
    { ...size },
  );
}
