import { describe, expect, it } from 'vitest'
import {
  formatBytes, medianBytes, weighExport, weightTrend,
  HEAVY_BYTES, MIRROR_LIMIT_BYTES,
} from '../exportWeight'

const MB = 1024 * 1024

describe('formatBytes', () => {
  it('usa a unidade que a pessoa lê', () => {
    expect(formatBytes(400 * 1024)).toBe('400 KB')
    expect(formatBytes(91 * MB)).toBe('91 MB')
    expect(formatBytes(1.5 * 1024 * MB)).toBe('1.5 GB')
  })

  it('tamanho ausente não vira "0"', () => {
    expect(formatBytes(null)).toBe('—')
    expect(formatBytes(undefined)).toBe('—')
  })
})

describe('weighExport', () => {
  it('export no alvo passa sem alarde', () => {
    // Aviso que dispara em tudo vira aviso que ninguém lê.
    const v = weighExport(30 * MB, 'video/mp4')!
    expect(v.level).toBe('ok')
    expect(v.label).toBe('30 MB')
  })

  it('acima de 70 MB avisa que o cliente paga a conta', () => {
    const v = weighExport(118 * MB, 'video/mp4')!
    expect(v.level).toBe('heavy')
    expect(v.label).toContain('118 MB')
    expect(v.hint).toContain('recomprime')
  })

  it('acima do teto do espelho é outro problema — o link fica preso ao Drive', () => {
    const v = weighExport(1.5 * 1024 * MB, 'video/mp4')!
    expect(v.level).toBe('huge')
    expect(v.label).toContain('não cabe no espelho')
    expect(v.hint).toContain('pasta Publicar')
  })

  it('a mediana medida em produção (91 MB) cai como pesada — é o alvo da mudança', () => {
    expect(weighExport(91 * MB, 'video/mp4')!.level).toBe('heavy')
  })

  it('um Reel de 60s no preset recomendado NÃO é acusado', () => {
    // ~8 Mbps por 60s ≈ 60 MB. Acusar quem já faz certo destruiria o aviso.
    expect(weighExport(60 * MB, 'video/mp4')!.level).toBe('ok')
  })

  it('imagem não é pesada por natureza — mediana medida de 1,2 MB', () => {
    expect(weighExport(80 * MB, 'image/jpeg')).toBeNull()
  })

  it('sem tamanho, silêncio — chutar treinaria a equipe a ignorar', () => {
    expect(weighExport(null, 'video/mp4')).toBeNull()
    expect(weighExport(0, 'video/mp4')).toBeNull()
    expect(weighExport(undefined)).toBeNull()
  })

  it('sem mime ainda pesa — o filtro de imagem é opcional', () => {
    expect(weighExport(120 * MB)!.level).toBe('heavy')
  })

  it('os limites são de fato os documentados', () => {
    expect(weighExport(HEAVY_BYTES, 'video/mp4')!.level).toBe('ok')
    expect(weighExport(HEAVY_BYTES + 1, 'video/mp4')!.level).toBe('heavy')
    expect(weighExport(MIRROR_LIMIT_BYTES, 'video/mp4')!.level).toBe('heavy')
    expect(weighExport(MIRROR_LIMIT_BYTES + 1, 'video/mp4')!.level).toBe('huge')
  })
})

describe('medianBytes', () => {
  it('ímpar pega o do meio, par tira a média', () => {
    expect(medianBytes([10, 30, 20])).toBe(20)
    expect(medianBytes([10, 20, 30, 40])).toBe(25)
  })

  it('ignora nulo e zero em vez de contá-los como pequenos', () => {
    // Contar ausência como 0 puxaria a mediana para baixo e esconderia o peso.
    expect(medianBytes([null, 0, 100, undefined, 200, 300])).toBe(200)
  })

  it('sem amostra devolve null, não 0', () => {
    expect(medianBytes([])).toBeNull()
    expect(medianBytes([null, undefined, 0])).toBeNull()
  })
})

describe('weightTrend', () => {
  it('mede a curva e diz se já está no alvo', () => {
    const t = weightTrend([91 * MB, 118 * MB, 142 * MB])
    expect(t.sample).toBe(3)
    expect(t.median).toBe(118 * MB)
    expect(t.heavy).toBe(3)
    expect(t.onTarget).toBe(false)
  })

  it('depois do preset novo, vira alvo atingido', () => {
    const t = weightTrend([25 * MB, 30 * MB, 28 * MB])
    expect(t.heavy).toBe(0)
    expect(t.onTarget).toBe(true)
  })

  it('amostra vazia não finge estar no alvo', () => {
    // "0 de 0 pesados" não é sucesso — é ausência de dado.
    const t = weightTrend([])
    expect(t.median).toBeNull()
    expect(t.sample).toBe(0)
    expect(t.onTarget).toBe(false)
  })
})
