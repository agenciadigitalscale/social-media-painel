import { describe, it, expect } from 'vitest'
import {
  matchCardToFile, normalizeTitle, normalizeClientName, stripTypePrefix, buildExportName, exportCodeFor,
  parseCardIdFromFilename, parseCardCodeFromFilename, fileDeclaresCard,
  isVideoFile, acceptForContentType, matchInboxFileToCard, planInboxAutoLinks,
  type DriveFile, type InboxMatchCard, type InboxMatchFile,
} from '../videoMatch'

const video = (id: string, name: string, mimeType = 'video/mp4'): DriveFile => ({ id, name, mimeType })

describe('normalizeTitle', () => {
  it('iguala "VÍDEO - PONTO FIXO" e "video-ponto-fixo.mp4"', () => {
    expect(normalizeTitle('VÍDEO - PONTO FIXO')).toBe('video ponto fixo')
    expect(normalizeTitle('video-ponto-fixo.mp4')).toBe('video ponto fixo')
    expect(normalizeTitle('Video_Ponto__Fixo.MOV')).toBe('video ponto fixo')
  })

  it('remove acento, extensão e espaço duplo', () => {
    expect(normalizeTitle('  Promoção   de   Julho .mp4 ')).toBe('promocao de julho')
  })
})

describe('normalizeClientName', () => {
  it('iguala pontuação, acento, espaços e capitalização do mesmo cliente', () => {
    expect(normalizeClientName('Padaria R.A')).toBe(normalizeClientName('PADARIA RA'))
    expect(normalizeClientName('Marina Fênix')).toBe(normalizeClientName('MARINA FENIX'))
  })
})

describe('stripTypePrefix', () => {
  it('remove o prefixo de tipo quando sobra título', () => {
    expect(stripTypePrefix('video ponto fixo')).toBe('ponto fixo')
    expect(stripTypePrefix('reel unboxing julho')).toBe('unboxing julho')
  })

  it('não remove quando o resto ficaria vazio ou curto demais (evita colisão)', () => {
    expect(stripTypePrefix('video')).toBe('video')
    expect(stripTypePrefix('video x')).toBe('video x')
  })
})

describe('exportCodeFor', () => {
  it('dá 4 caracteres, sem letra que se confunda com número', () => {
    const code = exportCodeFor(5821)
    expect(code).toHaveLength(4)
    expect(code).toMatch(/^[0-9A-HJKMNP-TV-Z]{4}$/)
    expect(code).not.toMatch(/[ILOU]/)
  })

  it('é estável e único dentro da faixa do calendário', () => {
    expect(exportCodeFor(5821)).toBe(exportCodeFor(5821))
    const ids = [1, 226, 1001, 2226, 5821, 7226]
    expect(new Set(ids.map(exportCodeFor)).size).toBe(ids.length)
  })

  it('encolhe o ID de relógio de card criado à mão', () => {
    expect(exportCodeFor(1784548106364)).toHaveLength(4)
  })
})

describe('buildExportName', () => {
  it('põe cliente e título na frente e o selo no fim, sem extensão', () => {
    expect(buildExportName(5821, 'Lorenzeti', 'Vídeo Chuveiro'))
      .toBe(`Lorenzeti - Vídeo Chuveiro [${exportCodeFor(5821)}]`)
  })

  it('tira o que o Windows proíbe em nome de arquivo', () => {
    expect(buildExportName(5821, 'Cliente/X', 'Promo: 50% "off"'))
      .toBe(`Cliente X - Promo 50% off [${exportCodeFor(5821)}]`)
  })

  it('o nome gerado é lido de volta (ida e volta)', () => {
    const name = buildExportName(5821, 'Lorenzeti', 'Institucional')
    expect(fileDeclaresCard(`${name}.mp4`, 5821)).toBe(true)
    expect(fileDeclaresCard(`${name}.mp4`, 5822)).toBe(false)
  })
})

