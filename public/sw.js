const CACHE = 'ds-social-v7'

self.addEventListener('install', () => { self.skipWaiting() })

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  )
  self.clients.claim()
  scheduleDaily7h()
  scheduleLeadChecks()
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

// ── Web Push: recebe notificação do servidor ────────────────
self.addEventListener('push', e => {
  if (!e.data) return
  let payload
  try { payload = e.data.json() } catch { payload = { title: 'DS HUB', body: e.data.text() } }
  const { title = 'DS HUB', body = '', tag = 'ds-hub-push', tab = 0, vibrate = [200, 100, 200] } = payload
  e.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon:    '/icons/icon-192.png',
      badge:   '/icons/icon-72.png',
      tag,
      renotify: true,
      vibrate,
      data: { tab, url: `/?tab=${tab}` },
    })
  )
})

// ── Notification click — deep-link para a aba certa ────────
self.addEventListener('notificationclick', e => {
  e.notification.close()
  const targetTab = e.notification.data?.tab ?? 0
  const targetUrl = `${self.location.origin}/?tab=${targetTab}`
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      // Reutiliza janela existente se possível
      const existing = list.find(c => c.url.includes(self.location.origin))
      if (existing) {
        existing.postMessage({ type: 'NAVIGATE_TAB', tab: targetTab })
        return existing.focus()
      }
      return clients.openWindow(targetUrl)
    })
  )
})

// ── Notificação local diária às 7h ─────────────────────────
function scheduleDaily7h() {
  const now  = new Date()
  const next = new Date(now)
  next.setHours(7, 0, 0, 0)
  if (next <= now) next.setDate(next.getDate() + 1)
  const ms = next.getTime() - now.getTime()
  setTimeout(() => {
    fireDaily7hNotification()
    setInterval(fireDaily7hNotification, 24 * 60 * 60 * 1000)
  }, ms)
}

function fireDaily7hNotification() {
  const dias = ['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado']
  const hoje = dias[new Date().getDay()]
  const saudacoes = ['Vamos nessa!', 'Bora publicar!', 'Dia de produzir!', 'Equipe no ar!', 'Foco total hoje!']
  const saudacao = saudacoes[new Date().getDate() % saudacoes.length]

  clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    if (list.length === 0) {
      // App fechada — notificação com dia da semana + deep-link para Hoje
      self.registration.showNotification(`DS HUB ☀️ — ${hoje}`, {
        body: `${saudacao} Toque para ver o que publicar hoje.`,
        icon:  '/icons/icon-192.png',
        badge: '/icons/icon-72.png',
        tag: 'ds-hub-daily',
        renotify: true,
        vibrate: [200, 100, 200],
        data: { tab: 1, url: `${self.location.origin}/?tab=1` },
        actions: [
          { action: 'open', title: 'Ver hoje' },
        ],
      })
      return
    }
    // App aberta — pede resumo personalizado com contagem
    list[0].postMessage({ type: 'REQUEST_DAILY_SUMMARY' })
  })
}

// ── Lead follow-up (a cada hora) ──────────────────────────
function scheduleLeadChecks() {
  setTimeout(checkLeadFollowUps, 5 * 60 * 1000)
  setInterval(checkLeadFollowUps, 60 * 60 * 1000)
}

function checkLeadFollowUps() {
  clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    if (list.length === 0) return
    list[0].postMessage({ type: 'REQUEST_LEAD_SUMMARY' })
  })
}

// ── Mensagens vindas do App ────────────────────────────────
self.addEventListener('message', e => {
  if (e.data?.type === 'DAILY_SUMMARY') {
    // App já mostra a notificação — SW não precisa duplicar
    return
  }

  if (e.data?.type === 'LEAD_SUMMARY') {
    const { overdueLeads } = e.data
    if (!Array.isArray(overdueLeads) || overdueLeads.length === 0) return
    const names = overdueLeads.slice(0, 3).map(l => l.name).join(', ')
    const extra = overdueLeads.length > 3 ? ` +${overdueLeads.length - 3} mais` : ''
    self.registration.showNotification('📞 Follow-up pendente', {
      body: `${overdueLeads.length} lead${overdueLeads.length !== 1 ? 's' : ''}: ${names}${extra}`,
      icon:  '/icons/icon-192.png',
      badge: '/icons/icon-72.png',
      tag: 'ds-hub-leads',
      renotify: true,
      vibrate: [100, 50, 100],
      data: { tab: 17, url: `${self.location.origin}/?tab=17` },  // 17 = Prospecção
    })
    return
  }

  if (e.data?.type === 'TEST_NOTIFY') {
    self.registration.showNotification('🔔 DS HUB — teste', {
      body: 'Notificações push funcionando corretamente!',
      icon:  '/icons/icon-192.png',
      badge: '/icons/icon-72.png',
      tag: 'ds-hub-test',
      data: { tab: 0 },
    })
  }
})
