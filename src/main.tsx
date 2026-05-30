import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import ClientPortal from './components/ClientPortal'
import CreativeViewer from './components/CreativeViewer'
import LoginGate from './components/LoginGate'
import ErrorBoundary from './components/ErrorBoundary'
import LandingPage from './components/LandingPage'

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  })
}

const path = window.location.pathname
const singleMatch = path.match(/^\/c\/([a-zA-Z0-9-]+)\/(\d+)\/?$/)
const portalMatch = !singleMatch && path.match(/^\/c\/([a-zA-Z0-9-]+)\/?$/)
const isApp = path === '/app' || path.startsWith('/app/')
const isRoot = !singleMatch && !portalMatch && !isApp

// Redireciona funcionários logados direto para o app
if (isRoot) {
  const hasSession = sessionStorage.getItem('sm_tab_user')
  if (hasSession) {
    window.location.replace('/app')
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary tabName="DS HUB">
      {singleMatch
        ? <CreativeViewer token={singleMatch[1]} itemId={Number(singleMatch[2])} />
        : portalMatch
        ? <ClientPortal token={portalMatch[1]} />
        : isApp
        ? <LoginGate><App /></LoginGate>
        : <LandingPage />}
    </ErrorBoundary>
  </React.StrictMode>
)
