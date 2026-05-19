import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import './styles/tokens.css'
import './styles/app.css'
import './styles/retro-chrome.css'
import './styles/app-retro-overrides.css'
import { initGrainTexture } from './lib/initGrainTexture'

document.documentElement.dataset.ui = 'retro'
initGrainTexture()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
