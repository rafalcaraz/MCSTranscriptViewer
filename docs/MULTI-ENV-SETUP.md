# Multi-Env Tab — Setup Guide

The **Multi-Env** tab lets you sign in with your own credentials and browse Dataverse environments across tenants — discover environments, pick one, and explore its agents and transcripts. This is **opt-in** and requires a one-time Azure AD app registration. The default **Transcripts** tab continues to work without any of this configuration.

> **TL;DR**
> 1. Register a single-page Azure AD app (5 min).
> 2. Add the `Dynamics CRM > user_impersonation` delegated permission.
> 3. Paste the Client ID into the Multi-Env tab → Sign in.

---

## Why does Multi-Env need an app registration?

The default Transcripts tab uses the Power Apps SDK, which authenticates the user invisibly inside the env where the Code App is installed. It can only see that one environment.

Multi-Env runs **outside** that SDK context: it talks directly to Microsoft Graph-style endpoints (Power Platform discovery + Dataverse Web API) using OAuth 2.0 + PKCE in the browser. To do that, AAD requires an app registration that:

- Identifies the client (your tenant + client ID)
- Has a registered SPA redirect URI (browser-based PKCE flow)
- Declares the API permissions it needs

The app reg is yours — you control which users it works for and which permissions it requests.

---

## Step 1 — Create the App Registration

1. Open [Azure Portal → App registrations](https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade).
2. Click **New registration**.
3. Fill in:
   - **Name:** `MCS Transcript Viewer — Multi-Env` (or whatever you prefer).
   - **Supported account types:**
     - Choose **"Accounts in any organizational directory (Multitenant)"** if you want to browse Dataverse envs across multiple customer tenants (recommended for partners/MVPs).
     - Choose **"Single tenant"** if you only need your own org.
   - **Redirect URI:** **Skip this on the first screen** — we'll add it next as a SPA platform (the dropdown defaults to "Web" which won't work for PKCE).
4. Click **Register**.
5. From the Overview page, copy:
   - **Application (client) ID** — you'll paste this into the app.
   - **Directory (tenant) ID** — only needed if you chose Single tenant.

---

## Step 2 — Add the SPA redirect URI

Browser-based PKCE requires the redirect URI to be registered under the **Single-page application** platform (not Web).

1. Open your app registration → **Authentication** in the left nav.
2. Click **Add a platform** → **Single-page application**.
3. Add the redirect URI shown in the Multi-Env tab:
   - When deployed in Power Apps, this will be something like:
     `https://<env-prefix>.crm.dynamics.com/cdsapp/.../codeapps/<app-id>/auth-redirect.html`
   - When developing locally:
     `http://localhost:5173/auth-redirect.html`
   - The exact URI is shown in the Multi-Env tab → Configuration → "Redirect URI". **Copy it from there to be safe.**
4. Save.

> **Common mistake:** if you accidentally added the URI under "Web" instead of "Single-page application", AAD will reject the token request with `AADSTS9002326` (cross-origin token redemption permitted only for SPA). Delete the Web entry and re-add as SPA.

---

## Step 3 — Grant Dataverse permissions

1. In your app registration → **API permissions** in the left nav.
2. Click **Add a permission** → **Dynamics CRM**.
3. Select **Delegated permissions** → check **`user_impersonation`**.
4. Click **Add permissions**.
5. (Strongly recommended) Click **Grant admin consent for &lt;your tenant&gt;**.
   - Without admin consent, every user will be prompted to consent on first sign-in. They can self-consent if your tenant allows it; otherwise they'll see `AADSTS65001` ("admin consent required").
   - For multi-tenant apps targeting customer tenants, **each customer tenant admin must grant consent** (either via this UI in their tenant, or via the standard `/adminconsent` URL).

> No other permissions are required. Discovery uses the same `Dynamics CRM > user_impersonation` token — there's no separate `globaldisco.crm.dynamics.com` permission to add.

---

## Step 4 — Configure the app

1. Open the app, switch to the **Multi-Env** tab.
2. Expand the **Configuration** section.
3. Paste your **Application (client) ID** into the field.
4. Tenant ID:
   - Leave as `organizations` if your app reg is multi-tenant and you want users to sign in with any work/school account.
   - Use `common` to allow personal Microsoft accounts as well (rarely needed for Dataverse).
   - Use the specific tenant GUID if your app reg is single-tenant.
