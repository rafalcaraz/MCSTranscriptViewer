import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { LookupsProvider, defaultEnvLookupsImpl } from './context/LookupsContext'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LookupsProvider value={defaultEnvLookupsImpl}>
      <App />
    </LookupsProvider>
  </StrictMode>,
)
