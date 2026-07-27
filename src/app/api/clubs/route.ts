import { requireUser } from "@/lib/auth/requireUser";
import { db } from "@/lib/db";
import { clubMembers, clubs } from "@/lib/db/schema";
import { desc, eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";

function slugify(name: string) {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  return base || "club";
}

export async function GET() {
  const auth = await requireUser();
  if (auth.error) return auth.error;
  const me = auth.user;

  const memberships = await db
    .select()
    .from(clubMembers)
    .where(eq(clubMembers.userId, me.id));

  const myClubIds = memberships.map((m) => m.clubId);
  const myClubs =
    myClubIds.length === 0
      ? []
      : await db.select().from(clubs).where(inArray(clubs.id, myClubIds));

  const all = await db
    .select()
    .from(clubs)
    .orderBy(desc(clubs.createdAt))
    .limit(40);

  const mapClub = (c: (typeof all)[number]) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    description: c.description,
    openTableCode: c.openTableCode,
    ownerId: c.ownerId,
  });

  return NextResponse.json({
    mine: myClubs.map(mapClub),
    clubs: all.map(mapClub),
  });
}

export async function POST(request: Request) {
  const auth = await requireUser();
  if (auth.error) return auth.error;
  const me = auth.user;

  const body = (await request.json().catch(() => ({}))) as {
    name?: string;
    description?: string;
  };
  const name = (body.name ?? "").trim().slice(0, 60);
  if (!name) {
    return NextResponse.json({ error: "Name required" }, { status: 400 });
  }
  const description = (body.description ?? "").trim().slice(0, 400);

  let slug = slugify(name);
  for (let i = 0; i < 6; i++) {
    try {
      const [row] = await db
        .insert(clubs)
        .values({
          name,
          slug,
          description,
          ownerId: me.id,
        })
        .returning();

      await db.insert(clubMembers).values({
        clubId: row.id,
        userId: me.id,
      });

      return NextResponse.json({
        club: {
          id: row.id,
          name: row.name,
          slug: row.slug,
          description: row.description,
          openTableCode: row.openTableCode,
          ownerId: row.ownerId,
        },
      });
    } catch {
      slug = `${slugify(name)}-${Math.floor(Math.random() * 900 + 100)}`;
    }
  }

  return NextResponse.json({ error: "Could not create club" }, { status: 500 });
}
