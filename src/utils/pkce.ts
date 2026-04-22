// PKCE (RFC 7636) helpers for OAuth 2.0 Authorization Code flow.
// Used by the manual sign-in flow that bypasses MSAL.js because Chrome's
// storage partitioning breaks MSAL's popup<->parent coordination when the
// app runs inside a Power Apps player iframe.

function base64UrlEncode(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let bin = "";
  for (let i = 0; i < arr.length; i++) bin += String.fromCharCode(arr[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function generateRandomString(length = 64): string {
  const arr = new Uint8Array(length);
  crypto.getRandomValues(arr);
  return base64UrlEncode(arr).slice(0, length);
}

export function generateCodeVerifier(): string {
  // RFC 7636: 43-128 chars, [A-Z a-z 0-9 - . _ ~]
  return generateRandomString(64);
}

export async function generateCodeChallenge(verifier: string): Promise<string> {
  const data = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return base64UrlEncode(digest);
}
