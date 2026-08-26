/* lib/pesq/usePesq.ts — Estado da Central de Publicações PESQ.
   Guarda a lista, a configuração e o relógio; expõe ações já persistidas.
   Regra continua no `publicacoes.ts` — aqui só orquestra.
*/

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  cancelarPublicacao, carregarConfig, carregarPublicacoes, confirmarPublicacao, criarPublicacao,
  editarPublicacao, filaDeLembretes, pausarPublicacao, proximoLembreteEm, reabrirPublicacao,
  registrarLembrete, resumo, retomarPublicacao, salvarConfig, salvarPublicacoes, tipoDoProximoLembrete,
  type NovaPublicacao, type PesqConfig, type PesqPublicacao, type PesqResumo,
} from './publicacoes'
import { enviarPeloWhatsapp, montarMensagem, type EnvioResultado } from './mensagens'

export interface PesqApi {
  pubs: PesqPublicacao[]
  config: PesqConfig
  agora: number
  carregando: boolean
  resumo: PesqResumo
  fila: PesqPublicacao[]
  criar: (input: NovaPublicacao) => PesqPublicacao
  editar: (id: string, patch: Partial<NovaPublicacao>) => void
  confirmar: (id: string) => void
  pausar: (id: string) => void
  retomar: (id: string) => void
  cancelar: (id: string) => void
  reabrir: (id: string) => void
  remover: (id: string) => void
  /** Abre o WhatsApp com o texto pronto e registra o resultado no card. */
  enviarLembrete: (id: string) => Promise<EnvioResultado>
  salvarConfiguracao: (c: PesqConfig) => void
}

export function usePesq(autor: string, syncVersion = 0, restaurando = false): PesqApi {
  const [pubs, setPubs] = useState<PesqPublicacao[]>([])
  const [config, setConfig] = useState<PesqConfig>(() => carregarConfig())
  const [carregando, setCarregando] = useState(true)
  const [agora, setAgora] = useState(() => Date.now())

  // Leitura inicial e re-leitura quando o App restaura o D1 (outro aparelho,
  // cache limpo). Sem o `syncVersion` a tela ficaria mostrando a lista vazia
  // que existia antes do sync chegar.
  useEffect(() => {
    setPubs(carregarPublicacoes())
    setConfig(carregarConfig())
    setCarregando(false)
  }, [syncVersion])

  const resumoAtual = useMemo(() => resumo(pubs, agora), [pubs, agora])
  const fila        = useMemo(() => filaDeLembretes(pubs, agora), [pubs, agora])

  /**
   * O relógio acelera para 1s quando existe contagem regressiva curta na tela
   * e cai para 15s quando não existe: a contagem precisa de segundo, o resto
   * não, e re-renderizar a lista inteira a cada segundo por nada é imposto de
   * bateria no celular de quem está em campo. `perto` é booleano de propósito
   * — o efeito só se reprograma quando o modo vira, não a cada tique.
   */
  const proximoEm = fila.length ? proximoLembreteEm(fila[0], agora) : null
  const perto = proximoEm !== null && proximoEm - agora < 120_000

  useEffect(() => {
    const id = setInterval(() => setAgora(Date.now()), perto ? 1000 : 15_000)
    return () => clearInterval(id)
  }, [perto])

  const gravar = useCallback((next: PesqPublicacao[]) => {
    setPubs(next)
    salvarPublicacoes(next)
  }, [])

  const aplicar = useCallback((id: string, fn: (p: PesqPublicacao) => PesqPublicacao) => {
    setPubs(prev => {
      const next = prev.map(p => (p.id === id ? fn(p) : p))
      salvarPublicacoes(next)
      return next
    })
  }, [])

  const criar = useCallback((input: NovaPublicacao) => {
    const nova = criarPublicacao(input, config, pubs, autor)
    gravar([nova, ...pubs])
    return nova
  }, [autor, config, gravar, pubs])

  const enviarLembrete = useCallback(async (id: string): Promise<EnvioResultado> => {
    const pub = pubs.find(p => p.id === id)
    if (!pub) return { ok: false, erro: 'Publicação não encontrada.' }
    const tipo = tipoDoProximoLembrete(pub)
    const resultado = await enviarPeloWhatsapp(config.destino, montarMensagem(pub, config, tipo))
    aplicar(id, p => registrarLembrete(p, { ok: resultado.ok, tipo, erro: resultado.erro }, autor))
    return resultado
  }, [aplicar, autor, config, pubs])

  return {
    pubs,
    config,
    agora,
    carregando: carregando || restaurando,
    resumo: resumoAtual,
    fila,
    criar,
    editar:    useCallback((id, patch) => aplicar(id, p => editarPublicacao(p, patch, autor)), [aplicar, autor]),
    confirmar: useCallback(id => aplicar(id, p => confirmarPublicacao(p, autor)), [aplicar, autor]),
    pausar:    useCallback(id => aplicar(id, p => pausarPublicacao(p, autor)), [aplicar, autor]),
    retomar:   useCallback(id => aplicar(id, p => retomarPublicacao(p, autor)), [aplicar, autor]),
    cancelar:  useCallback(id => aplicar(id, p => cancelarPublicacao(p, autor)), [aplicar, autor]),
    reabrir:   useCallback(id => aplicar(id, p => reabrirPublicacao(p, autor)), [aplicar, autor]),
    remover:   useCallback(id => setPubs(prev => {
      const next = prev.filter(p => p.id !== id)
      salvarPublicacoes(next)
      return next
    }), []),
    enviarLembrete,
    salvarConfiguracao: useCallback((c: PesqConfig) => { setConfig(c); salvarConfig(c) }, []),
  }
}