5. Click **Sign in with Microsoft**.

A popup will open, you sign in, and the popup closes itself once the token reaches the parent. The Configuration section auto-collapses on success.

---

## Step 5 — Bot access scoping (no setup needed)

Because the `conversationtranscript` table is owned by a Microsoft service principal, granting "Transcript Viewer" gives a user **all** transcripts in an environment — including ones for bots they have no read access to via `/bots`. Multi-Env mirrors the existing Transcripts tab and **scopes transcripts client-side** to the user's accessible bots:

- `/bots` is fetched first — Dataverse RLS returns only bots the user can read.
- For each transcript, the small `metadata` field is parsed and the bot schema name is intersected with the accessible-bot set.
- Hidden count is shown at the bottom of the list ("X hidden (not your accessible agents)").

This means a user with viewer access to one bot will only see that bot's transcripts in Multi-Env, even though the server returns more.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Popup opens, sign-in completes, but main app stays on "Signing in…" | Browser blocked third-party storage (Brave, Safari, hardened Chrome) AND COOP severed `window.opener` | Try in standard Chrome/Edge. If running inside `apps.powerapps.com` iframe, request Storage Access permission from your browser site settings. |
| `AADSTS9002326: Cross-origin token redemption is permitted only for the 'Single-Page Application' client-type` | Redirect URI registered as Web instead of SPA | Delete the "Web" platform entry, re-add the URI under "Single-page application". |
| `AADSTS65001: The user or administrator has not consented to use the application` | Admin consent not granted, and user-consent disabled in this tenant | Tenant admin must grant consent (Step 3). |
| `AADSTS50011: The redirect URI 'X' specified in the request does not match` | Redirect URI mismatch between app reg and what the app sends | Copy the exact URI shown in Multi-Env → Configuration → Redirect URI into the app reg. |
| `AADSTS70011: The provided value for the input parameter 'scope' is not valid` | Wrong scope format for the env's API URL | Sign out and sign back in. The app builds the scope from the env's `ApiUrl` automatically. |
| Discovery returns 401 / 403 | Tenant admin hasn't consented (multi-tenant scenario) | Customer admin must consent in their tenant. Easiest: send them `https://login.microsoftonline.com/<their-tenant>/adminconsent?client_id=<your-client-id>`. |
| Env list is empty | User has no Dataverse env access in any tenant they signed in to | Check Power Platform Admin Center for env access. |
| `Couldn't load transcripts: 401` after env selection | Token for that env hasn't been granted (cross-tenant scenario, no consent in target tenant) | Customer admin in the target tenant must grant consent. |
| `Couldn't load transcripts: 403` | Authenticated user has no security role in that env that grants `conversationtranscript` read | Assign appropriate role in Power Platform Admin Center. |

---

## Security notes

- The app uses **PKCE** (no client secret). All token exchanges happen in the browser.
- The **refresh token** is held in memory only (`useRef` in React) — not in `localStorage`. It's discarded on page reload.
- **Sign out** clears the in-memory access + refresh tokens and the per-env token cache. The Client ID and Tenant ID stay in `localStorage` for convenience (they aren't secrets — they're public identifiers).
- The auth popup is a static HTML page bundled with the app (`auth-redirect.html`) — it is not loaded from a third-party origin.
- All OData inputs (search terms, GUIDs) are sanitized via allowlists before being sent to Dataverse.

---

## Comparison: Transcripts tab vs Multi-Env tab

| | Transcripts (default) | Multi-Env (opt-in) |
|---|---|---|
| **Auth** | Power Apps SDK (invisible to user) | OAuth 2.0 + PKCE via your app reg |
| **Setup** | Install the solution | App reg + this guide |
| **Scope** | The single env where the Code App is installed | Any Dataverse env the signed-in user can access |
| **Cross-tenant** | No | Yes (with multi-tenant app reg + per-tenant admin consent) |
| **Bot access scoping** | Client-side filter by `metadata.BotName` against accessible bots | Same — explicit, with "hidden" count surfaced in UI |
| **Best for** | Most customers, single-env workflows | Partners, MVPs, internal MS, multi-env operators |

Both tabs reuse the same parser and detail view — only the data plumbing differs.
