# Desktop release pipeline (CI + signing)

GitHub Actions workflow: [`.github/workflows/desktop.yml`](../.github/workflows/desktop.yml).

This path builds **Windows x64** (NSIS) and **macOS universal** installers from `desktop/`. It does **not** change the Netlify Next.js build (`netlify.toml` / root `npm run build`).

## Triggers

| Event | What happens |
|-------|----------------|
| `workflow_dispatch` | Build + upload artifacts only (no GitHub Release) |
| Push tag `desktop-v*` | Matrix build → electron-builder `--publish always` → `update-latest` commits `public/desktop/latest.json` to the default branch |

No Win x86. Artifact names come from `desktop/electron-builder.yml`.

## First release (unsigned beta)

1. Ensure `desktop/` builds locally (`cd desktop && npm ci && npm run build`).
2. Commit and push `desktop/`, `.github/workflows/desktop.yml`, and this docs file to `main` (or your release branch).
3. Optional dry run: **Actions → Desktop Installers → Run workflow**.
4. Tag and push (version must match what you want in installers / `latest.json`):

```bash
# from repo root — tag must match desktop/package.json version for consistency
git tag desktop-v0.1.0
git push origin desktop-v0.1.0
```

5. Wait for the workflow (Windows + macOS matrix publish, then `update-latest`).
6. Confirm the release at `https://github.com/Joystiick/atelier-chess/releases`.
7. Confirm the bot commit updated `public/desktop/latest.json` on the default branch (Netlify picks it up on deploy).

If the commit step is skipped or fails, regenerate locally (below) and push.

### Regenerate `latest.json` locally

```bash
node desktop/scripts/write-latest-json.mjs \
  --version 0.1.0 \
  --tag desktop-v0.1.0 \
  --dir desktop/release \
  --out public/desktop/latest.json \
  --repo Joystiick/atelier-chess \
  --notes "Desktop client 0.1.0"
```

Schema:

```json
{
  "version": "0.1.0",
  "releasedAt": "ISO-8601",
  "notes": "...",
  "windows": { "x64": { "url": "...", "sha256": null } },
  "mac": { "universal": { "url": "...", "sha256": null } }
}
```

`sha256` is filled when the matching installer exists under `--dir`; otherwise `null` (URLs still written).

## GitHub Actions secrets (optional — unsigned OK first)

Add under **Settings → Secrets and variables → Actions**. Leave unset for unsigned betas (SmartScreen / Gatekeeper warnings expected).

| Secret | Platform | Purpose |
|--------|----------|---------|
| `CSC_LINK` | Win / Mac | Base64 or path to code-signing cert (`.pfx` / `.p12`). In CI use base64 of the file. |
| `CSC_KEY_PASSWORD` | Win / Mac | Certificate password |
| `APPLE_ID` | Mac | Apple ID for notarization |
| `APPLE_APP_SPECIFIC_PASSWORD` | Mac | App-specific password |
| `APPLE_TEAM_ID` | Mac | Team ID |

`GITHUB_TOKEN` / `github.token` is provided by Actions (`permissions.contents: write`) — enough for Releases + the `latest.json` bot commit. Optionally set a `GH_TOKEN` PAT secret if branch protection blocks the default token. Do **not** commit tokens or certs.

Local signing notes also live in [`desktop/README.md`](../desktop/README.md).

## Netlify safety

- Root `package.json` / `netlify.toml` are unchanged by this pipeline.
- `desktop/` is ignored by the Netlify build (separate `package-lock.json`, not part of root `npm run build`).
- Only `public/desktop/latest.json` (when committed) affects the CDN download page.

## Rollback

- Delete or unpublish the GitHub Release / tag if a bad build shipped.
- Revert `public/desktop/latest.json` on `main` to point at the previous good URLs (or empty URLs → “Coming soon” on the site).
- Re-tag a fixed version (`desktop-v0.1.1`) after bumping `desktop/package.json`.
