import { describe, it, expect } from 'vitest'
import { designerFixo } from '../designerFixo'

describe('designerFixo', () => {
  it('Fenix, Aventur e Kátia: arte vai para o Julio', () => {
    expect(designerFixo('MARINA FENIX', 'Post')).toBe('julio')
    expect(designerFixo('Aventur', 'Feed')).toBe('julio')
    expect(designerFixo('Kátia Bigatello', 'Carrossel')).toBe('julio')
    expect(designerFixo('Katia Bigatello', 'Story')).toBe('julio')
  })
  it('vídeo não entra na regra', () => {
    expect(designerFixo('Aventur', 'Reel')).toBeNull()
  })
  it('outros clientes ficam como estão', () => {
    expect(designerFixo('Lorenzeti', 'Post')).toBeNull()
  })
})
