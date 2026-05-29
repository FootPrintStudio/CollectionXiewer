import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { AppErrorBoundary } from './ui/AppErrorBoundary'
import './styles/tokens.css'
import './styles/app.css'
import './styles/retro-chrome.css'
import './styles/app-retro-overrides.css'
import { initVaultPerformance } from './lib/initVaultPerformance'

document.documentElement.dataset.theme = 'vault'
initVaultPerformance()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </StrictMode>
)
