export type DesktopAsset = {
  url: string;
  sha256: string | null;
};

export type DesktopLatest = {
  version: string;
  releasedAt: string;
  notes: string;
  windows: {
    x64: DesktopAsset;
  };
  mac: {
    universal: DesktopAsset;
  };
};

export const DESKTOP_LATEST_PATH = "/desktop/latest.json";

export function hasDownloadUrl(asset: DesktopAsset | undefined): boolean {
  return Boolean(asset?.url?.trim());
}

export async function fetchDesktopLatest(
  init?: RequestInit,
): Promise<DesktopLatest | null> {
  try {
    const res = await fetch(DESKTOP_LATEST_PATH, {
      ...init,
      headers: {
        Accept: "application/json",
        ...(init?.headers ?? {}),
      },
    });
    if (!res.ok) return null;
    return (await res.json()) as DesktopLatest;
  } catch {
    return null;
  }
}
