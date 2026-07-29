# Desktop updates (Electron)

Atelier Chess desktop uses `electron-updater`.

## Soft signing stance

- **Unsigned / local betas**: update checks soft-fail. The app stays usable; Settings → Check for updates explains the failure.
- **Signed releases**: publish `latest.yml` (Windows) / mac equivalents with your GitHub Releases (or static feed). Then auto-download + quit-and-install works.

## Without certificates

You can still ship installers. Users re-download from the site when a new version lands. Set empty download URLs in `public/desktop/latest.json` until assets exist.

## With certificates (later)

1. Sign Windows with Authenticode / Mac with Developer ID.
2. Point `electron-builder` publish config at your feed.
3. Ship; clients will prompt “Restart now / Later” after download.

Never force-quit on updater errors.
