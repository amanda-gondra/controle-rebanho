import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { intlLocale, t } from './i18n/index.ts'

// Idioma e título da página vêm da tradução (G3)
document.documentElement.lang = intlLocale()
document.title = t('common.appName')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
