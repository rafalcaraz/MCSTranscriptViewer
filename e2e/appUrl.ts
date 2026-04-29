// Single source of truth for the deployed app URL. Imported by both the
// Playwright config (for `baseURL`) and the spec files (so they can `goto`
// the absolute URL — `goto("/")` would replace the path and bounce to
// make.powerapps.com).
export const APP_URL =
  "https://apps.powerapps.com/play/e/92ac575f-d43d-e38d-80a0-d70cec823715/app/d45139e0-5b92-47ac-b19b-67ee86a4f10c?tenantId=1557f771-4c8e-4dbd-8b80-dd00a88e833e&source=portal&hidenavbar=true";
