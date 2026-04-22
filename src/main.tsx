import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'

// MSAL popup detection: if this window was opened by another (window.opener exists) AND
// the URL contains an OAuth response (code/state in hash or query), we are the MSAL popup.
// In that case, do NOT render the app — instead initialize MSAL and let it process the
// redirect response so it can postMessage back to the opener.
function isMsalPopup(): boolean {
  if (typeof window === 'undefined') return false;
  if (!window.opener || window.opener === window) return false;
  const hash = window.location.hash || '';
  const search = window.location.search || '';
  return /[#&?](code|error|state|id_token|access_token)=/i.test(hash + search);
}

async function handlePopupResponse() {
  const clientId = localStorage.getItem('multiEnv.clientId') ?? '';
  const tenantId = localStorage.getItem('multiEnv.tenantId') || 'organizations';
  if (!clientId) {
    // Nothing we can do without a client ID. Close ourselves.
    try { window.close(); } catch { /* ignore */ }
    return;
  }
  try {
    const { PublicClientApplication } = await import('@azure/msal-browser');
    const pca = new PublicClientApplication({
      auth: {
        clientId,
        authority: `https://login.microsoftonline.com/${tenantId}`,
        redirectUri: window.location.origin + window.location.pathname,
      },
      cache: { cacheLocation: 'localStorage' },
    });
    await pca.initialize();
    // This parses the URL, posts the response to opener via BroadcastChannel/postMessage,
    // and (when run in a popup) MSAL itself will close this window.
    await pca.handleRedirectPromise();
  } catch (e) {
    console.error('[MSAL popup] handleRedirectPromise failed', e);
  } finally {
    // Belt-and-suspenders: close the popup if MSAL didn't.
    try { window.close(); } catch { /* ignore */ }
  }
}

if (isMsalPopup()) {
  void handlePopupResponse();
} else {
  // Dynamically import App so we don't drag heavy app code into the popup window.
  void import('./App.tsx').then(({ default: App }) => {
    createRoot(document.getElementById('root')!).render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
  });
}
