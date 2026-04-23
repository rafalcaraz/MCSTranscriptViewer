import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { LookupsProvider, defaultEnvLookupsImpl } from './context/LookupsContext'
import { runAuthIfPending } from './authBootstrap'

// In Power Apps Player the Code App host only serves index.html, so we fold
// the auth popup's OAuth flow into this same entry. If the URL signals an
// auth phase (popup just opened with ?auth=start, or AAD just redirected
// back with #code=/#error=), we run the flow and never mount the SPA.
if (!runAuthIfPending()) {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <LookupsProvider value={defaultEnvLookupsImpl}>
        <App />
      </LookupsProvider>
    </StrictMode>,
  )
}
