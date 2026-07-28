import { cookies } from "next/headers";

/** True when the request comes from the Electron client (cookie or UA). */
export async function isDesktopRequest(request?: Request): Promise<boolean> {
  const jar = await cookies();
  if (jar.get("atelier_desktop")?.value === "1") return true;
  const ua = request?.headers.get("user-agent") ?? "";
  return /\bElectron\//i.test(ua);
}
