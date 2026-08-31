import { describe, expect, it } from 'vitest'
import {
  checkFormat, formatBytes, medianBytes, weighExport, weightTrend,
  HEAVY_BYTES, MIRROR_LIMIT_BYTES, riskBeforeSending,
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

describe('checkFormat', () => {
  it('.mov é a bomba-relógio: Safari toca, Android recusa', () => {
    // 24 dos 113 vídeos rastreados em produção são video/quicktime. Ficou
    // invisível porque os clientes que abriam vídeo eram de iPhone.
    const v = checkFormat('video/quicktime', 'ACADEMIA NAZARÉ [CG17].mov')!
    expect(v.level).toBe('risky')
    expect(v.label).toBe('formato .mov')
    expect(v.hint).toContain('Android')
  })

  it('pega o .mov pelo nome mesmo sem mime', () => {
    expect(checkFormat(null, 'video.mov')!.level).toBe('risky')
  })

  it('pega o quicktime pelo mime mesmo com nome sem extensão', () => {
    expect(checkFormat('video/quicktime', 'video sem extensao')!.level).toBe('risky')
  })

  it('arquivo de projeto não abre em navegador nenhum', () => {
    // Achado em produção: um .psd na pasta Publicar.
    const v = checkFormat('image/x-photoshop', 'arte final.psd')!
    expect(v.level).toBe('unplayable')
    expect(v.hint).toContain('Exporte')
  })

  it('HEIC do iPhone quebra em boa parte dos Android', () => {
    expect(checkFormat('image/heic', 'foto.heic')!.level).toBe('risky')
  })

  it('mp4, png e jpg passam calados — são o que deve chegar ao cliente', () => {
    expect(checkFormat('video/mp4', 'reel.mp4')).toBeNull()
    expect(checkFormat('image/png', 'post.png')).toBeNull()
    expect(checkFormat('image/jpeg', 'foto.jpg')).toBeNull()
  })

  it('sem informação nenhuma não inventa alerta', () => {
    expect(checkFormat(null, null)).toBeNull()
    expect(checkFormat(undefined, undefined)).toBeNull()
  })

  it('peso e formato são independentes — um .mov leve ainda é .mov', () => {
    // O arquivo da Kátia tinha os DOIS problemas; um não implica o outro.
    expect(checkFormat('video/quicktime', 'curto.mov')!.level).toBe('risky')
    expect(weighExport(20 * MB, 'video/quicktime')!.level).toBe('ok')
  })
})

describe('riskBeforeSending — a trava do envio ao cliente', () => {
  const MB = 1024 * 1024

  it('mp4 no preset passa sem interromper ninguém', () => {
    expect(riskBeforeSending({ mimeType: 'video/mp4', filename: 'Reel.mp4', bytes: 28 * MB })).toBeNull()
  })

  it('.mov por mime é bloqueante — é falha TOTAL no Android, não lentidão', () => {
    const r = riskBeforeSending({ mimeType: 'video/quicktime', filename: 'ACADEMIA.mov', bytes: 30 * MB })
    expect(r?.level).toBe('blocking')
    expect(r?.consequence).toContain('Android')
  })

  it('.mov pela extensão também pega, mesmo sem mime', () => {
    // A coluna mime_type nasceu depois de parte dos registros.
    const r = riskBeforeSending({ filename: 'ACADEMIA NAZARE [CG17].mov' })
    expect(r?.level).toBe('blocking')
  })

  it('arquivo de projeto é bloqueante e diz que é de edição', () => {
    const r = riskBeforeSending({ filename: 'campanha.psd', bytes: 10 * MB })
    expect(r?.level).toBe('blocking')
    expect(r?.remedy).toContain('Exporte')
  })

  it('formato vence peso — um .mov leve precisa reexportar de qualquer jeito', () => {
    // Mostrar os dois avisos juntos diluiria o que importa.
    const r = riskBeforeSending({ mimeType: 'video/quicktime', filename: 'a.mov', bytes: 500 * MB })
    expect(r?.title).toContain('.mov')
  })

  it('acima de 600 MB avisa que fica fora do espelho', () => {
    const r = riskBeforeSending({ mimeType: 'video/mp4', filename: 'a.mp4', bytes: 700 * MB })
    expect(r?.level).toBe('blocking')
    expect(r?.consequence).toContain('espelh')
  })

  it('pesado é aviso, não bloqueio — quem já faz certo num vídeo longo não pode ser punido', () => {
    const r = riskBeforeSending({ mimeType: 'video/mp4', filename: 'a.mp4', bytes: 91 * MB })
    expect(r?.level).toBe('warning')
  })

  it('imagem comum não é pesada nunca', () => {
    expect(riskBeforeSending({ mimeType: 'image/jpeg', filename: 'post.jpg', bytes: 90 * MB })).toBeNull()
  })

  it('HEIC é bloqueante — não abre em boa parte dos Android', () => {
    const r = riskBeforeSending({ mimeType: 'image/heic', filename: 'foto.heic' })
    expect(r?.level).toBe('blocking')
  })

  it('sem dado nenhum, silêncio — chutar treinaria a equipe a ignorar', () => {
    expect(riskBeforeSending({})).toBeNull()
  })

  it('tamanho ausente não inventa peso', () => {
    expect(riskBeforeSending({ mimeType: 'video/mp4', filename: 'a.mp4' })).toBeNull()
  })
})

describe('card sem criativo — o erro mais bobo e o mais caro', () => {
  it('bloqueia o envio quando não há nada anexado', () => {
    const r = riskBeforeSending({ semCriativo: true })
    expect(r?.level).toBe('blocking')
    expect(r?.title).toMatch(/não tem criativo/i)
  })

  it('não inventa risco quando há criativo e nada mais se sabe', () => {
    expect(riskBeforeSending({ semCriativo: false })).toBeNull()
  })

  it('a falta de criativo vem ANTES do formato: não adianta falar de .mov num card vazio', () => {
    const r = riskBeforeSending({ semCriativo: true, filename: 'a.mov', mimeType: 'video/quicktime' })
    expect(r?.title).toMatch(/não tem criativo/i)
  })
})
