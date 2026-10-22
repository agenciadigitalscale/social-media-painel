import { describe, it, expect } from 'vitest'
import { separarUltimas } from '../ig-publish'

describe('última postagem do perfil (vídeo e foto)', () => {
  it('pega o vídeo mais novo e a foto mais nova, mesmo fora de ordem', () => {
    const r = separarUltimas([
      { id: '1', media_type: 'IMAGE', timestamp: '2026-10-10T12:00:00+0000', permalink: 'p1', media_url: 'm1' },
      { id: '2', media_type: 'VIDEO', media_product_type: 'REELS', timestamp: '2026-10-18T12:00:00+0000', permalink: 'p2', thumbnail_url: 't2' },
      { id: '3', media_type: 'CAROUSEL_ALBUM', timestamp: '2026-10-15T12:00:00+0000', permalink: 'p3', media_url: 'm3' },
      { id: '4', media_type: 'VIDEO', media_product_type: 'REELS', timestamp: '2026-10-01T12:00:00+0000' },
    ])
    expect(r.video).toEqual({ quando: '2026-10-18T12:00:00+0000', link: 'p2', capa: 't2', formato: 'reel' })
    expect(r.foto).toEqual({ quando: '2026-10-15T12:00:00+0000', link: 'p3', capa: 'm3', formato: 'carrossel' })
  })

  it('perfil só com fotos: vídeo fica vazio (é o aviso)', () => {
    const r = separarUltimas([{ id: '1', media_type: 'IMAGE', timestamp: '2026-10-10T12:00:00+0000' }])
    expect(r.video).toBeNull()
    expect(r.foto?.formato).toBe('foto')
  })

  it('perfil vazio', () => {
    expect(separarUltimas([])).toEqual({ video: null, foto: null })
  })
})
