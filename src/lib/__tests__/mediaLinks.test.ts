import { describe, it, expect } from 'vitest'
import {
  applyUpsert, applyRemoveFile, applyRemoveItem, applyDriveReconcile, buildLegacyLinks,
  getCardPreview, fileIdFromUrl, parseLeadingItemId, presenceKey,
  PREVIEW_PENDING_LABEL, PREVIEW_UNCONFIRMED_LABEL,
  type MediaLinkMap, type DriveVideoRow,
} from '../mediaLinks'

const CARD_A = { i: 2007, c: 'Padaria Sol' }
const CARD_B = { i: 2011, c: 'Padaria Sol' }
const FILE_A = 'drive:AAA111'
const FILE_B = 'drive:BBB222'

function linked(itemId: number, clientId: string, fileId: string, over: Partial<MediaLinkMap[number]> = {}): MediaLinkMap {
  return {
    [itemId]: {
      id: `${clientId}::${fileId}`,
      itemId, clientId, fileId,
      url: `https://drive.google.com/file/d/${fileId.slice(6)}/view`,
      folderStage: 'publicar', source: 'drive', confirmed: true,
      linkedAt: 1, updatedAt: 1,
      ...over,
    },
  }
}

describe('fileIdFromUrl', () => {
  it('reconhece Drive, Streamable e imagem direta', () => {
    expect(fileIdFromUrl('https://drive.google.com/file/d/AAA111/view')).toBe('drive:AAA111')
    expect(fileIdFromUrl('https://drive.google.com/uc?id=AAA111')).toBe('drive:AAA111')
    expect(fileIdFromUrl('https://streamable.com/e/xyz9')).toBe('streamable:xyz9')
    expect(fileIdFromUrl('https://cdn.site.com/capa.jpg')).toBe('img:https://cdn.site.com/capa.jpg')
  })

  it('recusa link sem arquivo (post publicado, texto solto)', () => {
    expect(fileIdFromUrl('https://instagram.com/p/Cabc123/')).toBeNull()
    expect(fileIdFromUrl('   ')).toBeNull()
  })
})

describe('parseLeadingItemId', () => {
  it('lê o ID só no começo do nome', () => {
    expect(parseLeadingItemId('2007 - Unboxing.mp4')).toBe(2007)
    expect(parseLeadingItemId('#2007 Unboxing.mp4')).toBe(2007)
  })

  it('não casa com ano no meio do nome', () => {
    expect(parseLeadingItemId('reel 2026.mp4')).toBeNull()
    expect(parseLeadingItemId('final_v2 2007.mp4')).toBeNull()
  })
})

describe('getCardPreview', () => {
  it('Cenário 1 — card sem arquivo vinculado não mostra prévia', () => {
    // O cliente tem vídeos publicados em outros cards; este não tem nenhum.
    const links = linked(CARD_B.i, CARD_B.c, FILE_B)
    expect(getCardPreview(CARD_A, links)).toEqual({ kind: 'none' })
  })

  it('Cenário 2 — vínculo ainda na Inbox (não confirmado) não mostra thumbnail', () => {
    const links = linked(CARD_A.i, CARD_A.c, FILE_A, { confirmed: false })
    expect(getCardPreview(CARD_A, links)).toEqual({ kind: 'pending', label: PREVIEW_UNCONFIRMED_LABEL })
  })

  it('Cenário 3 — arquivo fora de Publicar mostra "aguardando publicação"', () => {
    const links = linked(CARD_A.i, CARD_A.c, FILE_A, { folderStage: 'revisao' })
    expect(getCardPreview(CARD_A, links)).toEqual({ kind: 'pending', label: PREVIEW_PENDING_LABEL })
  })

  it('Cenário 4 — arquivo confirmado em Publicar mostra a prévia', () => {
    const preview = getCardPreview(CARD_A, linked(CARD_A.i, CARD_A.c, FILE_A))
    expect(preview).toMatchObject({ kind: 'ready', fileId: FILE_A })
    if (preview.kind === 'ready') expect(preview.thumbUrl).toContain('AAA111')
  })

  it('Cenário 5 — arquivo removido de Publicar perde a prévia', () => {
    const links = linked(CARD_A.i, CARD_A.c, FILE_A, { folderStage: 'removido' })
    expect(getCardPreview(CARD_A, links).kind).toBe('pending')
  })

  it('Cenário 6 — dois cards do mesmo cliente não compartilham prévia', () => {
    const links = { ...linked(CARD_A.i, CARD_A.c, FILE_A), ...linked(CARD_B.i, CARD_B.c, FILE_B) }
    const a = getCardPreview(CARD_A, links)
    const b = getCardPreview(CARD_B, links)
    expect(a.kind).toBe('ready')
    expect(b.kind).toBe('ready')
    if (a.kind === 'ready' && b.kind === 'ready') expect(a.fileId).not.toBe(b.fileId)
  })

  it('ignora vínculo de outro cliente mesmo apontando para o item', () => {
    const links = linked(CARD_A.i, 'Outro Cliente', FILE_A)
    expect(getCardPreview(CARD_A, links)).toEqual({ kind: 'none' })
  })

  it('ignora vínculo com itemId divergente (registro corrompido)', () => {
    const links = linked(CARD_A.i, CARD_A.c, FILE_A)
    links[CARD_A.i] = { ...links[CARD_A.i], itemId: 9999 }
    expect(getCardPreview(CARD_A, links)).toEqual({ kind: 'none' })
  })
})

