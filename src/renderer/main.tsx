import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { AppErrorBoundary } from './ui/AppErrorBoundary'
import './styles/tokens.css'
import './styles/app.css'
import './styles/mint-chrome.css'
import { initAppTheme } from './lib/applyAppTheme'

initAppTheme()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </StrictMode>
)
