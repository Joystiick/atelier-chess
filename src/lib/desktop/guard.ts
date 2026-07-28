import { cookies, headers } from "next/headers";

/** True when the request comes from the Electron client (header, cookie, or UA). */
export async function isDesktopRequest(request?: Request): Promise<boolean> {
  const h = request?.headers ?? (await headers());
  if (h.get("x-atelier-desktop") === "1") return true;
  const jar = await cookies();
  if (jar.get("atelier_desktop")?.value === "1") return true;
  const ua = h.get("user-agent") ?? "";
  return /\bElectron\//i.test(ua) || /\bAtelierDesktop\//i.test(ua);
}
