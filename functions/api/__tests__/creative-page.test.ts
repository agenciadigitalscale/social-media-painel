import { describe, expect, it, vi } from 'vitest'
import { onRequest } from '../../c/[token]/[itemId]'

const SHELL = `<!doctype html><html><head>
  <meta property="og:site_name" content="Digital Scale" />
  <meta property="og:title" content="padrão" />
  <meta property="og:description" content="padrão" />
  <meta property="og:image" content="/logotipo.png" />
  <meta property="og:type" content="website" />
</head><body><div id="root"></div></body></html>`

const assets = { fetch: async () => new Response(SHELL, { headers: { 'Content-Type': 'text/html' } }) }

/** Responde às duas consultas da rota: dono do token e campos do item. */
function fakeDB(opts: { client?: string | null; title?: string | null; link?: string | null } = {}) {
  return {
    prepare(sql: string) {
      return {
        bind() { return this },
        first: async () => {
          if (sql.includes('sm_portal_tokens')) {
            return opts.client ? { client: opts.client } : undefined
          }
          return { f0: opts.title ?? null, f1: opts.link ?? null }
        },
        all: async () => ({ results: [] }),
        run: async () => ({ meta: { changes: 0 } }),
      }
    },
  } as unknown as D1Database
}

const explodingDB = {
  prepare() {
    return {
      bind() { return this },
      first: async () => { throw new Error('D1 fora do ar') },
      all:   async () => { throw new Error('D1 fora do ar') },
      run:   async () => { throw new Error('D1 fora do ar') },
    }
  },
} as unknown as D1Database

function ctx(db: D1Database, token = 'tok-1', itemId = '2007') {
  return {
    request: new Request(`https://painel.example/c/${token}/${itemId}`),
    env: { DB: db, ASSETS: assets } as never,
    params: { token, itemId },
    waitUntil: vi.fn(),
  } as never
}

describe('página /c/:token/:itemId', () => {
  it('preenche as meta tags com o título do criativo e a miniatura do nosso domínio', async () => {
    const db = fakeDB({
      client: 'Lareiras Grill',
      title:  'Vídeo Dia dos Pais',
      link:   'https://drive.google.com/file/d/ABCdef123456/view',
    })
    const html = await (await onRequest(ctx(db))).text()

    expect(html).toContain('og:title" content="Vídeo Dia dos Pais · Lareiras Grill"')
    // `drive.google.com/thumbnail` só responde para arquivo público e a pasta
    // Publicar é privada — a prévia do WhatsApp tem que sair pelo nosso domínio.
    expect(html).toContain('/api/thumb?id=ABCdef123456')
  })

  it('escapa aspas do título — quebrava a meta tag e sumia com a prévia', async () => {
    const db = fakeDB({ client: 'Lareiras Grill', title: 'O "melhor" corte' })
    const html = await (await onRequest(ctx(db))).text()
    expect(html).toContain('&quot;melhor&quot;')
  })

  it('D1 fora do ar ainda entrega a página — o SPA busca os dados sozinho', async () => {
    // Esta é a regressão que gerou reclamação: quando esta rota falha, o cliente
    // não vê "erro ao carregar", vê a página de erro da Cloudflare com Ray ID.
    const res = await onRequest(ctx(explodingDB))
    expect(res.status).toBe(200)

    const html = await res.text()
    expect(html).toContain('<div id="root">')
    expect(html).toContain('Digital Scale — Aprovação de criativo')
  })

  it('token desconhecido não vaza nome de cliente nenhum', async () => {
    const html = await (await onRequest(ctx(fakeDB({ client: null })))).text()
    expect(html).toContain('Digital Scale — Aprovação de criativo')
    expect(html).toContain('/logotipo.png')
  })

  it('itemId não numérico não vira consulta', async () => {
    const db = fakeDB({ client: 'Lareiras Grill', title: 'não deve aparecer' })
    const html = await (await onRequest(ctx(db, 'tok-1', '../../etc'))).text()
    expect(html).not.toContain('não deve aparecer')
  })

  it('deixa a borda guardar por pouco tempo — link repassado em grupo é uma rajada', async () => {
    const res = await onRequest(ctx(fakeDB({ client: 'Lareiras Grill' })))
    expect(res.headers.get('Cache-Control')).toContain('s-maxage=120')
  })
})
