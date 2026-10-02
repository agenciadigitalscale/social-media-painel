import { describe, expect, it } from 'vitest'
import { linkDoMaterial, normalizarLinkMaterial } from '../linkMaterial'
import { AVISO_24H, mensagemDeAprovacao } from '../whatsapp'
import { normalizarHora } from '../programacao'
import type { ItemState } from '../../types'

describe('normalizarLinkMaterial', () => {
  it('aceita link completo', () => {
    expect(normalizarLinkMaterial(' https://drive.google.com/file/d/abc/view ')).toBe('https://drive.google.com/file/d/abc/view')
  })
  it('completa o protocolo de link colado sem ele', () => {
    expect(normalizarLinkMaterial('drive.google.com/file/d/abc')).toBe('https://drive.google.com/file/d/abc')
  })
  it('recusa texto que não é link', () => {
    expect(normalizarLinkMaterial('video final')).toBeNull()
    expect(normalizarLinkMaterial('abc')).toBeNull()
    expect(normalizarLinkMaterial('')).toBeNull()
  })
})

describe('tráfego pago na mensagem', () => {
  it('avisa quando é tráfego pago', () => {
    const msg = mensagemDeAprovacao('Lorenzeti', [{ titulo: 'Chuveiro', link: 'https://x.com/a' }], true)
    expect(msg).toContain('tráfego pago')
    expect(msg).toContain('*Chuveiro*')
    expect(msg.endsWith(AVISO_24H)).toBe(true)
  })
})

describe('linkDoMaterial — fonte única do link', () => {
  const st = (x: Partial<ItemState>) => ({ status: 3, ...x }) as ItemState
  it('usa o link do material', () => {
    expect(linkDoMaterial(st({ linkMaterial: 'https://drive.google.com/file/d/a/view' }))).toBe('https://drive.google.com/file/d/a/view')
  })
  it('card antigo sem linkMaterial: o link que já existia não some', () => {
    expect(linkDoMaterial(st({ link: 'https://drive.google.com/file/d/legado/view' }))).toBe('https://drive.google.com/file/d/legado/view')
  })
  it('linkMaterial manda sobre o legado, inclusive quando removido (vazio)', () => {
    expect(linkDoMaterial(st({ linkMaterial: 'https://novo.com/x', link: 'https://velho.com/y' }))).toBe('https://novo.com/x')
    expect(linkDoMaterial(st({ linkMaterial: '', link: 'https://velho.com/y' }))).toBe('')
  })
  it('nome de arquivo nunca vira link', () => {
    expect(linkDoMaterial(st({ linkMaterial: "Frango d'Água - uma indicação em atibaia [K5SY].mp4" }))).toBe('')
    expect(linkDoMaterial(st({ link: 'Frango - video [K5SY].mp4' }))).toBe('')
  })
  it('sem estado, sem link', () => {
    expect(linkDoMaterial(undefined)).toBe('')
  })
})

describe('mensagem de aprovação (padrão 2026-10-02)', () => {
  it('um conteúdo: texto padrão, link e aviso de 24h no fim', () => {
    const msg = mensagemDeAprovacao("Frango d'Água", [{ titulo: 'Uma indicação em Atibaia', link: 'https://drive.google.com/file/d/x/view' }])
    expect(msg).toBe(
      "Olá, Frango d'Água! 😊\n\n*Uma indicação em Atibaia* está pronto para aprovação.\n\n" +
      'Visualize e nos dê seu feedback pelo link:\nhttps://drive.google.com/file/d/x/view\n\n' +
      'No link você também pode baixar o arquivo em alta qualidade.\n\nAguardamos seu retorno! 🙏\n\n' + AVISO_24H,
    )
    expect(msg.endsWith('seguirá normalmente para a próxima etapa.')).toBe(true)
  })
  it('vários conteúdos: cada um com o seu link, mesmo rodapé', () => {
    const msg = mensagemDeAprovacao('Lareiras', [{ titulo: 'A', link: 'https://a.com/1' }, { titulo: 'B', link: 'https://b.com/2' }])
    expect(msg).toContain('2 conteúdos estão prontos para aprovação')
    expect(msg).toContain('• *A*\nhttps://a.com/1')
    expect(msg).toContain('• *B*\nhttps://b.com/2')
    expect(msg.endsWith(AVISO_24H)).toBe(true)
  })
})

describe('normalizarHora', () => {
  it.each([
    ['1437', '14:37'], ['14:37', '14:37'], ['9', '09:00'], ['930', '09:30'],
    ['9:5', '09:05'], ['14h30', '14:30'], ['14h', '14:00'], ['0', '00:00'],
  ])('%s → %s', (entrada, saida) => {
    expect(normalizarHora(entrada)).toBe(saida)
  })
  it.each(['24', '2460', '12345', 'abc', '', '14:3x'])('recusa %s', entrada => {
    expect(normalizarHora(entrada)).toBeNull()
  })
})
