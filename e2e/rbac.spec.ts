// Role-based access tests. Same suite runs once per persona via separate
// projects (rbac-admin, rbac-limited) — each project supplies its own
// storageState. We persist counts to .rbac-results.json so the second
// project run can assert relationships across personas (admin >= limited).
//
//   npm run e2e:rbac
//
// Or just one persona to refresh its baseline:
//   npx playwright test --project=rbac-limited

import { test, expect, FrameLocator } from "@playwright/test";
import * as fs from "node:fs";
import * as path from "node:path";
import { loadApp, readListStats } from "./_helpers";

const TEST_ENV_URL = process.env.TEST_ENV_URL;
const RESULTS_FILE = "e2e/.rbac-results.json";

function persona(): "admin" | "limited" {
  // @ts-expect-error — project name available at runtime via TestInfo
  const name = test.info().project.name as string;
  if (name.endsWith("limited")) return "limited";
  return "admin";
}

type RbacResult = {
  botCount: number;
  transcriptShown: number;
  transcriptLoaded: number;
};

function readResults(): Partial<Record<"admin" | "limited", RbacResult>> {
  if (!fs.existsSync(RESULTS_FILE)) return {};
  try {
    return JSON.parse(fs.readFileSync(RESULTS_FILE, "utf8"));
  } catch {
    return {};
  }
}

function writeResult(p: "admin" | "limited", r: RbacResult) {
  const all = readResults();
  all[p] = r;
  fs.mkdirSync(path.dirname(RESULTS_FILE), { recursive: true });
  fs.writeFileSync(RESULTS_FILE, JSON.stringify(all, null, 2));
}

// Open the AgentMultiSelect dropdown and count the items inside. Each entry
// renders as `.agent-multiselect-item` (one per bot the user can see).
async function countBotsInMultiSelect(frame: FrameLocator): Promise<number> {
  const trigger = frame.locator(".agent-multiselect-trigger").first();
  await expect(trigger).toBeVisible({ timeout: 30_000 });
  await trigger.click();

  // Panel renders open with .agent-multiselect-list containing items.
  await expect(frame.locator(".agent-multiselect-panel")).toBeVisible({
    timeout: 5_000,
  });
  const items = frame.locator(".agent-multiselect-item");
  const count = await items.count();

  // Close the dropdown so it doesn't interfere with subsequent assertions.
  await trigger.click();
  return count;
}

test.describe.configure({ mode: "serial" });

test(`[${"persona"}] capture bot + transcript visibility for current user`, async ({
  page,
}) => {
  test.skip(!TEST_ENV_URL, "Set TEST_ENV_URL to run RBAC tests");
  test.setTimeout(6 * 60_000);
  const who = persona();

  const frame = await loadApp(page);

  // Switch to Browse via Flows + validate env (RBAC matters most for the
  // flow-backed list since it exercises real Dataverse security).
  await frame
    .getByRole("button", { name: "Browse via Flows", exact: true })
    .click();
  await frame.getByLabel("Environment URL").fill(TEST_ENV_URL!);
  await frame.getByRole("button", { name: /^Validate/ }).click();

  await expect(
    frame.locator(".transcript-table tbody tr").first()
  ).toBeVisible({ timeout: 90_000 });

  const stats = await readListStats(frame);
  const botCount = await countBotsInMultiSelect(frame);

  const result: RbacResult = {
    botCount,
    transcriptShown: stats.shown,
    transcriptLoaded: stats.loaded,
  };
  writeResult(who, result);
  console.log(`[rbac:${who}]`, result);

  if (who === "admin") {
    expect(result.transcriptLoaded, "admin should see at least 1 transcript")
      .toBeGreaterThan(0);
    expect(result.botCount, "admin should see at least 1 bot in filter")
      .toBeGreaterThan(0);
  }
  // Limited user might legitimately see 0 in some envs — don't hard-assert.
});

test(`[${"cross-persona"}] admin should see >= limited user (when both captured)`, async () => {
  const all = readResults();
  if (!all.admin || !all.limited) {
    test.skip(
      true,
      `Need both personas captured. Have: ${Object.keys(all).join(", ") || "none"}. Run both projects together.`
    );
    return;
  }

  expect(
    all.admin.transcriptLoaded,
    "admin transcript count should be >= limited's"
  ).toBeGreaterThanOrEqual(all.limited.transcriptLoaded);

  expect(
    all.admin.botCount,
    "admin bot filter count should be >= limited's"
  ).toBeGreaterThanOrEqual(all.limited.botCount);
});

// NEW (test #3): RBAC must MEANINGFULLY differ — if admin and limited see
// the exact same bots, RBAC isn't being enforced. Soft assertion: log a
// warning if equal (could be legit if env has only 1 bot total) but flag if
// limited > admin (always wrong).
test(`[${"cross-persona"}] limited user must NOT see more bots than admin`, async () => {
  const all = readResults();
  if (!all.admin || !all.limited) {
    test.skip(
      true,
      `Need both personas captured. Have: ${Object.keys(all).join(", ") || "none"}.`
    );
    return;
  }

  // Hard rule: limited user seeing MORE bots than admin = RBAC inverted = bug.
  expect(
    all.limited.botCount,
    `RBAC inverted! Limited user (${all.limited.botCount} bots) should never see more than admin (${all.admin.botCount} bots).`
  ).toBeLessThanOrEqual(all.admin.botCount);

  // Informational: if equal, RBAC may not be exercising at all.
  if (all.limited.botCount === all.admin.botCount) {
    console.log(
      `[rbac-warn] limited and admin see the same bot count (${all.limited.botCount}). RBAC may not be effective in this env, or env only has 1 bot total.`
    );
  } else {
    console.log(
      `[rbac-ok] RBAC enforced: admin=${all.admin.botCount} bots, limited=${all.limited.botCount} bots`
    );
  }
});