describe('applyUpsert', () => {
  it('um arquivo pertence a um conteúdo só', () => {
    let map = applyUpsert({}, { itemId: CARD_A.i, clientId: CARD_A.c, url: 'https://drive.google.com/file/d/AAA111/view' })
    map = applyUpsert(map, { itemId: CARD_B.i, clientId: CARD_B.c, url: 'https://drive.google.com/file/d/AAA111/view' })
    expect(Object.keys(map)).toEqual([String(CARD_B.i)])
  })

  it('não promove vínculo do Drive em triagem quando o mesmo arquivo é regravado', () => {
    const base = linked(CARD_A.i, CARD_A.c, FILE_A, { folderStage: 'removido', confirmed: false })
    const next = applyUpsert(base, { itemId: CARD_A.i, clientId: CARD_A.c, url: base[CARD_A.i].url })
    expect(next[CARD_A.i].folderStage).toBe('removido')
    expect(next[CARD_A.i].confirmed).toBe(false)
  })

  it('recusa URL sem arquivo reconhecível', () => {
    const map = applyUpsert({}, { itemId: CARD_A.i, clientId: CARD_A.c, url: 'https://instagram.com/p/Cabc' })
    expect(map).toEqual({})
  })

  it('remove por item e por arquivo', () => {
    const base = linked(CARD_A.i, CARD_A.c, FILE_A)
    expect(applyRemoveItem(base, CARD_A.i)).toEqual({})
    expect(applyRemoveFile(base, FILE_A)).toEqual({})
  })
})

describe('applyDriveReconcile', () => {
  const items = new Map([[CARD_A.i, CARD_A.c], [CARD_B.i, CARD_B.c]])
  const video = (over: Partial<DriveVideoRow> = {}): DriveVideoRow => ({
    drive_file_id: 'AAA111', client_name: CARD_A.c, filename: '2007 - Unboxing.mp4',
    linked_item_id: CARD_A.i, status: 'linked', ...over,
  })

  it('vídeo presente na pasta Publicar fica pronto para prévia', () => {
    const map = applyDriveReconcile({}, [video()], { [presenceKey(CARD_A.c, 'AAA111')]: 1 }, items)
    expect(getCardPreview(CARD_A, map).kind).toBe('ready')
  })

  it('vídeo sumido da pasta Publicar vira "removido"', () => {
    const other = { [presenceKey(CARD_A.c, 'ZZZ999')]: 1 }
    const map = applyDriveReconcile({}, [video()], other, items)
    expect(map[CARD_A.i].folderStage).toBe('removido')
    expect(getCardPreview(CARD_A, map).kind).toBe('pending')
  })

  it('sem dados de presença, mantém o comportamento conhecido (não apaga nada)', () => {
    const map = applyDriveReconcile({}, [video()], null, items)
    expect(map[CARD_A.i].folderStage).toBe('publicar')
  })

  it('vídeo que voltou para o inbox perde o vínculo', () => {
    const base = linked(CARD_A.i, CARD_A.c, FILE_A)
    const map = applyDriveReconcile(base, [video({ status: 'inbox', linked_item_id: null })], null, items)
    expect(getCardPreview(CARD_A, map)).toEqual({ kind: 'none' })
  })

  it('descarta vínculo entre clientes diferentes', () => {
    const map = applyDriveReconcile({}, [video({ client_name: 'Outro Cliente' })], null, items)
    expect(map).toEqual({})
  })

  it('descarta vínculo para conteúdo inexistente', () => {
    const map = applyDriveReconcile({}, [video({ linked_item_id: 999999 })], null, items)
    expect(map).toEqual({})
  })

  it('nome sem o ID do card entra como não confirmado (sem thumbnail)', () => {
    const map = applyDriveReconcile({}, [video({ filename: 'final_render.mp4' })], null, items)
    expect(map[CARD_A.i].confirmed).toBe(false)
    expect(getCardPreview(CARD_A, map).kind).toBe('pending')
  })
})

describe('buildLegacyLinks', () => {
  const items = [CARD_A, CARD_B]

  it('preserva a prévia de link colado à mão', () => {
    const map = buildLegacyLinks(items, {
      [CARD_A.i]: { link: 'https://drive.google.com/file/d/AAA111/view' },
    })
    expect(getCardPreview(CARD_A, map).kind).toBe('ready')
  })

  it('marca como não confirmado o que veio do auto-link antigo (link === footageLink)', () => {
    const url = 'https://drive.google.com/file/d/AAA111/view'
    const map = buildLegacyLinks(items, { [CARD_A.i]: { link: url, footageLink: url } })
    expect(map[CARD_A.i].confirmed).toBe(false)
    expect(getCardPreview(CARD_A, map).kind).toBe('pending')
  })

  it('ignora estado de conteúdo inexistente e link sem arquivo', () => {
    const map = buildLegacyLinks(items, {
      98765: { link: 'https://drive.google.com/file/d/CCC333/view' },
      [CARD_B.i]: { link: 'https://instagram.com/p/Cabc' },
    })
    expect(map).toEqual({})
  })
})
