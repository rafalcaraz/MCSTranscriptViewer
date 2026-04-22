// Dedicated MSAL popup redirect page. The MSAL App Registration's redirect URI must
// point to <origin>/auth-redirect.html (NOT the main app URL).
//
// IMPORTANT: For popup flow, this page should DO NOTHING. The parent window's
// loginPopup() polls popup.location.href waiting to see the redirect URI. Once it
// does, it reads the hash, parses the auth response, and closes the popup itself.
//
// We must NOT call handleRedirectPromise() here — that consumes and clears the URL
// hash before the parent has a chance to read it, leaving loginPopup hanging.
//
// We just need this page to exist and be reachable so AAD has somewhere to redirect.
console.log("[auth-redirect] popup landed at", window.location.href);
console.log("[auth-redirect] waiting for parent to read response and close us...");
