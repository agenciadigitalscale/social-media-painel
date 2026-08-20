import { describe, it, expect } from 'vitest'
import { contentDisposition } from '../stream'

describe('contentDisposition — assistir x baixar', () => {
  it('sem download pedido, continua inline', () => {
    // O padrão importa: `attachment` faz o navegador largar o player, que foi
    // o bug de tela preta no caminho público do Drive.
    expect(contentDisposition(false, 'Lorenzeti - Vídeo.mp4')).toBe('inline')
  })

  it('download sem nome conhecido ainda funciona', () => {
    expect(contentDisposition(true, null)).toBe('attachment')
  })

  it('preserva espaço e hífen — é o formato de nome que a equipe usa', () => {
    const out = contentDisposition(true, 'Lorenzeti - Video Chuveiro.mp4')
    expect(out).toContain('filename="Lorenzeti - Video Chuveiro.mp4"')
  })

  it('acento sobrevive no filename* e vira _ no fallback ASCII', () => {
    const out = contentDisposition(true, 'Vídeo Ação.mp4')
    expect(out).toContain('filename="V_deo A__o.mp4"')
    expect(out).toContain("filename*=UTF-8''")
    expect(out).toContain(encodeURIComponent('Vídeo Ação.mp4'))
  })

  it('CR/LF no nome NÃO consegue injetar outro cabeçalho', () => {
    // O nome vem do Drive, onde qualquer um da equipe digita o que quiser.
    //
    // O que precisa ser verdade é UMA coisa: nenhuma quebra de linha sobrevive.
    // Sem elas o texto restante fica preso dentro das aspas do filename — vira
    // um nome de arquivo feio, não um cabeçalho novo. Exigir que o texto suma
    // seria testar estética e deixaria passar o caso que importa.
    const out = contentDisposition(true, 'a.mp4\r\nX-Injetado: sim')
    expect(out).not.toContain('\r')
    expect(out).not.toContain('\n')
    expect(out.split('\n')).toHaveLength(1)
    // e o resto ficou contido no valor entre aspas
    expect(out).toMatch(/^attachment; filename="[^"]*"; filename\*=UTF-8''\S*$/)
  })

  it('aspas no nome não quebram o cabeçalho', () => {
    const out = contentDisposition(true, 'o "melhor" reel.mp4')
    expect(out).toBe(`attachment; filename="o melhor reel.mp4"; filename*=UTF-8''${encodeURIComponent('o melhor reel.mp4')}`)
  })

  it('nome que vira vazio depois da limpeza cai no genérico', () => {
    expect(contentDisposition(true, '"""')).toBe('attachment')
  })

  it('nome absurdamente longo é truncado', () => {
    const out = contentDisposition(true, 'x'.repeat(500) + '.mp4')
    const m = out.match(/filename="([^"]*)"/)
    expect(m?.[1].length).toBeLessThanOrEqual(120)
  })
})
