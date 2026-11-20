// main.ts — entry point for the GTA 6 trophy guide & tracker.
//
// Copies app/ and screenshots/ (when present) from beside this file into
// MAKEFUN_OUTPUT_DIR (default '/output'), then writes /output/dossier.json
// via the vendored make.fun frontend dossier library.
//
//   MAKEFUN_OUTPUT_DIR=out node main.ts
//
// Node 22+ standard library only; erasable TypeScript, no build step.

import { cpSync, existsSync, mkdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildDossier } from './vendor/makefun-frontend.ts';

const CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 50331648,
};

const root = dirname(fileURLToPath(import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

function copyTree(name: string, required: boolean): boolean {
  const src = join(root, name);
  if (!existsSync(src)) {
    if (required) {
      throw new Error(`main.ts: ${name}/ is missing next to main.ts — nothing to hand in`);
    }
    console.warn(`main.ts: warning: ${name}/ not found next to main.ts, skipping it`);
    return false;
  }
  cpSync(src, join(outDir, name), { recursive: true });
  console.log(`main.ts: copied ${name}/ -> ${join(outDir, name)}`);
  return true;
}

mkdirSync(outDir, { recursive: true });

copyTree('app', true);
const hasScreenshots = copyTree('screenshots', false);
if (!hasScreenshots) {
  console.warn('main.ts: warning: no screenshots/ yet — the dossier step will refuse until screenshots are added');
}

const dossierPath = join(outDir, 'dossier.json');
// Never leave a stale dossier behind: if the build below throws, a previous
// run's dossier.json must not survive to look like a fresh one.
if (existsSync(dossierPath)) unlinkSync(dossierPath);

const dossier = buildDossier(outDir, CAPS);
writeFileSync(dossierPath, dossier);
console.log(`main.ts: wrote ${dossierPath} (${dossier.byteLength} bytes)`);
