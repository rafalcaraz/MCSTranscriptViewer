#!/usr/bin/env node
// Encodes local e2e auth state files + .env to base64 strings ready to
// paste into GitHub repo secrets. Reads only — does NOT commit anything,
// does NOT write encoded output to disk.
//
// Usage:
//   node scripts/encode-auth-for-ci.mjs
//
// Output is printed to stdout AND copied to your clipboard one secret at
// a time (you press Enter between each). Paste each into:
//   GitHub repo → Settings → Secrets and variables → Actions → New secret
//
// Re-run this script any time your saved auth expires:
//   1. npm run e2e:setup            (re-login admin)
//   2. npm run e2e:setup:limited    (re-login limited)
//   3. node scripts/encode-auth-for-ci.mjs
//   4. paste each updated secret over the existing GitHub secret

import { readFileSync, existsSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { createInterface } from "node:readline/promises";
import { stdin, stdout, platform } from "node:process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

// secretName → relative file path
const SECRETS = [
  { name: "PW_AUTH_ADMIN", file: "e2e/.auth/admin.json", trim: true },
  { name: "PW_AUTH_LIMITED", file: "e2e/.auth/limited.json", trim: true },
  { name: "PW_E2E_ENV", file: "e2e/.env", trim: false },
];

// GitHub Actions secrets are capped at 48 KB encoded.
const MAX_SECRET_BYTES = 48 * 1024;

// Origins we actually need at test time. apps.powerapps.com runs the player,
// login.microsoftonline.com holds the MSAL refresh cookies, *.dynamics.com /
// *.crm.dynamics.com handles the Dataverse calls. Everything else (most
// notably make.powerapps.com which can be MEGABYTES) is dead weight.
const KEEP_ORIGIN_PATTERNS = [
  /apps\.powerapps\.com$/i,
  /^https:\/\/apps\.powerapps\.com/i,
  /login\.microsoftonline\.com$/i,
  /^https:\/\/login\.microsoftonline\.com/i,
  /\.dynamics\.com$/i,
  /^https:\/\/.*\.dynamics\.com/i,
  /\.crm\.dynamics\.com$/i,
];

function shouldKeepOrigin(origin) {
  return KEEP_ORIGIN_PATTERNS.some((re) => re.test(origin));
}

// Trim a Playwright storageState JSON down to only the origins we need.
// Returns the trimmed JSON string (or original if not parseable).
function trimStorageState(jsonText) {
  let parsed;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    return { trimmed: jsonText, dropped: 0, kept: 0 };
  }
  if (!parsed || !Array.isArray(parsed.origins)) {
    return { trimmed: jsonText, dropped: 0, kept: 0 };
  }
  const before = parsed.origins.length;
  parsed.origins = parsed.origins.filter((o) =>
    shouldKeepOrigin(o.origin || "")
  );
  const kept = parsed.origins.length;
  const dropped = before - kept;
  return {
    trimmed: JSON.stringify(parsed),
    dropped,
    kept,
  };
}

function copyToClipboard(text) {
  // Best-effort: Windows uses `clip`, macOS uses `pbcopy`, Linux uses
  // xclip if installed. Falls back silently if none available.
  const tools =
    platform === "win32"
      ? [["clip", []]]
      : platform === "darwin"
        ? [["pbcopy", []]]
        : [
            ["xclip", ["-selection", "clipboard"]],
            ["xsel", ["--clipboard", "--input"]],
          ];
  for (const [cmd, args] of tools) {
    const result = spawnSync(cmd, args, { input: text, encoding: "utf8" });
    if (result.status === 0) return true;
  }
  return false;
}

function encodeFile(filePath, { trim }) {
  let content = readFileSync(filePath, "utf8");
  let trimSummary = null;
  if (trim) {
    const result = trimStorageState(content);
    if (result.dropped > 0) {
      content = result.trimmed;
      trimSummary = `trimmed ${result.dropped} origin(s), kept ${result.kept}`;
    } else if (result.kept > 0) {
      trimSummary = `${result.kept} origin(s), nothing to trim`;
    }
  }
  return {
    base64: Buffer.from(content, "utf8").toString("base64"),
    trimSummary,
    rawBytes: Buffer.byteLength(content, "utf8"),
  };
}

function fmtSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

async function main() {
  console.log("");
  console.log("─".repeat(70));
  console.log("  Encode e2e auth files for GitHub Actions secrets");
  console.log("─".repeat(70));
  console.log("");
  console.log("This will print one secret at a time. For each:");
  console.log("  1. Copy the value (auto-copied to clipboard if possible)");
  console.log("  2. Go to: GitHub repo → Settings → Secrets and variables → Actions");
  console.log("  3. New secret (or update existing) with the printed name");
  console.log("  4. Press Enter here to advance to the next secret");
  console.log("");
  console.log("⚠️  Output contains session cookies. Don't paste into chat,");
  console.log("    Slack, screenshots, or any logs. Only into GitHub secrets UI.");
  console.log("");

  const rl = createInterface({ input: stdin, output: stdout });

  let processed = 0;
  let skipped = 0;

  for (const { name, file, trim } of SECRETS) {
    const abs = path.join(ROOT, file);

    if (!existsSync(abs)) {
      console.log(`⏭️  ${name} — skipped (no ${file})`);
      if (file.includes(".auth")) {
        console.log(
          `    Run \`npm run e2e:setup${file.includes("limited") ? ":limited" : ""}\` first if you want this persona in CI.`
        );
      }
      console.log("");
      skipped++;
      continue;
    }

    const origSize = statSync(abs).size;
    const { base64, trimSummary, rawBytes } = encodeFile(abs, { trim });
    const copied = copyToClipboard(base64);
    const oversize = base64.length > MAX_SECRET_BYTES;

    console.log("─".repeat(70));
    console.log(`  Secret #${processed + 1}: ${name}`);
    console.log(
      `  Source: ${file} (${fmtSize(origSize)}${trimSummary ? " → " + fmtSize(rawBytes) + " after trim" : ""} → ${fmtSize(base64.length)} base64)`
    );
    if (trimSummary) console.log(`  Trim: ${trimSummary}`);
    if (oversize) {
      console.log(
        `  ❌ TOO BIG — GitHub Actions secrets max out at ${fmtSize(MAX_SECRET_BYTES)}.`
      );
      console.log(
        "     Try logging in fresh (npm run e2e:setup) without visiting`make.powerapps.com first, or skip this persona in CI."
      );
    } else {
      console.log(
        `  Size check: ✅ under ${fmtSize(MAX_SECRET_BYTES)} GitHub limit`
      );
    }
    console.log(
      `  Clipboard: ${copied ? "✅ copied" : "❌ not copied (paste below manually)"}`
    );
    console.log("─".repeat(70));
    if (!copied && !oversize) {
      console.log("");
      console.log(base64);
      console.log("");
    }
    processed++;

    if (processed + skipped < SECRETS.length) {
      await rl.question("Press Enter when pasted into GitHub to continue → ");
    }
  }

  rl.close();

  console.log("");
  console.log("─".repeat(70));
  console.log(
    `Done. ${processed} secret(s) printed, ${skipped} skipped.`
  );
  console.log(
    "Verify in GitHub: Settings → Secrets and variables → Actions"
  );
  console.log("─".repeat(70));
  console.log("");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
