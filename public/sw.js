const CACHE = 'ds-social-v4'

self.addEventListener('install', e => {
  self.skipWaiting()
})

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  )
  self.clients.claim()
  // Agenda a notificação diária das 7h assim que o SW ativa
  scheduleDaily7h()
})

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url)
  if (url.pathname.startsWith('/api/')) return

  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          if (res.ok) {
            const clone = res.clone()
            caches.open(CACHE).then(c => c.put(e.request, clone))
          }
          return res
        })
        .catch(() => caches.match(e.request).then(c => c ?? Response.error()))
    )
    return
  }

  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached
      return fetch(e.request).then(res => {
        if (!res || res.status !== 200 || res.type === 'opaque') return res
        const clone = res.clone()
        caches.open(CACHE).then(c => c.put(e.request, clone))
        return res
      })
    })
  )
})

// ── Notificação push diária às 7h ──────────────────────────────────────────

self.addEventListener('notificationclick', e => {
  e.notification.close()
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      const existing = list.find(c => c.url.includes(self.location.origin))
      if (existing) return existing.focus()
      return clients.openWindow('/')
    })
  )
})

// Alarme: chama a si mesmo via setTimeout para disparar às 7h
function scheduleDaily7h() {
  const now  = new Date()
  const next = new Date(now)
  next.setHours(7, 0, 0, 0)
  if (next <= now) next.setDate(next.getDate() + 1)
  const ms = next.getTime() - now.getTime()

  setTimeout(() => {
    fireDaily7hNotification()
    // reagenda para o próximo dia
    setInterval(fireDaily7hNotification, 24 * 60 * 60 * 1000)
  }, ms)
}

function fireDaily7hNotification() {
  // Lê dados do painel via postMessage para os clients ativos
  clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    if (list.length === 0) {
      // App não está aberta — dispara notificação genérica
      showNotification('📋 DS HUB — bom dia!', 'Abra o painel para ver as publicações de hoje.')
      return
    }
    // Pede o resumo do dia para o client aberto
    list[0].postMessage({ type: 'REQUEST_DAILY_SUMMARY' })
  })
}

// Recebe resumo do dia vindo do App
self.addEventListener('message', e => {
  if (e.data?.type === 'DAILY_SUMMARY') {
    const { total, overdue, hoje } = e.data
    const body = [
      hoje  > 0 ? `📅 ${hoje} publicação${hoje > 1 ? 'ões' : ''} hoje`         : '',
      overdue > 0 ? `🔴 ${overdue} atrasada${overdue > 1 ? 's' : ''}`          : '',
      total === 0 ? '✅ Nada pendente hoje — bom trabalho!'                    : '',
    ].filter(Boolean).join(' · ')
    showNotification('📋 DS HUB — ' + new Date().toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' }), body || 'Confira o painel.')
    return
  }

  // Notificação manual testável (window.postMessage({type:'TEST_NOTIFY'}) no console)
  if (e.data?.type === 'TEST_NOTIFY') {
    showNotification('🔔 DS HUB — teste', 'Notificações funcionando corretamente!')
  }
})

function showNotification(title, body) {
  self.registration.showNotification(title, {
    body,
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-72.png',
    tag: 'ds-hub-daily',
    renotify: true,
    vibrate: [200, 100, 200],
    data: { url: '/' },
  })
}
