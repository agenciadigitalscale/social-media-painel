import { describe, it, expect } from 'vitest'
import {
  matchCardToFile, normalizeTitle, stripTypePrefix, buildExportFileName,
  parseCardIdFromFilename, isVideoFile, acceptForContentType, type DriveFile,
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

describe('buildExportFileName / parseCardIdFromFilename', () => {
  it('gera o nome no formato do DS HUB', () => {
    expect(buildExportFileName(5821, 'Vídeo - Ponto Fixo')).toBe('DSHUB-5821_VIDEO-PONTO-FIXO.mp4')
  })

  it('lê o ID do formato novo em qualquer posição', () => {
    expect(parseCardIdFromFilename('DSHUB-5821_VIDEO-PONTO-FIXO.mp4')).toBe(5821)
    expect(parseCardIdFromFilename('final DSHUB-5821 v2.mp4')).toBe(5821)
  })

  it('lê o formato antigo só no começo', () => {
    expect(parseCardIdFromFilename('2007 - Unboxing.mp4')).toBe(2007)
    expect(parseCardIdFromFilename('#2007 Unboxing.mp4')).toBe(2007)
    expect(parseCardIdFromFilename('reel 2026.mp4')).toBeNull()
  })

  it('o nome gerado é lido de volta pelo matcher (ida e volta)', () => {
    const name = buildExportFileName(5821, 'Institucional')
    expect(parseCardIdFromFilename(name)).toBe(5821)
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
