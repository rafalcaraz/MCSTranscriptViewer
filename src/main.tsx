import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// MSAL popup detection: if this window was opened by another (window.opener exists) AND
// the URL contains an OAuth response (code/state in hash or query), we are the MSAL popup.
// Don't render the app — let MSAL in the parent window read our URL and close us.
function isMsalPopup(): boolean {
  if (typeof window === 'undefined') return false;
  if (!window.opener || window.opener === window) return false;
  const hash = window.location.hash || '';
  const search = window.location.search || '';
  return /[#&?](code|error|state|id_token|access_token)=/i.test(hash + search);
}

if (!isMsalPopup()) {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}
