import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import ClientPortal from './components/ClientPortal'

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  })
}

const path = window.location.pathname
const portalMatch = path.match(/^\/c\/([a-zA-Z0-9-]+)\/?$/)
const portalToken = portalMatch ? portalMatch[1] : null

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {portalToken ? <ClientPortal token={portalToken} /> : <App />}
  </React.StrictMode>
)
