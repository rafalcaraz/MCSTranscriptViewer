import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'

// MSAL popup detection: if the URL contains an OAuth response (code/state in hash or
// query), treat this window as the MSAL popup. We DON'T check window.opener because
// modern browsers (COOP/COEP) often nullify it after a cross-origin navigation back
// from login.microsoftonline.com. The presence of an OAuth code in the URL is a
// strong-enough signal — the regular app never has those in its URL.
function isMsalPopup(): boolean {
  if (typeof window === 'undefined') return false;
  const hash = window.location.hash || '';
  const search = window.location.search || '';
  return /[#&?](code|error|state|id_token|access_token)=/i.test(hash + search);
}

async function handlePopupResponse() {
  console.log('[MSAL popup] handler starting, url=', window.location.href);
  const clientId = localStorage.getItem('multiEnv.clientId') ?? '';
  const tenantId = localStorage.getItem('multiEnv.tenantId') || 'organizations';
  if (!clientId) {
    console.warn('[MSAL popup] no clientId in localStorage; closing window');
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
    const result = await pca.handleRedirectPromise();
    console.log('[MSAL popup] handleRedirectPromise resolved', result);
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