describe('parseCardCodeFromFilename / fileDeclaresCard', () => {
  it('lê o selo em qualquer posição', () => {
    expect(parseCardCodeFromFilename('Lorenzeti - Chuveiro [05MT].mp4')).toBe('05MT')
    expect(parseCardCodeFromFilename('[05mt] final v2.mp4')).toBe('05MT')
    expect(parseCardCodeFromFilename('sem selo.mp4')).toBeNull()
  })

  it('continua reconhecendo os formatos antigos', () => {
    expect(parseCardIdFromFilename('DSHUB-5821_VIDEO-PONTO-FIXO.mp4')).toBe(5821)
    expect(parseCardIdFromFilename('final DSHUB-5821 v2.mp4')).toBe(5821)
    expect(fileDeclaresCard('DSHUB-5821_VIDEO-PONTO-FIXO.mp4', 5821)).toBe(true)
    expect(fileDeclaresCard('2007 - Unboxing.mp4', 2007)).toBe(true)
  })

  it('lê o formato antigo só no começo', () => {
    expect(parseCardIdFromFilename('#2007 Unboxing.mp4')).toBe(2007)
    expect(parseCardIdFromFilename('reel 2026.mp4')).toBeNull()
  })

  it('selo presente manda sobre o ID antigo no mesmo nome', () => {
    const name = `DSHUB-5821_X [${exportCodeFor(2007)}].mp4`
    expect(fileDeclaresCard(name, 2007)).toBe(true)
    expect(fileDeclaresCard(name, 5821)).toBe(false)
  })
})

describe('isVideoFile', () => {
  it('só aceita mime de vídeo', () => {
    expect(isVideoFile(video('a', 'x.mp4'))).toBe(true)
    expect(isVideoFile({ id: 'b', name: 'capa.jpg', mimeType: 'image/jpeg' })).toBe(false)
  })
})

describe('matchCardToFile', () => {
  const title = 'Vídeo - Ponto Fixo'

  it('Cenário 1 — pasta sem arquivo compatível', () => {
    const r = matchCardToFile({ cardId: 5821, title, files: [video('a', 'outra coisa.mp4')] })
    expect(r.outcome).toBe('not_found')
  })

  it('Cenário 2 — arquivo com o ID do card vence tudo', () => {
    const r = matchCardToFile({
      cardId: 5821, title,
      files: [video('a', 'video-ponto-fixo.mp4'), video('b', 'DSHUB-5821_VIDEO-PONTO-FIXO.mp4')],
    })
    expect(r.outcome).toBe('matched')
    expect(r.file?.id).toBe('b')
    expect(r.matchedBy).toBe('card_id')
  })

  it('Cenário 3 — dois arquivos parecidos não escolhem sozinhos', () => {
    const r = matchCardToFile({
      cardId: 5821, title,
      files: [video('a', 'video-ponto-fixo.mp4'), video('b', 'VIDEO PONTO FIXO.mov')],
    })
    expect(r.outcome).toBe('ambiguous')
    expect(r.candidates).toHaveLength(2)
  })

  it('dois arquivos com o MESMO ID do card também pedem escolha humana', () => {
    const r = matchCardToFile({
      cardId: 5821, title,
      files: [video('a', 'DSHUB-5821_X.mp4'), video('b', 'DSHUB-5821_X-v2.mp4')],
    })
    expect(r.outcome).toBe('ambiguous')
  })

  it('Cenário 9 — arquivo antigo sem ID, título exato e único', () => {
    const r = matchCardToFile({ cardId: 5821, title, files: [video('a', 'video-ponto-fixo.mp4')] })
    expect(r.outcome).toBe('matched')
    expect(r.matchedBy).toBe('exact_normalized_title')
  })

  it('casa "Ponto Fixo" com "VIDEO-PONTO-FIXO" ignorando o prefixo de tipo', () => {
    const r = matchCardToFile({ cardId: 5821, title: 'Ponto Fixo', files: [video('a', 'VIDEO-PONTO-FIXO.mp4')] })
    expect(r.outcome).toBe('matched')
    expect(r.matchConfidence).toBeLessThan(1)
  })

  it('não aceita correspondência parcial de nome', () => {
    const r = matchCardToFile({
      cardId: 5821, title: 'Institucional',
      files: [video('a', 'institucional-versao-final-cliente.mp4')],
    })
    expect(r.outcome).toBe('not_found')
  })

  it('ignora imagem quando o card é Reel (accept padrão = vídeo)', () => {
    const r = matchCardToFile({
      cardId: 5821, title,
      files: [{ id: 'a', name: 'DSHUB-5821_VIDEO-PONTO-FIXO.png', mimeType: 'image/png' }],
    })
    expect(r.outcome).toBe('not_found')
  })

  it('aceita imagem quando o card é de design (accept = media)', () => {
    const r = matchCardToFile({
      cardId: 5821, title: 'Promoção de Julho', accept: 'media',
      files: [{ id: 'a', name: 'DSHUB-5821_PROMOCAO-DE-JULHO.png', mimeType: 'image/png' }],
    })
    expect(r.outcome).toBe('matched')
    expect(r.matchedBy).toBe('card_id')
  })

  it('carrossel com várias imagens do mesmo card pede escolha humana', () => {
    const r = matchCardToFile({
      cardId: 5821, title: 'Promoção de Julho', accept: 'media',
      files: [
        { id: 'a', name: 'DSHUB-5821_PROMO-1.png', mimeType: 'image/png' },
        { id: 'b', name: 'DSHUB-5821_PROMO-2.png', mimeType: 'image/png' },
      ],
    })
    expect(r.outcome).toBe('ambiguous')
    expect(r.candidates).toHaveLength(2)
  })

  it('descarta o que não é criativo (.psd, projeto do editor)', () => {
    const r = matchCardToFile({
      cardId: 5821, title: 'Promoção de Julho', accept: 'media',
      files: [{ id: 'a', name: 'DSHUB-5821_PROMOCAO-DE-JULHO.psd', mimeType: 'application/octet-stream' }],
    })
    expect(r.outcome).toBe('not_found')
  })

  it('acceptForContentType separa vídeo de criativo estático', () => {
    expect(acceptForContentType('Reel')).toBe('video')
    expect(acceptForContentType('Story')).toBe('video')
    expect(acceptForContentType('Post')).toBe('media')
    expect(acceptForContentType('Carrossel')).toBe('media')
    expect(acceptForContentType('Feed')).toBe('media')
  })

  it('o ID de outro card não casa', () => {
    const r = matchCardToFile({ cardId: 5821, title, files: [video('a', 'DSHUB-9999_OUTRO.mp4')] })
    expect(r.outcome).toBe('not_found')
  })
})


