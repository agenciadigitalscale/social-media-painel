import { describe, it, expect, beforeEach, vi } from 'vitest'

// Integração: o registro de vínculos com persistência real (localStorage) e o
// sync stubado — é assim que o app roda.
function makeStorage(): Storage {
  const data = new Map<string, string>()
  return {
    get length() { return data.size },
    key: (i: number) => Array.from(data.keys())[i] ?? null,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => { data.set(k, String(v)) },
    removeItem: (k: string) => { data.delete(k) },
    clear: () => { data.clear() },
  } as Storage
}

vi.stubGlobal('localStorage', makeStorage())
vi.stubGlobal('fetch', vi.fn(async () => new Response('{}')))
vi.stubGlobal('navigator', { onLine: true })

const {
  getMediaLinks, getCardPreview, syncManualLink, removeMediaLinkForItem, removeMediaLinkForFile,
  reconcileMediaLinksFromDrive, migrateLegacyMediaLinks, subscribeMediaLinks, reloadMediaLinks,
  presenceKey, MEDIA_LINKS_KEY,
} = await import('../mediaLinks')

const CARD = { i: 2007, c: 'Padaria Sol' }
const OTHER = { i: 2011, c: 'Padaria Sol' }
const URL_A = 'https://drive.google.com/file/d/AAA111/view'

beforeEach(() => {
  localStorage.clear()
  reloadMediaLinks()
})

describe('vínculo manual', () => {
  it('Cenário 10 — vínculo salvo aparece na prévia e persiste', () => {
    syncManualLink(CARD.i, CARD.c, URL_A)
    expect(getCardPreview(CARD, getMediaLinks()).kind).toBe('ready')
    expect(JSON.parse(localStorage.getItem(MEDIA_LINKS_KEY)!)[CARD.i].fileId).toBe('drive:AAA111')
  })

  it('limpar o campo de link apaga o vínculo e a prévia', () => {
    syncManualLink(CARD.i, CARD.c, URL_A)
    syncManualLink(CARD.i, CARD.c, '')
    expect(getCardPreview(CARD, getMediaLinks())).toEqual({ kind: 'none' })
  })

  it('link sem arquivo (post publicado) não deixa prévia velha para trás', () => {
    vi.useFakeTimers()
    syncManualLink(CARD.i, CARD.c, URL_A)
    syncManualLink(CARD.i, CARD.c, 'https://instagram.com/p/Cabc123/')
    vi.advanceTimersByTime(2000)
    expect(getCardPreview(CARD, getMediaLinks())).toEqual({ kind: 'none' })
    vi.useRealTimers()
  })

  it('colar aos pedaços não apaga o vínculo debaixo do dedo de quem cola', () => {
    vi.useFakeTimers()
    syncManualLink(CARD.i, CARD.c, URL_A)
    // O campo salva a cada tecla: a URL passa por estados que não são arquivo nenhum.
    for (const partial of ['h', 'https:/', 'https://drive.google.com/file/']) {
      syncManualLink(CARD.i, CARD.c, partial)
      vi.advanceTimersByTime(200)
    }
    syncManualLink(CARD.i, CARD.c, 'https://drive.google.com/file/d/BBB222/view')
    vi.advanceTimersByTime(2000)

    const preview = getCardPreview(CARD, getMediaLinks())
    expect(preview.kind).toBe('ready')
    expect(getMediaLinks()[CARD.i].fileId).toBe('drive:BBB222')
    vi.useRealTimers()
  })

  it('card ainda em produção mostra a prévia do link colado à mão', () => {
    syncManualLink(CARD.i, CARD.c, URL_A)
    // status 1 = Em produção. A trava de status vale para vínculo automático:
    // aqui alguém afirmou qual é o arquivo.
    expect(getCardPreview(CARD, getMediaLinks(), 1).kind).toBe('ready')
  })
})

describe('reconciliação com o Drive', () => {
  const items = new Map([[CARD.i, CARD.c], [OTHER.i, OTHER.c]])
  const linkedVideo = {
    drive_file_id: 'AAA111', client_name: CARD.c, filename: '2007 - Unboxing.mp4',
    linked_item_id: CARD.i, status: 'linked' as const,
  }

  it('avisa os assinantes quando a etapa muda (sem recarregar a página)', () => {
    const seen: number[] = []
    const unsubscribe = subscribeMediaLinks(() => seen.push(1))

    // Relógio controlado: a varredura que "não vê mais" o arquivo precisa ser
    // posterior ao vínculo, senão o correto é justamente não despromover.
    vi.useFakeTimers()
    try {
      vi.setSystemTime(new Date('2026-07-21T10:00:00Z'))
      const scan1 = Math.floor(Date.now() / 1000)
      reconcileMediaLinksFromDrive([linkedVideo], { [presenceKey(CARD.c, 'AAA111')]: scan1 }, items)
      expect(getCardPreview(CARD, getMediaLinks()).kind).toBe('ready')

      // Cinco minutos depois o arquivo já não está na pasta Publicar.
      vi.setSystemTime(new Date('2026-07-21T10:05:00Z'))
      const scan2 = Math.floor(Date.now() / 1000)
      reconcileMediaLinksFromDrive([linkedVideo], { [presenceKey(CARD.c, 'ZZZ999')]: scan2 }, items)
      expect(getCardPreview(CARD, getMediaLinks()).kind).toBe('pending')
    } finally {
      vi.useRealTimers()
    }

    expect(seen.length).toBeGreaterThanOrEqual(2)
    unsubscribe()
  })

  it('desvincular o arquivo limpa a prévia do card', () => {
    reconcileMediaLinksFromDrive([linkedVideo], null, items)
    removeMediaLinkForFile('drive:AAA111')
    expect(getCardPreview(CARD, getMediaLinks())).toEqual({ kind: 'none' })
  })
})

describe('migração dos vínculos antigos', () => {
  it('roda uma vez, mantém o que já existe e não inventa vínculo inválido', () => {
    syncManualLink(OTHER.i, OTHER.c, 'https://drive.google.com/file/d/BBB222/view')

    migrateLegacyMediaLinks([CARD, OTHER], {
      [CARD.i]: { link: URL_A, footageLink: URL_A },      // auto-link antigo → a confirmar
      [OTHER.i]: { link: 'https://drive.google.com/file/d/CCC333/view' },
      99999: { link: 'https://drive.google.com/file/d/DDD444/view' }, // conteúdo inexistente
    })

    const map = getMediaLinks()
    expect(map[CARD.i].confirmed).toBe(false)
    expect(getCardPreview(CARD, map).kind).toBe('pending')
    // O vínculo que já existia vence a migração.
    expect(map[OTHER.i].fileId).toBe('drive:BBB222')
    expect(map[99999]).toBeUndefined()

    // Segunda chamada não refaz nada.
    removeMediaLinkForItem(CARD.i)
    migrateLegacyMediaLinks([CARD, OTHER], { [CARD.i]: { link: URL_A } })
    expect(getMediaLinks()[CARD.i]).toBeUndefined()
  })
})
