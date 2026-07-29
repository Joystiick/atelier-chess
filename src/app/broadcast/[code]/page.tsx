import { redirect } from "next/navigation";

type Props = { params: Promise<{ code: string }> };

/** Dedicated OBS entry — redirects to overlay-friendly watch board. */
export default async function BroadcastPage({ params }: Props) {
  const { code: raw } = await params;
  const code = raw.replace(/\D/g, "").padStart(8, "0").slice(-8);
  redirect(`/watch/${code}?overlay=1`);
}