describe('auto-link seguro da Inbox', () => {
  const card: InboxMatchCard = {
    id: 5821,
    clientName: 'Luthita',
    title: 'VIDEO - AQUI TEM TUDO',
    contentType: 'Reel',
    status: 2,
  }
  const inboxFile = (id: string, name: string, clientName = 'Luthita'): InboxMatchFile => ({
    id,
    name,
    clientName,
    mimeType: 'video/mp4',
  })

  it('vincula pelo selo exato mesmo com cliente e título no nome do arquivo', () => {
    const result = matchInboxFileToCard(
      inboxFile('drive-1', 'Luthita - VIDEO - AQUI TEM TUDO [' + exportCodeFor(card.id) + '].mp4'),
      [card],
    )
    expect(result.outcome).toBe('matched')
    expect(result.card?.id).toBe(card.id)
    expect(result.matchedBy).toBe('card_id')
  })

  it('aceita título exato e único sem selo, removendo apenas o prefixo do cliente', () => {
    const result = matchInboxFileToCard(
      inboxFile('drive-1', 'Luthita - VIDEO - AQUI TEM TUDO.mp4'),
      [card],
    )
    expect(result.outcome).toBe('matched')
    expect(result.matchedBy).toBe('exact_normalized_title')
  })

  it('não usa o título como plano B quando o arquivo traz um selo errado', () => {
    const result = matchInboxFileToCard(
      inboxFile('drive-1', 'Luthita - VIDEO - AQUI TEM TUDO [' + exportCodeFor(9999) + '].mp4'),
      [card],
    )
    expect(result.outcome).toBe('not_found')
  })

  it('não vincula card em A fazer nem card de outro cliente', () => {
    expect(matchInboxFileToCard(inboxFile('drive-1', 'VIDEO - AQUI TEM TUDO.mp4'), [
      { ...card, status: 0 },
    ]).outcome).toBe('not_found')

    expect(matchInboxFileToCard(inboxFile('drive-1', 'VIDEO - AQUI TEM TUDO.mp4', 'Outro Cliente'), [
      card,
    ]).outcome).toBe('not_found')
  })

  it('deixa títulos duplicados para escolha manual', () => {
    const result = matchInboxFileToCard(
      inboxFile('drive-1', 'Luthita - VIDEO - AQUI TEM TUDO.mp4'),
      [card, { ...card, id: 5822, status: 1 }],
    )
    expect(result.outcome).toBe('ambiguous')
    expect(result.candidates).toHaveLength(2)
  })

  it('não escolhe entre duas versões que apontam para o mesmo card', () => {
    const code = exportCodeFor(card.id)
    const plans = planInboxAutoLinks([
      inboxFile('drive-final', 'Luthita - VIDEO - AQUI TEM TUDO [' + code + '].mp4'),
      inboxFile('drive-v2', 'Luthita - VIDEO - AQUI TEM TUDO [' + code + '] v2.mp4'),
    ], [card])
    expect(plans).toEqual([])
  })
})
