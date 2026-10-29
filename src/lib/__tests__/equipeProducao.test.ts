import { describe, it, expect } from 'vitest'
import {
  aplicarNasGavetas, chaveDoEncarregado, chavesDoGrupo, criarEncarregado, editarEncarregado,
  encarregadoDoPerfil, encarregadosDaFuncao, idGaveta, montarDoQueExiste, nomeDoResponsavel,
  removerEncarregado, salvarGrupo, type EquipeStore,
} from '../equipeProducao'
import { donoDoCard } from '../access'
import { paineisDaArea, type PaineisStore } from '../paineis'

const T = 1_000
const gavetasHoje: PaineisStore = {
  semeado: { vid: true, des: true },
  paineis: [
    { id: 'pn_k', area: 'vid', nome: 'Kaique', cor: '#a', membro: 'kaique', ordem: 0, criadoEm: 1 },
    { id: 'pn_e2', area: 'vid', nome: 'Editor 2', cor: '#b', ordem: 1, criadoEm: 1 },
    { id: 'pn_j', area: 'des', nome: 'Jhones', cor: '#c', membro: 'jhones', ordem: 0, criadoEm: 1 },
    { id: 'pn_free', area: 'des', nome: 'Freela Ana', cor: '#d', ordem: 1, criadoEm: 1 },
  ],
}
const atribHoje = { 10: 'pn_k', 11: 'pn_j', 12: 'pn_free' }

describe('estreia do cadastro: nasce do que já existe', () => {
  const eq = montarDoQueExiste(gavetasHoje, atribHoje, T)

  it('adota as gavetas pelo id — nenhum card muda de dono', () => {
    const depois = aplicarNasGavetas(eq, gavetasHoje)
    for (const [card, gaveta] of Object.entries(atribHoje)) {
      expect(donoDoCard(Number(card), undefined, atribHoje, depois)).toBe(donoDoCard(Number(card), undefined, atribHoje, gavetasHoje) ?? depois.paineis.find(p => p.id === gaveta)?.membro)
    }
    expect(donoDoCard(10, undefined, atribHoje, depois)).toBe('kaique')
    expect(donoDoCard(11, undefined, atribHoje, depois)).toBe('jhones')
  })
  it('gaveta genérica vazia não vira gente; a do freela com card vira (sem perfil)', () => {
    const nomes = Object.values(eq.encarregados).map(e => e.nome)
    expect(nomes).not.toContain('Editor 2')
    const ana = Object.values(eq.encarregados).find(e => e.nome === 'Freela Ana')!
    expect(ana.perfil).toBeUndefined()
    expect(ana.funcoes).toEqual(['design'])
  })
  it('o time do código entra com a função do cargo (Emanuelly editora, Arthur social)', () => {
    expect(encarregadoDoPerfil(eq, 'emanuelly')?.funcoes).toContain('editor')
    expect(encarregadoDoPerfil(eq, 'arthur')?.funcoes).toContain('social')
  })
  it('painéis padrão Edição e Design com quem tem a função', () => {
    const ed = chavesDoGrupo(eq, eq.grupos.edicao)
    expect(ed.has('kaique') && ed.has('emanuelly')).toBe(true)
    expect(chavesDoGrupo(eq, eq.grupos.design).has('jhones')).toBe(true)
  })
})

describe('editar pelo painel', () => {
  const base = montarDoQueExiste(gavetasHoje, atribHoje, T)

  it('pessoa nova como Editor + Designer aparece nas DUAS áreas, com id fixo', () => {
    const { eq, id } = criarEncarregado(base, { nome: 'Bia', funcoes: ['editor', 'design'], ativo: true, grupos: ['edicao'] }, T)
    const g = aplicarNasGavetas(eq, gavetasHoje)
    expect(paineisDaArea(g, 'vid').some(p => p.id === idGaveta('vid', id))).toBe(true)
    expect(paineisDaArea(g, 'des').some(p => p.id === idGaveta('des', id))).toBe(true)
    expect(encarregadosDaFuncao(eq, 'editor').map(e => e.nome)).toContain('Bia')
    expect(eq.grupos.edicao.membros).toContain(id)
    // Sem perfil, a chave do card nunca é um login.
    expect(chaveDoEncarregado(eq.encarregados[id])).toBe(`enc_${id}`)
    expect(nomeDoResponsavel(eq, `enc_${id}`)).toBe('Bia')
    // Determinístico: aplicar de novo não muda nada.
    expect(aplicarNasGavetas(eq, g)).toBe(g)
  })
  it('vincular o perfil depois: os cards da gaveta passam a ser do perfil (esteira dele)', () => {
    const { eq, id } = criarEncarregado(base, { nome: 'Bia', funcoes: ['design'], ativo: true, grupos: [] }, T)
    const atrib = { 50: idGaveta('des', id) }
    expect(donoDoCard(50, undefined, atrib, aplicarNasGavetas(eq, gavetasHoje))).toBe(`enc_${id}`)
    const comPerfil = editarEncarregado(eq, id, { nome: 'Bia', funcoes: ['design'], perfil: 'julio', ativo: true, grupos: [] }, T)
    expect(donoDoCard(50, undefined, atrib, aplicarNasGavetas(comPerfil, gavetasHoje))).toBe('julio')
  })
  it('desativar: some das escolhas, os cards continuam dele', () => {
    const k = encarregadoDoPerfil(base, 'kaique')!
    const off = editarEncarregado(base, k.id, { nome: k.nome, funcoes: k.funcoes, perfil: 'kaique', ativo: false, grupos: [] }, T)
    const g = aplicarNasGavetas(off, gavetasHoje)
    expect(paineisDaArea(g, 'vid').some(p => p.id === 'pn_k')).toBe(false)
    expect(donoDoCard(10, undefined, atribHoje, g)).toBe('kaique')
    expect(chavesDoGrupo(off, off.grupos.edicao).has('kaique')).toBe(false)
  })
  it('trocar a função: tirar Editor desativa a gaveta de Vídeo', () => {
    const k = encarregadoDoPerfil(base, 'kaique')!
    const so = editarEncarregado(base, k.id, { nome: k.nome, funcoes: ['design'], perfil: 'kaique', ativo: true, grupos: [] }, T)
    const g = aplicarNasGavetas(so, gavetasHoje)
    expect(g.paineis.find(p => p.id === 'pn_k')?.inativa).toBe(true)
    expect(paineisDaArea(g, 'des').some(p => p.membro === 'kaique')).toBe(true)
  })
  it('painel personalizado com quem eu escolher; apagar a pessoa tira dos painéis', () => {
    const { eq, id } = criarEncarregado(base, { nome: 'Bia', funcoes: ['design'], ativo: true, grupos: [] }, T)
    const k = encarregadoDoPerfil(eq, 'kaique')!
    const comGrupo: EquipeStore = salvarGrupo(eq, { id: 'meu', nome: 'Especial', membros: [k.id, id] }, T)
    expect([...chavesDoGrupo(comGrupo, comGrupo.grupos.meu)]).toEqual(['kaique', `enc_${id}`])
    const sem = removerEncarregado(comGrupo, id)
    expect(sem.grupos.meu.membros).toEqual([k.id])
  })
})
