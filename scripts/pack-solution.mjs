#!/usr/bin/env node
// Build the React Code App and pack it into an unmanaged solution zip.
//
// Steps:
//   1. npm run build              -> produces my-app/dist/
//   2. clear + copy dist/*        -> solution/src/CanvasApps/<APP>_CodeAppPackages/
//   3. regenerate <CodeAppPackageUris> in <APP>.meta.xml to match the bundle's
//      content-hashed filenames
//   4. pac solution pack          -> solution/out/<SOLUTION>.zip (Unmanaged)
//
// Output zip is self-contained: a contributor can clone, run this, import the
// zip, wire the connection reference + turn on the flows, and have a working
// app — no `npm install` or `power-apps push` required on their end.

import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, rmSync, mkdirSync, cpSync } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

const APP_NAME = "msftcsa_mcsconversationviewer_6ae15";
const SOLUTION_NAME = "ConvTranscriptViewerCodeApps";

// CLI: --managed (default: unmanaged)
const args = process.argv.slice(2);
const packageType = args.includes("--managed") ? "Managed" : "Unmanaged";

// Timestamp suffix: _MMDDYY_HHMM (local time)
const now = new Date();
const pad = (n) => String(n).padStart(2, "0");
const stamp = `${pad(now.getMonth() + 1)}${pad(now.getDate())}${String(now.getFullYear()).slice(-2)}_${pad(now.getHours())}${pad(now.getMinutes())}`;
const zipName = `${SOLUTION_NAME}_${packageType.toLowerCase()}_${stamp}.zip`;

const distDir = path.join(repoRoot, "dist");
const solutionSrc = path.join(repoRoot, "solution", "src");
const solutionOut = path.join(repoRoot, "solution", "out");
const bundleDir = path.join(solutionSrc, "CanvasApps", `${APP_NAME}_CodeAppPackages`);
const metaXmlPath = path.join(solutionSrc, "CanvasApps", `${APP_NAME}.meta.xml`);
const zipPath = path.join(solutionOut, zipName);

const MIME_BY_EXT = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".json": "application/json",
  ".map": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ico": "image/x-icon",
  ".txt": "text/plain",
};

function log(msg) {
  console.log(`\n▶ ${msg}`);
}

function run(cmd, opts = {}) {
  console.log(`  $ ${cmd}`);
  execSync(cmd, { stdio: "inherit", cwd: repoRoot, shell: true, ...opts });
}

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(full)));
    else out.push(full);
  }
  return out;
}

function mimeFor(file) {
  const ext = path.extname(file).toLowerCase();
  const mime = MIME_BY_EXT[ext];
  if (!mime) {
    throw new Error(
      `Unknown MIME type for extension "${ext}" (${file}). Add it to MIME_BY_EXT in scripts/pack-solution.mjs.`,
    );
  }
  return mime;
}

async function regenerateMetaXml() {
  const files = await walk(bundleDir);
  // Stable order: index.html first, then alphabetised — matches Power Apps
  // export ordering closely enough for clean diffs.
  const rels = files
    .map((f) => path.relative(bundleDir, f).split(path.sep).join("/"))
    .sort((a, b) => {
      if (a === "index.html") return -1;
      if (b === "index.html") return 1;
      return a.localeCompare(b);
    });

  const uriLines = rels
    .map(
      (rel) =>
        `    <CodeAppPackageUri>/CanvasApps/${APP_NAME}_CodeAppPackages/${rel}_ContentType_${mimeFor(rel)}</CodeAppPackageUri>`,
    )
    .join("\n");

  const newBlock = `<CodeAppPackageUris>\n${uriLines}\n  </CodeAppPackageUris>`;

  const xml = readFileSync(metaXmlPath, "utf8");
  const updated = xml.replace(
    /<CodeAppPackageUris>[\s\S]*?<\/CodeAppPackageUris>/,
    newBlock,
  );

  if (updated === xml) {
    throw new Error(
      `Failed to locate <CodeAppPackageUris>...</CodeAppPackageUris> block in ${metaXmlPath}`,
    );
  }

  writeFileSync(metaXmlPath, updated, "utf8");
  console.log(`  ✓ rewrote ${rels.length} <CodeAppPackageUri> entries`);
}

async function main() {
  log("Building Code App (npm run build)");
  run("npm run build");

  await stat(distDir).catch(() => {
    throw new Error(`dist/ not found at ${distDir} after build`);
  });

  log(`Refreshing bundle in ${path.relative(repoRoot, bundleDir)}`);
  rmSync(bundleDir, { recursive: true, force: true });
  mkdirSync(bundleDir, { recursive: true });
  cpSync(distDir, bundleDir, { recursive: true });

  log("Regenerating <CodeAppPackageUris> in meta.xml");
  await regenerateMetaXml();

  log(`Packing ${packageType.toLowerCase()} solution`);
  mkdirSync(solutionOut, { recursive: true });
  rmSync(zipPath, { force: true });

  // pac solution pack reads <Managed> from Solution.xml and refuses to produce
  // a zip whose type doesn't match. Flip it for the duration of the pack, then
  // restore — keeps the source-of-truth Solution.xml as Unmanaged in git.
  const solutionXmlPath = path.join(solutionSrc, "Other", "Solution.xml");
  const originalSolutionXml = readFileSync(solutionXmlPath, "utf8");
  const wantManagedFlag = packageType === "Managed" ? "1" : "0";
  const flipped = originalSolutionXml.replace(
    /<Managed>[01]<\/Managed>/,
    `<Managed>${wantManagedFlag}</Managed>`,
  );
  if (flipped === originalSolutionXml && !originalSolutionXml.includes(`<Managed>${wantManagedFlag}</Managed>`)) {
    throw new Error(`Could not locate <Managed>...</Managed> in ${solutionXmlPath}`);
  }
  writeFileSync(solutionXmlPath, flipped, "utf8");

  const relZip = path.relative(repoRoot, zipPath).split(path.sep).join("/");
  try {
    run(
      `pac solution pack --folder solution/src --zipFile "${relZip}" --packageType ${packageType}`,
    );
  } finally {
    writeFileSync(solutionXmlPath, originalSolutionXml, "utf8");
  }

  // pac sometimes exits 0 even when it refuses to produce the zip — verify.
  await stat(zipPath).catch(() => {
    throw new Error(`pac solution pack reported success but ${path.relative(repoRoot, zipPath)} was not created. Scroll up for the pac error.`);
  });

  log("Done");
  console.log(`  📦 ${relZip}`);
  console.log(`\nNext: import the zip into a Dataverse env, wire the connection reference, turn on the flows.`);
}

main().catch((err) => {
  console.error(`\n✗ pack-solution failed: ${err.message}`);
  process.exit(1);
});
