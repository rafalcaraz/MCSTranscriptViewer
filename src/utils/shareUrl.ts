import powerConfig from "../../power.config.json";

/**
 * Build a shareable URL that opens this app at the given transcript.
 *
 * The app only works inside the Power Apps wrapper (apps.powerapps.com/play/...)
 * because that's where the SDK gets initialized. So the share link must point
 * to the published play URL, NOT to the current page (which in dev is localhost
 * and would render a stuck-on-"Loading transcript..." page).
 */
export function buildShareUrl(transcriptId: string): string {
  const envId = powerConfig.environmentId;
  const appId = powerConfig.appId;
  return `https://apps.powerapps.com/play/e/${envId}/a/${appId}#t=${transcriptId}`;
}
