# Atelier Chess — Desktop Client

Electron shell that loads the live Atelier Chess web app. Multiplayer, auth, and Pusher stay on Netlify — nothing from Next/Neon is embedded in the binary.

## Requirements

- Node.js 20+
- For installers: Windows (NSIS x64) and/or macOS (universal DMG)

## Run locally

```bash
cd desktop
npm install
npm start
```

Default site URL is always `https://atelierchess.netlify.app` (cloud multiplayer). To hit a local Next server instead:

```bash
# Windows PowerShell
$env:ATELIER_URL="http://localhost:3000"; npm start

# macOS / Linux
ATELIER_URL=http://localhost:3000 npm start
```

From the repo root:

```bash
npm run desktop:dev
# or
npm run desktop
```

## Environment

| Variable      | When                         | Purpose                                      |
|---------------|------------------------------|----------------------------------------------|
| `ATELIER_URL` | Dev / preview                | Override site origin (e.g. `http://localhost:3000`) |
| `GH_TOKEN`    | Publishing releases          | GitHub token for `electron-builder` publish  |
| `CSC_LINK` / `CSC_KEY_PASSWORD` | Windows code signing | See signing notes below                 |
| `APPLE_ID` / `APPLE_APP_SPECIFIC_PASSWORD` / `APPLE_TEAM_ID` | macOS notarization | See signing notes |

Unset `ATELIER_URL` → production Netlify URL in both packaged and unpackaged runs.

## Build installers

```bash
cd desktop
npm run dist:win    # NSIS x64 only (no Win x86)
npm run dist:mac    # universal DMG + zip (macOS host required)
npm run dist        # current platform
```

Artifacts land in `desktop/release/`.

Expected artifact names (must stay aligned with `public/desktop/latest.json` / `scripts/write-latest-json.mjs`):

- Windows: `AtelierChess-Setup-<version>-x64.exe`
- macOS: `AtelierChess-<version>-mac.dmg`

Publishing is configured for GitHub Releases (`Joystiick/atelier-chess`). CI or a local publish needs `GH_TOKEN` with `contents: write`.

```bash
npx electron-builder --publish always
```

## Deep links

Protocol: `atelier://`

Examples:

- `atelier://join/ABC12345` → `/join/ABC12345`
- `atelier://watch/ABC12345` → `/watch/ABC12345`
- `atelier://challenge/alice` → `/challenge/alice`
- `atelier://friends` → `/friends`

## Web bridge

Preload exposes:

```ts
window.atelierDesktop = {
  isDesktop: true,
  platform: process.platform,
  version: string,
  openExternal: (url: string) => Promise<void>,
  quit: () => void,
};
```

Detect in the web app with `useDesktopClient()` or `window.atelierDesktop?.isDesktop`.

## Auto-update

`electron-updater` checks GitHub Releases on launch (packaged only). Failures are soft — unsigned betas and missing feeds log a warning and keep running. Users can also use **Help → Check for updates…**.

## CI / GitHub Releases

Workflow: [`.github/workflows/desktop.yml`](../.github/workflows/desktop.yml). Deeper runbook: [`docs/desktop-release.md`](../docs/desktop-release.md).

| Trigger | Result |
|---------|--------|
| `workflow_dispatch` | Windows + macOS matrix builds; artifacts uploaded only (no GitHub Release) |
| Push tag `desktop-v*` | Same builds → GitHub Release + installers + `public/desktop/latest.json` attached |

Matrix: `windows-latest` (`dist:win`) and `macos-latest` (`dist:mac`). Fail-fast is off so one OS failure does not cancel the other.

### Release a version

1. Bump `version` in `desktop/package.json` (semver, e.g. `0.1.0`).
2. Commit and push that change to the branch you release from.
3. Tag and push (tag must be `desktop-v` + semver):

```bash
git tag desktop-v0.1.0
git push origin desktop-v0.1.0
```

4. On tag pushes the workflow syncs `desktop/package.json` version from the tag, builds both platforms, and publishes a GitHub Release with the installers.
5. The `update-latest` job then downloads those assets, writes `public/desktop/latest.json` (URLs + sha256), and commits it to the default branch so Netlify CTAs update after deploy. Until the first tagged release, site CTAs show “Coming soon”.

