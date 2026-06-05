import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import ClientPortal from './components/ClientPortal'
import CreativeViewer from './components/CreativeViewer'
import LandingPage from './components/LandingPage'
import ReportPage from './components/ReportPage'
import BriefingForm from './components/BriefingForm'
import LoginGate from './components/LoginGate'
import ErrorBoundary from './components/ErrorBoundary'

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  })
}

// Auto-reload quando chunk de deploy antigo falha ao carregar
window.addEventListener('error', (e) => {
  const msg = e.message ?? ''
  if (msg.includes('Failed to fetch dynamically imported module') || msg.includes('error loading dynamically imported module')) {
    const lastReload = Number(sessionStorage.getItem('ds_chunk_reload') ?? '0')
    if (Date.now() - lastReload > 10_000) {
      sessionStorage.setItem('ds_chunk_reload', String(Date.now()))
      window.location.reload()
    }
  }
})

const path = window.location.pathname
const singleMatch    = path.match(/^\/c\/([a-zA-Z0-9-]+)\/(\d+)\/?$/)
const portalMatch    = !singleMatch && path.match(/^\/c\/([a-zA-Z0-9-]+)\/?$/)
const reportMatch    = !singleMatch && !portalMatch && path.match(/^\/relatorio\/([a-zA-Z0-9-]+)\/?$/)
const briefingMatch  = !singleMatch && !portalMatch && !reportMatch && path.match(/^\/briefing\/([a-zA-Z0-9]+)\/?$/)
const landingMatch   = !singleMatch && !portalMatch && !reportMatch && !briefingMatch && path === '/landing'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary tabName="DS HUB">
      {singleMatch
        ? <CreativeViewer token={singleMatch[1]} itemId={Number(singleMatch[2])} />
        : portalMatch
        ? <ClientPortal token={portalMatch[1]} />
        : reportMatch
        ? <ReportPage token={reportMatch[1]} />
        : briefingMatch
        ? <BriefingForm token={briefingMatch[1]} />
        : landingMatch
        ? <LandingPage />
        : <LoginGate><App /></LoginGate>}
    </ErrorBoundary>
  </React.StrictMode>
)
