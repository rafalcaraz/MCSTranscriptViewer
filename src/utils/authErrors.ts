/**
 * Translate raw AAD/OAuth error payloads into a sentence the user can act on.
 * Used by both the popup (`src/auth-redirect.ts`) and the parent page's
 * silent token refresh path (`MultiEnvPanel.tsx`). See
 * `docs/MULTI-ENV-SETUP.md` for the troubleshooting table this mirrors.
 */
export function friendlyAuthError(code: string | null | undefined, description: string | null | undefined): string {
  const c = (code || "").trim();
  const d = (description || "").trim();
  const codeInDesc = /AADSTS(\d{4,6})/.exec(d)?.[1];
  const aadsts = codeInDesc ?? (c.startsWith("AADSTS") ? c.replace("AADSTS", "") : "");

  switch (aadsts) {
    case "65001":
      return "Admin consent is required for this app registration. Ask your tenant admin to grant the 'Dynamics CRM > user_impersonation' permission, or visit the admin-consent URL for your tenant. (AADSTS65001)";
    case "65004":
      return "You declined to grant the permissions this app needs. Sign in again and accept the permission prompt. (AADSTS65004)";
    case "70011":
      return "The requested permission scope is invalid. Make sure the app registration has 'Dynamics CRM > user_impersonation' (delegated). (AADSTS70011)";
    case "50011":
    case "500113":
      return `The redirect URI in the request doesn't match the one registered on the app. Copy the URI shown in Configuration → Redirect URI into Azure Portal → App registrations → Authentication. (AADSTS${aadsts})`;
    case "9002326":
      return "The redirect URI must be registered as a 'Single-page application' (not Web) on the app registration. Delete the Web entry under Authentication and re-add it under Single-page application. (AADSTS9002326)";
    case "700016":
      return "The application wasn't found in the directory. Double-check the Client ID, and (for cross-tenant scenarios) make sure the app reg is multi-tenant or the tenant admin has provisioned it. (AADSTS700016)";
    case "50194":
    case "500011":
    case "500021":
      return `The signed-in user account isn't allowed in this tenant. Try signing in with a different account, or check the app reg's Supported account types. (AADSTS${aadsts})`;
    case "50105":
      return "The signed-in user isn't assigned to a role for this app, but the app requires assignment. Ask the tenant admin to assign you (or to disable 'Assignment required' on the enterprise app). (AADSTS50105)";
    case "50020":
      return "The user is from an external tenant and your app registration is single-tenant. Set Supported account types to multi-tenant if you want guest/cross-tenant access. (AADSTS50020)";
    case "7000218":
      return "The token endpoint refused the request because no client secret was supplied — but PKCE doesn't use one. The redirect URI is probably registered as Web instead of Single-page application. (AADSTS7000218)";
    case "16000":
    case "16002":
      return `Sign-in cancelled before completing. Open the popup and finish signing in. (AADSTS${aadsts})`;
  }

  if (c === "access_denied") {
    return "Sign-in cancelled or consent was declined. Try again and accept the permission prompt.";
  }
  if (c === "consent_required" || c === "interaction_required" || c === "login_required") {
    return "Interactive consent or sign-in is required. Sign out and sign back in, then complete the prompt.";
  }
  if (c === "invalid_grant") {
    return `The authorization code or refresh token couldn't be redeemed. This usually means the popup took too long, the redirect URI is mis-registered, or your tenant requires admin consent. ${d}`.trim();
  }
  if (c === "invalid_client") {
    return "AAD couldn't authenticate the client. Double-check the Client ID and that the redirect URI is registered as a Single-page application.";
  }

  if (c && d) return `${c}: ${d}`;
  return d || c || "Unknown sign-in error.";
}
