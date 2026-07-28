/**
 * Copies public/icons/icon-512.png → desktop/build/icon.png for electron-builder.
 * Run from repo root: node desktop/scripts/sync-icon.mjs
 */
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const src = join(root, "public", "icons", "icon-512.png");
const destDir = join(root, "desktop", "build");
const dest = join(destDir, "icon.png");

if (!existsSync(src)) {
  console.error(`Missing source icon: ${src}`);
  process.exit(1);
}
mkdirSync(destDir, { recursive: true });
copyFileSync(src, dest);
console.log(`Synced ${src} → ${dest}`);