Note: `electron-builder.yml` sets `publish.releaseType: release`, so every `desktop-v*` tag publishes a full GitHub Release (not a GitHub “prerelease”), including hyphenated versions like `0.1.0-beta.1`.

### GitHub Actions secrets

Add under **Settings → Secrets and variables → Actions**. Leave unset for unsigned betas — electron-builder treats empty values as “skip signing.”

| Secret | Platform | Purpose |
|--------|----------|---------|
| `CSC_LINK` | Win / Mac | Base64 (CI) or path to code-signing cert (`.pfx` / `.p12`) |
| `CSC_KEY_PASSWORD` | Win / Mac | Certificate password |
| `APPLE_ID` | Mac | Apple ID for notarization |
| `APPLE_APP_SPECIFIC_PASSWORD` | Mac | App-specific password |
| `APPLE_TEAM_ID` | Mac | Apple Team ID |

`GITHUB_TOKEN` is injected by Actions. With `permissions.contents: write` on the workflow (already set), it is enough to publish the GitHub Release — no extra token secret required for publish.

Do not commit certificates, passwords, or `.env` files with secrets. This README does not assume any signing secrets are configured in the repo.

### `latest.json` shape

Served at `/desktop/latest.json` (file: `public/desktop/latest.json`). Fields match what the download funnel reads:

```json
{
  "version": "0.1.0",
  "releasedAt": "2026-07-28T00:00:00.000Z",
  "notes": "Release blurb for the download page",
  "windows": {
    "x64": {
      "url": "https://github.com/Joystiick/atelier-chess/releases/download/desktop-v0.1.0/AtelierChess-Setup-0.1.0-x64.exe",
      "sha256": null
    }
  },
  "mac": {
    "universal": {
      "url": "https://github.com/Joystiick/atelier-chess/releases/download/desktop-v0.1.0/AtelierChess-0.1.0-mac.dmg",
      "sha256": null
    }
  }
}
```

| Field | Type | Notes |
|-------|------|--------|
| `version` | string | Semver of the desktop client |
| `releasedAt` | string | ISO-8601 timestamp |
| `notes` | string | Short blurb for CTAs / download page |
| `windows.x64.url` | string | GitHub Release download URL (empty string = “coming soon”) |
| `windows.x64.sha256` | string \| null | Hex digest when the installer was present at generate time; else `null` |
| `mac.universal.url` | string | GitHub Release download URL |
| `mac.universal.sha256` | string \| null | Same as Windows |

Regenerate locally (from repo root) after you have installers under `desktop/release/`:

```bash
node desktop/scripts/write-latest-json.mjs \
  --version 0.1.0 \
  --tag desktop-v0.1.0 \
  --dir desktop/release \
  --out public/desktop/latest.json \
  --repo Joystiick/atelier-chess \
  --notes "Desktop client 0.1.0"
```

## Signing notes

**Unsigned beta is fine** for internal testing. Users will see **SmartScreen** (Windows) and **Gatekeeper** (macOS) warnings when the build is not signed / notarized.

### Windows

1. Obtain an Authenticode certificate (EV preferred for reputation).
2. Set `CSC_LINK` (path or base64 of `.pfx`) and `CSC_KEY_PASSWORD`.
3. Rebuild with `npm run dist:win`.

### macOS

1. Apple Developer account + Developer ID Application certificate in the keychain (or `CSC_LINK` / `CSC_KEY_PASSWORD` for a `.p12`).
2. For notarization: `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`.
3. `hardenedRuntime` + entitlements are already set in `electron-builder.yml`.
4. Rebuild with `npm run dist:mac` on an Apple Silicon or Intel Mac (universal needs both arch toolchains; electron-builder downloads both Electron builds).

Do not commit certificates, passwords, or `.env` files with secrets.

## Architecture reminder

- Session partition: `persist:atelier` (cookies survive restarts).
- External URLs outside the allowlist open in the OS browser.
- Single-instance lock: second launches focus the existing window and forward deep links.
