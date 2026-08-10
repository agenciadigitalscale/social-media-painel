import { describe, expect, it } from 'vitest'
import { clientVerdict, findSimilarClient } from '../clientFolders'

/** Os 17 do calendário, como estão no `data.ts`. */
const CADASTRADOS = [
  'Casa de Ração 2 Irmãos', 'Chalés Alto da Represa', "Frango d'Água",
  'Hidro Elétrica Andrade', 'Home Elevadores', 'Kátia Bigatello',
  'Lareiras Grill', 'Luthita', 'LuzioPan', 'Magia dos Temáticos',
  'Padaria R.A', 'Pousada Dukuka', 'Quero Bolo', 'ViniPlas',
  'Rosângela Varas', 'Compostela', 'Suh Maya',
]

describe('findSimilarClient — os nomes de pasta que são pedaço do cliente', () => {
  it('"Alto da Represa" é a mesma coisa que "Chalés Alto da Represa"', () => {
    // Caso real: 3 arquivos parados por causa disso.
    expect(findSimilarClient('Alto da Represa', CADASTRADOS)).toBe('Chalés Alto da Represa')
  })

  it('"Fazendinha Frango D\'agua" aponta para "Frango d\'Água"', () => {
    // Caso real: 8 arquivos. Acento e apóstrofo já eram resolvidos; o problema
    // é o nome ser SUPERSTRING do cadastrado.
    expect(findSimilarClient("Fazendinha Frango D'agua", CADASTRADOS)).toBe("Frango d'Água")
  })

  it('cliente de verdade desconhecido não ganha sugestão inventada', () => {
    expect(findSimilarClient('MARINA FENIX', CADASTRADOS)).toBeUndefined()
    expect(findSimilarClient('HOPESTEEL', CADASTRADOS)).toBeUndefined()
    expect(findSimilarClient('LZ ARENA', CADASTRADOS)).toBeUndefined()
  })

  it('nome curto não casa com meio mundo', () => {
    // "RA" acharia "Padaria R.A" e "Casa de Ração" — sugestão errada é pior
    // que nenhuma, porque vira vínculo de criativo no cliente errado.
    expect(findSimilarClient('RA', CADASTRADOS)).toBeUndefined()
    expect(findSimilarClient('a', CADASTRADOS)).toBeUndefined()
  })

  it('nome idêntico não é "parecido" — é o próprio', () => {
    expect(findSimilarClient('Luthita', CADASTRADOS)).toBeUndefined()
  })
})

describe('clientVerdict — três situações, três ações', () => {
  const comCards = new Set(['Luthita', 'Lareiras Grill'])

  it('cadastrado e com card: não diz nada', () => {
    expect(clientVerdict('Luthita', CADASTRADOS, comCards).status).toBe('ok')
  })

  it('cadastrado sem card em produção → criar o card', () => {
    const v = clientVerdict('Compostela', CADASTRADOS, comCards)
    expect(v.status).toBe('no_cards')
    expect(v.hint).toContain('Crie o card')
  })

  it('não cadastrado → cadastrar o cliente, não esperar card aparecer', () => {
    // A mensagem antiga ("Nenhum item em produção para MARINA FENIX") sugeria
    // esperar. Nunca ia aparecer card nenhum.
    const v = clientVerdict('MARINA FENIX', CADASTRADOS, comCards)
    expect(v.status).toBe('unregistered')
    expect(v.similarTo).toBeUndefined()
    expect(v.message).toContain('não é um cliente cadastrado')
    expect(v.hint).toContain('Cadastre o cliente')
  })

  it('pasta com nome divergente aponta o cliente certo', () => {
    const v = clientVerdict('Alto da Represa', CADASTRADOS, comCards)
    expect(v.status).toBe('unregistered')
    expect(v.similarTo).toBe('Chalés Alto da Represa')
    expect(v.message).toContain('Chalés Alto da Represa')
    expect(v.hint).toContain('renomeie')
  })

  it('acento e pontuação não separam o mesmo cliente', () => {
    // O `normalizeClientName` já resolvia isso; o teste trava a regressão.
    expect(clientVerdict('Frango dAgua', CADASTRADOS, new Set(['Frango dAgua'])).status).toBe('ok')
    expect(clientVerdict('PADARIA R.A', CADASTRADOS, new Set(['PADARIA R.A'])).status).toBe('ok')
  })
})
