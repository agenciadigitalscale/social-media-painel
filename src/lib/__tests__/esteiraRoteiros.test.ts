import { describe, it, expect } from 'vitest'
import {
  garantirCardDoCliente, criarCard, moverCard, arquivarCard, restaurarCard, excluirCard,
  cardsDaTela, jaTemCard, linkValido, ehFreelancer, quantidadeValida, editarCard, preencherMes, idAutomatico, preencherMeses, arquivarDeRemovidos, type EsteiraStore,
} from '../esteiraRoteiros'

const T = 1_790_000_000_000
const nome = (id: string) => ({ Compostela: 'Compostela Grill' } as Record<string, string>)[id] ?? id
const tipoCli = (id: string) => (id === 'Kátia' ? 'freelancer' : 'mensal') as 'mensal' | 'freelancer'

describe('esteira de roteiros do mês', () => {
  it('cliente novo entra sozinho em "A fazer" — e não duplica no mesmo mês', () => {
    let s: EsteiraStore = {}
    s = garantirCardDoCliente(s, 'Compostela', '2026-10', T)
    const de1 = s
    s = garantirCardDoCliente(s, 'Compostela', '2026-10', T + 1)
    expect(s).toBe(de1)
    const [c] = Object.values(s)
    expect(c).toMatchObject({ tipo: 'fixo', origem: 'automatico', status: 'a_fazer', responsavel: 'kerges', mes: '2026-10' })
    // outro mês: card novo
    s = garantirCardDoCliente(s, 'Compostela', '2026-11', T + 2)
    expect(Object.keys(s)).toHaveLength(2)
  })

  it('arquivado também conta como "já tem" — arquivar não faz o automático recriar', () => {
    let s = garantirCardDoCliente({}, 'Aventur', '2026-10', T)
    const id = Object.keys(s)[0]
    s = arquivarCard(s, id, T + 1)
    expect(jaTemCard(s, 'Aventur', '2026-10')).toBe(true)
  })

  it('freelancer manual: nome livre, nasce em "A fazer"', () => {
    const { store, id } = criarCard({}, { tipo: 'freelancer', nomeLivre: '  Festival Bentinho ', mes: '2026-10', prazo: '2026-10-25' }, T)
    expect(store[id]).toMatchObject({ tipo: 'freelancer', origem: 'manual', nomeLivre: 'Festival Bentinho', status: 'a_fazer', prazo: '2026-10-25' })
  })

  it('ir para Prontos carimba a data; voltar tira', () => {
    const { store, id } = criarCard({}, { tipo: 'fixo', clienteId: 'Aventur', mes: '2026-10' }, T)
    const pronto = moverCard(store, id, 'pronto', T + 5000)
    expect(pronto[id]).toMatchObject({ status: 'pronto', prontoEm: T + 5000 })
    const volta = moverCard(pronto, id, 'a_fazer', T + 9000)
    expect(volta[id].status).toBe('a_fazer')
    expect(volta[id].prontoEm).toBeUndefined()
  })

  it('arquivar guarda de onde veio e restaurar devolve para lá', () => {
    const { store, id } = criarCard({}, { tipo: 'fixo', clienteId: 'Aventur', mes: '2026-10' }, T)
    const s = arquivarCard(moverCard(store, id, 'pronto', T + 1), id, T + 2)
    expect(s[id].status).toBe('arquivado')
    expect(restaurarCard(s, id, T + 3)[id].status).toBe('pronto')
  })

  it('excluir só apaga card manual; o automático fica', () => {
    const auto = garantirCardDoCliente({}, 'Aventur', '2026-10', T)
    const idAuto = Object.keys(auto)[0]
    expect(excluirCard(auto, idAuto)).toBe(auto)
    const { store, id } = criarCard(auto, { tipo: 'freelancer', nomeLivre: 'Job', mes: '2026-10' }, T)
    expect(excluirCard(store, id)[id]).toBeUndefined()
  })

  it('tela: mês, tipo, busca pelo nome de exibição, arquivados à parte', () => {
    let s = garantirCardDoCliente({}, 'Compostela', '2026-10', T)
    s = garantirCardDoCliente(s, 'Kátia', '2026-10', T)
    s = criarCard(s, { tipo: 'freelancer', nomeLivre: 'Festival', mes: '2026-10' }, T).store
    s = garantirCardDoCliente(s, 'Aventur', '2026-09', T)
    const base = { mes: '2026-10', tipo: 'todos' as const, busca: '', arquivados: false }
    expect(cardsDaTela(s, base, nome, tipoCli)).toHaveLength(3)
    expect(cardsDaTela(s, { ...base, tipo: 'fixos' }, nome, tipoCli).map(c => c.clienteId)).toEqual(['Compostela'])
    expect(cardsDaTela(s, { ...base, tipo: 'freelancer' }, nome, tipoCli)).toHaveLength(2)
    expect(cardsDaTela(s, { ...base, busca: 'grill' }, nome, tipoCli).map(c => c.clienteId)).toEqual(['Compostela'])
  })

  it('link precisa ser endereço completo; freelancer da carteira conta como freelancer', () => {
    expect(linkValido('https://docs.google.com/document/d/1')).toBe(true)
    expect(linkValido('docs.google.com/x')).toBe(false)
    const s = garantirCardDoCliente({}, 'Kátia', '2026-10', T)
    expect(ehFreelancer(Object.values(s)[0], tipoCli)).toBe(true)
  })

  it('quantidade de roteiros: guarda na criação e na edição; inválida não entra', () => {
    const { store, id } = criarCard({}, { tipo: 'fixo', clienteId: 'Aventur', mes: '2026-10', quantidade: 8 }, T)
    expect(store[id].quantidade).toBe(8)
    expect(editarCard(store, id, { quantidade: 12 }, T + 1)[id].quantidade).toBe(12)
    expect(criarCard({}, { tipo: 'fixo', clienteId: 'Aventur', mes: '2026-10', quantidade: 0 }, T).store).not.toHaveProperty('x')
    expect(quantidadeValida(0)).toBe(false)
    expect(quantidadeValida(2.5)).toBe(false)
    expect(quantidadeValida(8)).toBe(true)
  })

  it('virada do mês: todo mensal ativo entra em "A fazer"; quem saiu, quem ainda não entrou e freelancer não', () => {
    const carteira = {
      Aventur: { tipo: 'mensal' as const },
      Moreira: { tipo: 'mensal' as const, saida: '2026-11' },
      Novo: { tipo: 'mensal' as const, entrada: '2026-12' },
      Kátia: { tipo: 'freelancer' as const },
    }
    const ids = ['Aventur', 'Moreira', 'Novo', 'Kátia', 'SemCadastro']
    const s = preencherMes({}, ids, carteira, 2026, 10, T) // novembro
    expect(Object.values(s).map(c => c.clienteId).sort()).toEqual(['Aventur', 'SemCadastro'])
    expect(Object.values(s).every(c => c.status === 'a_fazer' && c.mes === '2026-11')).toBe(true)
  })

  it('rodar de novo não duplica; card arquivado não volta', () => {
    const carteira = { Aventur: { tipo: 'mensal' as const } }
    let s = preencherMes({}, ['Aventur'], carteira, 2026, 10, T)
    s = arquivarCard(s, idAutomatico('Aventur', '2026-11'), T + 1)
    const de2 = preencherMes(s, ['Aventur'], carteira, 2026, 10, T + 2)
    expect(de2).toBe(s)
  })

  it('dois aparelhos criando ao mesmo tempo geram o MESMO card (id fixo cliente + mês)', () => {
    const a = garantirCardDoCliente({}, 'Aventur', '2026-11', T)
    const b = garantirCardDoCliente({}, 'Aventur', '2026-11', T + 999)
    expect(Object.keys(a)).toEqual(Object.keys(b))
    expect(Object.keys({ ...a, ...b })).toHaveLength(1)
  })

  it('meses seguintes: o atual e os próximos já nascem com todos os mensais ativos', () => {
    const carteira = { Aventur: { tipo: 'mensal' as const }, Sai: { tipo: 'mensal' as const, saida: '2026-11' } }
    const s = preencherMeses({}, ['Aventur', 'Sai'], carteira, new Date(2026, 9, 23), 3, T)
    const porMes = (m: string) => Object.values(s).filter(c => c.mes === m).map(c => c.clienteId).sort()
    expect(porMes('2026-10')).toEqual(['Aventur', 'Sai'])
    expect(porMes('2026-11')).toEqual(['Aventur'])
    expect(porMes('2026-12')).toEqual(['Aventur'])
  })

  it('cliente removido: os cards dele do mês de saída em diante vão para Arquivados (até os prontos)', () => {
    let s = preencherMes({}, ['Mega', 'Aventur'], {}, 2026, 9, T)
    s = moverCard(s, idAutomatico('Mega', '2026-10'), 'pronto', T + 1)
    const carteira = { Mega: { tipo: 'mensal' as const, saida: '2026-10' } }
    const r = arquivarDeRemovidos(s, ['Mega', 'Aventur'], carteira, T + 2)
    expect(r[idAutomatico('Mega', '2026-10')]).toMatchObject({ status: 'arquivado', statusAntes: 'pronto', arquivadoPorRemocao: true })
    expect(r[idAutomatico('Aventur', '2026-10')].status).toBe('a_fazer')
  })

  it('cliente que voltou: os cards arquivados pela remoção voltam sozinhos; o arquivado à mão não', () => {
    let s = preencherMes({}, ['Mega', 'Aventur'], {}, 2026, 9, T)
    s = arquivarCard(s, idAutomatico('Aventur', '2026-10'), T + 1) // à mão
    s = arquivarDeRemovidos(s, ['Mega', 'Aventur'], { Mega: { tipo: 'mensal' as const, saida: '2026-10' } }, T + 2)
    const volta = arquivarDeRemovidos(s, ['Mega', 'Aventur'], {}, T + 3)
    expect(volta[idAutomatico('Mega', '2026-10')].status).toBe('a_fazer')
    expect(volta[idAutomatico('Aventur', '2026-10')].status).toBe('arquivado')
  })

  it('cliente que saiu do cadastro (oculto/arquivado) também arquiva; freelancer avulso nunca', () => {
    let s = preencherMes({}, ['Sumiu'], {}, 2026, 9, T)
    s = criarCard(s, { tipo: 'freelancer', nomeLivre: 'Job', mes: '2026-10' }, T).store
    const r = arquivarDeRemovidos(s, [], {}, T + 1)
    expect(r[idAutomatico('Sumiu', '2026-10')].status).toBe('arquivado')
    expect(Object.values(r).find(c => c.tipo === 'freelancer')!.status).toBe('a_fazer')
  })

  it('nada a mudar: devolve o mesmo store (não regrava à toa)', () => {
    const s = preencherMes({}, ['Aventur'], {}, 2026, 9, T)
    expect(arquivarDeRemovidos(s, ['Aventur'], {}, T + 1)).toBe(s)
  })
})
