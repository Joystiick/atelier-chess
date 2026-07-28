#!/usr/bin/env node
/**
 * Writes public/desktop/latest.json for the Netlify download page / CTAs.
 *
 * Schema (locked with the web download funnel):
 * {
 *   "version": "0.1.0",
 *   "releasedAt": "ISO-8601",
 *   "notes": "...",
 *   "windows": { "x64": { "url": "...", "sha256": null|string } },
 *   "mac": { "universal": { "url": "...", "sha256": null|string } }
 * }
 *
 * Usage:
 *   node desktop/scripts/write-latest-json.mjs \
 *     --version 0.1.0 \
 *     --tag desktop-v0.1.0 \
 *     --dir desktop/release \
 *     --out public/desktop/latest.json \
 *     --repo Joystiick/atelier-chess \
 *     --notes "Desktop client 0.1.0"
 *
 * Artifact names must match desktop/electron-builder.yml:
 *   AtelierChess-Setup-${version}-x64.exe
 *   AtelierChess-${version}-mac.dmg
 */

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../..");

function parseArgs(argv) {
  const out = {
    version: null,
    tag: null,
    dir: join(repoRoot, "desktop", "release"),
    out: join(repoRoot, "public", "desktop", "latest.json"),
    repo: "Joystiick/atelier-chess",
    notes: "",
    releasedAt: new Date().toISOString(),
    requireFiles: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = argv[i + 1];
    const take = () => {
      i += 1;
      return next;
    };
    switch (a) {
      case "--version":
        out.version = take();
        break;
      case "--tag":
        out.tag = take();
        break;
      case "--dir":
        out.dir = resolve(take());
        break;
      case "--out":
        out.out = resolve(take());
        break;
      case "--repo":
        out.repo = take();
        break;
      case "--notes":
        out.notes = take() ?? "";
        break;
      case "--released-at":
        out.releasedAt = take();
        break;
      case "--require-files":
        out.requireFiles = true;
        break;
      case "--help":
      case "-h":
        printHelpAndExit(0);
        break;
      default:
        if (a.startsWith("-")) {
          console.error(`Unknown flag: ${a}`);
          printHelpAndExit(1);
        }
    }
  }
  return out;
}

function printHelpAndExit(code) {
  console.log(`Usage: node desktop/scripts/write-latest-json.mjs [options]

Options:
  --version <semver>     App version (default: desktop/package.json)
  --tag <desktop-v*>     Release tag (default: desktop-v<version>)
  --dir <path>           Folder with built installers (default: desktop/release)
  --out <path>           Output JSON path (default: public/desktop/latest.json)
  --repo <owner/name>    GitHub repo for download URLs
  --notes <text>         Release notes blurb
  --released-at <iso>    Override releasedAt timestamp
  --require-files        Exit 1 if Win NSIS / Mac DMG are missing (CI)
`);
  process.exit(code);
}

function readPackageVersion() {
  const pkgPath = join(repoRoot, "desktop", "package.json");
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
  return pkg.version;
}

function sha256File(filePath) {
  if (!existsSync(filePath)) return null;
  const hash = createHash("sha256");
  hash.update(readFileSync(filePath));
  return hash.digest("hex");
}

function assetUrl(repo, tag, fileName) {
  return `https://github.com/${repo}/releases/download/${tag}/${fileName}`;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const version = args.version || readPackageVersion();
  const tag = args.tag || `desktop-v${version}`;

  const winName = `AtelierChess-Setup-${version}-x64.exe`;
  const macName = `AtelierChess-${version}-mac.dmg`;

  const winPath = join(args.dir, winName);
  const macPath = join(args.dir, macName);

  const payload = {
    version,
    releasedAt: args.releasedAt,
    notes: args.notes || `Atelier Chess desktop ${version}`,
    windows: {
      x64: {
        url: assetUrl(args.repo, tag, winName),
        sha256: sha256File(winPath),
      },
    },
    mac: {
      universal: {
        url: assetUrl(args.repo, tag, macName),
        sha256: sha256File(macPath),
      },
    },
  };

  const missing = [];
  if (!existsSync(winPath)) missing.push(winName);
  if (!existsSync(macPath)) missing.push(macName);
  if (missing.length) {
    const msg = `write-latest-json: missing files in ${args.dir}: ${missing.join(", ")}`;
    if (args.requireFiles) {
      console.error(msg);
      process.exit(1);
    }
    console.warn(`${msg} — checksum skipped; URLs still written.`);
  }

  mkdirSync(dirname(args.out), { recursive: true });
  writeFileSync(args.out, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

  console.log(`Wrote ${args.out}`);
  console.log(JSON.stringify(payload, null, 2));
}

main();
