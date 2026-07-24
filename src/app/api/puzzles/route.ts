import { puzzleOfTheDay, shufflePuzzles } from "@/lib/chess/puzzles";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("mode") ?? "daily";
  if (mode === "rush") {
    return NextResponse.json({ puzzles: shufflePuzzles(8) });
  }
  return NextResponse.json({ puzzle: puzzleOfTheDay() });
}
