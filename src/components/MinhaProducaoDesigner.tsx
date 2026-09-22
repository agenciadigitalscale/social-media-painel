/* MinhaProducaoDesigner — o painel de produção no Meu Dia.

   Mostra SÓ os números da pessoa logada. Nada de comparação nem de outra
   pessoa — a conta é feita só sobre as peças dela (`artesDoDesigner(currentUser)`),
   então não há como um ver o do outro.

   Serve dois perfis, MESMO formato, conta parametrizada na lib:
     • design → conta ARTES APROVADAS (status 5/7). Julio, Jhones.
     • vídeo  → conta VÍDEOS FINALIZADOS (chegaram a "P/ enviar", 3+). Kaique.
       Em "A fazer" e "Produção" não conta; voltou para produção, deixa de contar.
   O que muda é a palavra, o ícone e a regra de contagem; o número é o mesmo que a
   gestão fecharia.

   No perfil de vídeo há também o REGISTRO MANUAL (o "Registrar" de antes): vídeo
   feito fora do fluxo entra à mão. Persistência em `sm_producao_manual` (a mesma
   do producaoEditor), então o registro sincroniza entre aparelhos.

   O botão Relatório monta o texto (dia/mês) para o grupo — consistente com os
   números da tela, porque sai da mesma lib.
*/
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  Box, Paper, Typography, Tooltip, Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, MenuItem, Autocomplete, IconButton, Checkbox, FormControlLabel,
} from '@mui/material'
import PaletteIcon from '@mui/icons-material/Palette'
import MovieCreationIcon from '@mui/icons-material/MovieCreation'
import SummarizeIcon from '@mui/icons-material/Summarize'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import WhatsAppIcon from '@mui/icons-material/WhatsApp'
import AddIcon from '@mui/icons-material/Add'
import AutorenewIcon from '@mui/icons-material/Autorenew'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import CloseIcon from '@mui/icons-material/Close'
import type { Client, ContentItem, ContentType, ItemState } from '../types'
import { STATUS_CONFIG } from '../types'
import { ALL_TYPES } from './producao/shared'
import {
  artesDoDesigner, resumoDesigner, aprovadasPorClienteMes, aprovadasDoMes,
  isFinalizado, momentoFinalizacao,
  aprovadas, chaveDoDia, chaveDoMes,
  videosAjustados, resumoAjustes, ajustadosDoDia, ajustadosDoMes,
  carregarAjustesManuais, salvarAjustesManuais,
  type ArteDesigner, type ContagemOpts, type VideoAjustado,
} from '../lib/designerProducao'
import {
  carregarManuais, salvarManuais, adicionarManual, removerManual, type EntregaManual,
  carregarExclusoes, salvarExclusoes, excluidosDoAutor, excluirEntrega,
} from '../lib/producaoEditor'
import { carregarPaineis, carregarAtribuicoes } from '../lib/paineis'
import { NAME_MAP, getDisplayName } from '../lib/users'
import { DS } from '../theme'
import { clickable } from '../shared/a11y'

type PerfilKey = 'design' | 'video'

interface PerfilCfg {
  Icone: typeof PaletteIcon
  legenda: string
  subst: string
  singular: string
  plural: string
  recentes: string
  vazio: string
  /** Perfil com registro manual + contagem por finalização (vídeo). */
  manual: boolean
  tipoPadrao: ContentType
}

const PERFIS: Record<PerfilKey, PerfilCfg> = {
  design: {
    Icone: PaletteIcon, legenda: 'suas artes aprovadas', subst: 'arte',
    singular: '1 arte aprovada', plural: 'aprovadas', recentes: 'Aprovadas recentes',
    vazio: 'Nenhuma arte aprovada ainda. Quando o cliente aprovar suas artes, elas aparecem aqui.',
    manual: false, tipoPadrao: 'Post',
  },
  video: {
    Icone: MovieCreationIcon, legenda: 'seus vídeos feitos', subst: 'vídeo',
    singular: '1 vídeo feito', plural: 'feitos', recentes: 'Vídeos recentes',
    vazio: 'Nenhum vídeo finalizado ainda. Assim que um card chega em "P/ enviar", ele conta aqui.',
    manual: true, tipoPadrao: 'Reel',
  },
}

interface Props {
  items: ContentItem[]
  states: Record<number, ItemState>
  currentUser: string
  now: Date
  /** design (padrão) conta aprovados; video conta finalizados e tem registro manual. */
  perfil?: PerfilKey
  /** Para o seletor de cliente do registro manual (perfil de vídeo). */
  allClients?: Client[]
  /** Cadastra um cliente novo direto do registro manual — sem ir na aba Clientes. */
  onAddClient?: (name: string) => void
  /** De quem é a produção mostrada. Padrão = a pessoa logada (o "Meu Dia"). Quando
      a gestão abre a produção de outra pessoa (ex.: Pradox vendo o Kaique), passa o
      username do alvo — a conta e os rótulos passam a ser dessa pessoa. */
  alvo?: string
  /** Visão de gestão: esconde Registrar e o apagar do registro manual. Os números
      são idênticos aos que o alvo vê — é a mesma lib —, só não dá para editar. */
  somenteLeitura?: boolean
}

function Numero({ valor, cor }: { valor: number; cor: string }) {
  return (
    <Typography key={valor} sx={{
      fontWeight: 900, lineHeight: 1, color: cor,
      fontSize: { xs: '2rem', md: '2.4rem', xl: '2.8rem' },
      letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums',
      animation: 'countUp 0.45s cubic-bezier(0.16,1,0.3,1) both',
    }}>
      {valor}
    </Typography>
  )
}

function Metrica({ rotulo, valor, cor, detalhe }: { rotulo: string; valor: number; cor: string; detalhe?: string }) {
  return (
    <Box sx={{ flex: 1, minWidth: { xs: 92, sm: 110 } }}>
      <Typography sx={{
        fontSize: { xs: '0.55rem', xl: '0.62rem' }, color: DS.t2, fontWeight: 800,
        textTransform: 'uppercase', letterSpacing: '0.09em', mb: 0.5,
      }}>
        {rotulo}
      </Typography>
      <Numero valor={valor} cor={cor} />
      {detalhe && (
        <Typography sx={{ fontSize: { xs: '0.58rem', xl: '0.65rem' }, color: DS.t3, mt: 0.35 }}>{detalhe}</Typography>
      )}
    </Box>
  )
}

export default function MinhaProducaoDesigner({ items, states, currentUser, now, perfil = 'design', allClients, onAddClient, alvo, somenteLeitura = false }: Props) {
  const cfg = PERFIS[perfil]
  const { Icone } = cfg
  // Quem é o dono da produção. O `currentUser` continua sendo quem OPERA (o autor
  // de um registro manual); `designer` é de quem são os números.
  const designer = alvo ?? currentUser
  const tituloPainel = somenteLeitura ? `Produção de ${getDisplayName(designer)}` : 'Minha Produção'
  const legendaPainel = somenteLeitura ? 'produção em tempo real' : cfg.legenda
  const [relatorioAberto, setRelatorioAberto] = useState(false)
  const [formAberto, setFormAberto] = useState(false)
  const [formAjuste, setFormAjuste] = useState(false)
  const [manuais, setManuais] = useState<EntregaManual[]>(() => (cfg.manual ? carregarManuais() : []))
  // Ajustes são carregados sempre: o auto-detect vale para os dois perfis (o
  // cliente pede "Ajuste solicitado" tanto de arte quanto de vídeo).
  const [ajustesManuais, setAjustesManuais] = useState<EntregaManual[]>(() => carregarAjustesManuais())
  // Vídeos que a pessoa TIROU da própria lista (o card segue no board).
  const [exclusoes, setExclusoes] = useState(() => carregarExclusoes())

  // O registro manual sincroniza; um cadastro feito no celular chega pelo poll.
  useEffect(() => {
    if (!cfg.manual) return
    const recarregar = () => setManuais(carregarManuais())
    window.addEventListener('ds:producaoManual', recarregar)
    return () => window.removeEventListener('ds:producaoManual', recarregar)
  }, [cfg.manual])

  useEffect(() => {
    const recarregar = () => setExclusoes(carregarExclusoes())
    window.addEventListener('ds:producaoExcluir', recarregar)
    return () => window.removeEventListener('ds:producaoExcluir', recarregar)
  }, [])

  useEffect(() => {
    const recarregar = () => setAjustesManuais(carregarAjustesManuais())
    window.addEventListener('ds:producaoAjuste', recarregar)
    return () => window.removeEventListener('ds:producaoAjuste', recarregar)
  }, [])

  const gravar = (lista: EntregaManual[]) => { setManuais(lista); salvarManuais(lista) }
  const apagarManual = (id: string) => gravar(removerManual(manuais, id))
  const gravarAjustes = (lista: EntregaManual[]) => { setAjustesManuais(lista); salvarAjustesManuais(lista) }
  const apagarAjuste = (id: string) => gravarAjustes(removerManual(ajustesManuais, id))
  // Tira um vídeo deduzido da lista deste designer (não apaga o card).
  const excluirDaLista = (itemId: number) => {
    const novo = excluirEntrega(exclusoes, designer, itemId)
    setExclusoes(novo); salvarExclusoes(novo)
  }

  const paineis = useMemo(() => carregarPaineis(), [])
  const atrib = useMemo(() => carregarAtribuicoes(), [])

  // A regra de contagem depende do perfil: aprovado (design) ou finalizado (vídeo).
  const opts: ContagemOpts = useMemo(
    () => (perfil === 'video'
      ? { conta: isFinalizado, momento: momentoFinalizacao, manuais }
      : {}),
    [perfil, manuais],
  )

  const excluidos = useMemo(() => excluidosDoAutor(exclusoes, designer), [exclusoes, designer])
  const artes = useMemo(
    () => artesDoDesigner(items, states, atrib, paineis, designer, excluidos, opts),
    [items, states, atrib, paineis, designer, excluidos, opts],
  )
  const resumo = useMemo(() => resumoDesigner(artes, now), [artes, now])
  const porCliente = useMemo(() => aprovadasPorClienteMes(artes, now), [artes, now])
  const recentes = useMemo(() => aprovadasDoMes(artes, now).slice(0, 8), [artes, now])

  // Ajustados (retrabalho): auto-detectado pelo status "Ajuste solicitado" +
  // registro manual. Vale para os dois perfis.
  const ajustados = useMemo(
    () => videosAjustados(designer, ajustesManuais),
    [designer, ajustesManuais],
  )
  const resumoAj = useMemo(() => resumoAjustes(ajustados, now), [ajustados, now])
  const ajustadosMes = useMemo(() => ajustadosDoMes(ajustados, now).slice(0, 8), [ajustados, now])

  const cor = NAME_MAP[designer]?.color && NAME_MAP[designer].color !== '#9CA3AF'
    ? NAME_MAP[designer].color : DS.purpleSoft
  const mesLabel = now.toLocaleDateString('pt-BR', { month: 'long' })

  return (
    <Paper sx={{
      position: 'relative', overflow: 'hidden', mb: 2.25,
      px: { xs: 2, md: 2.5, xl: 3 }, py: { xs: 1.7, md: 2, xl: 2.3 },
      background: `linear-gradient(115deg, ${cor}12 0%, ${DS.surface} 52%, ${DS.surfaceAlt} 100%)`,
      border: `1px solid ${cor}2e`, borderRadius: 3,
      animation: 'fadeInUp 0.4s cubic-bezier(0.16,1,0.3,1) both',
    }}>
      {/* ── Cabeçalho ── */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.4, mb: 1.6 }}>
        <Box sx={{
          width: { xs: 34, md: 38 }, height: { xs: 34, md: 38 }, borderRadius: '11px', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: `${cor}1c`, border: `1px solid ${cor}45`, color: cor,
        }}>
          <Icone sx={{ fontSize: 19 }} />
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{
            fontWeight: 800, color: DS.t1, letterSpacing: '-0.02em', lineHeight: 1.15,
            fontSize: { xs: '0.95rem', md: '1.05rem', xl: '1.2rem' },
          }}>
            {tituloPainel}
          </Typography>
          <Typography sx={{ fontSize: { xs: '0.63rem', xl: '0.72rem' }, color: DS.t3 }}>
            {NAME_MAP[designer]?.emoji} {getDisplayName(designer)} — {legendaPainel}
          </Typography>
        </Box>
        <Box sx={{ ml: 'auto', flexShrink: 0, display: 'flex', gap: 0.8 }}>
          <BotaoHeader onClick={() => setRelatorioAberto(true)} icon={<SummarizeIcon sx={{ fontSize: 14, color: DS.t2 }} />}
            rotulo="Relatório" aria="Abrir relatório de produção" title="Relatório dos números, pronto para enviar" />
          {cfg.manual && !somenteLeitura && (
            <BotaoHeader onClick={() => setFormAberto(true)} icon={<AddIcon sx={{ fontSize: 14, color: DS.t2 }} />}
              rotulo="Registrar" aria="Registrar vídeo manualmente" title="Registrar um vídeo feito que não apareceu aqui" />
          )}
          {!somenteLeitura && (
            <BotaoHeader onClick={() => setFormAjuste(true)} icon={<AutorenewIcon sx={{ fontSize: 14, color: DS.t2 }} />}
              rotulo="Ajuste" aria="Incluir vídeo ajustado" title="Incluir um vídeo/arte que o cliente mandou ajustar" />
          )}
        </Box>
      </Box>

      {/* ── Os números que importam ── */}
      <Box sx={{ display: 'flex', gap: { xs: 1.5, md: 2.5 }, flexWrap: 'wrap', mb: porCliente.length > 0 || recentes.length > 0 ? 2 : 0 }}>
        <Metrica rotulo="Hoje" valor={resumo.aprovadasHoje} cor={resumo.aprovadasHoje > 0 ? DS.green : DS.t3}
          detalhe={resumo.aprovadasHoje === 1 ? cfg.singular : `${resumo.aprovadasHoje} ${cfg.plural}`} />
        <Metrica rotulo="Esta semana" valor={resumo.aprovadasSemana} cor={cor} />
        <Metrica rotulo={`Feitos em ${mesLabel}`} valor={resumo.aprovadasMes} cor={cor} />
        <Metrica rotulo={`Ajustados em ${mesLabel}`} valor={resumoAj.mes} cor={resumoAj.mes > 0 ? DS.alert : DS.t3}
          detalhe={resumoAj.total > resumoAj.mes ? `${resumoAj.total} no total` : undefined} />
        <Metrica rotulo="Aguardando" valor={resumo.aguardando} cor={resumo.aguardando > 0 ? DS.amber : DS.t3} />
        <Metrica rotulo="Em correção" valor={resumo.correcao} cor={resumo.correcao > 0 ? DS.red : DS.t3} />
      </Box>

      {/* ── Por cliente, no mês ── */}
      {porCliente.length > 0 && (
        <Box sx={{ display: 'flex', gap: 0.7, flexWrap: 'wrap', mb: recentes.length > 0 ? 1.6 : 0 }}>
          {porCliente.slice(0, 6).map(c => (
            <Box key={c.cliente} sx={{
              px: 1, py: 0.4, borderRadius: '7px', bgcolor: `${cor}0f`, border: `1px solid ${cor}2e`,
              display: 'flex', alignItems: 'center', gap: 0.6,
            }}>
              <Typography sx={{ fontSize: { xs: '0.6rem', xl: '0.68rem' }, color: DS.t2, fontWeight: 600 }} noWrap>{c.cliente}</Typography>
              <Typography sx={{ fontSize: { xs: '0.6rem', xl: '0.68rem' }, color: cor, fontWeight: 800 }}>{c.n}</Typography>
            </Box>
          ))}
        </Box>
      )}

      {/* ── Produção recente (só as próprias peças) ── */}
      {recentes.length > 0 && (
        <Box sx={{ pt: 1.2, borderTop: `1px solid ${cor}1a` }}>
          <Typography sx={{
            fontSize: { xs: '0.55rem', xl: '0.62rem' }, color: DS.t3, fontWeight: 800,
            textTransform: 'uppercase', letterSpacing: '0.09em', mb: 0.8,
          }}>
            {cfg.recentes}
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            {recentes.map(a => {
              const scfg = STATUS_CONFIG[a.status]
              return (
                <Box key={a.manualId ?? a.itemId} sx={{
                  display: 'flex', alignItems: 'center', gap: 1,
                  px: 1, py: 0.6, borderRadius: '8px', bgcolor: DS.field, border: `1px solid ${DS.border}`,
                }}>
                  <Typography sx={{ fontSize: '0.6rem', color: DS.t3, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                    {a.aprovadaEm ? new Date(a.aprovadaEm).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '—'}
                  </Typography>
                  <Typography sx={{ fontSize: { xs: '0.66rem', xl: '0.74rem' }, color: DS.t1, fontWeight: 600, minWidth: 0 }} noWrap>
                    {a.titulo}
                  </Typography>
                  <Typography sx={{ fontSize: '0.6rem', color: DS.t3, ml: 'auto', flexShrink: 0 }} noWrap>{a.cliente}</Typography>
                  {a.manual && a.manualId && !somenteLeitura ? (
                    <Tooltip title="Registro manual — remover">
                      <IconButton size="small" aria-label={`Remover ${a.titulo}`} onClick={() => apagarManual(a.manualId!)}
                        sx={{ p: 0.3, flexShrink: 0, color: DS.t4, '&:hover': { color: DS.red } }}>
                        <DeleteOutlineIcon sx={{ fontSize: 14 }} />
                      </IconButton>
                    </Tooltip>
                  ) : (
                    <>
                      <Tooltip title={scfg?.label ?? ''}>
                        <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: scfg?.color, flexShrink: 0 }} />
                      </Tooltip>
                      {!somenteLeitura && (
                        <Tooltip title="Tirar da minha lista (não apaga o card)">
                          <IconButton size="small" aria-label={`Tirar ${a.titulo} da minha lista`} onClick={() => excluirDaLista(a.itemId)}
                            sx={{ p: 0.3, flexShrink: 0, color: DS.t4, '&:hover': { color: DS.red } }}>
                            <CloseIcon sx={{ fontSize: 14 }} />
                          </IconButton>
                        </Tooltip>
                      )}
                    </>
                  )}
                </Box>
              )
            })}
          </Box>
        </Box>
      )}

      {/* ── Ajustados no mês (retrabalho) ── */}
      {ajustadosMes.length > 0 && (
        <Box sx={{ pt: 1.2, mt: recentes.length > 0 ? 1.2 : 0, borderTop: `1px solid ${DS.alert}22` }}>
          <Typography sx={{
            fontSize: { xs: '0.55rem', xl: '0.62rem' }, color: DS.alert, fontWeight: 800,
            textTransform: 'uppercase', letterSpacing: '0.09em', mb: 0.8,
          }}>
            🔄 Ajustados em {mesLabel}
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            {ajustadosMes.map(a => (
              <Box key={a.manualId ?? a.itemId} sx={{
                display: 'flex', alignItems: 'center', gap: 1,
                px: 1, py: 0.6, borderRadius: '8px', bgcolor: DS.field, border: `1px solid ${DS.border}`,
              }}>
                <Typography sx={{ fontSize: '0.6rem', color: DS.t3, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                  {a.ajustadoEm ? new Date(a.ajustadoEm).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '—'}
                </Typography>
                <Typography sx={{ fontSize: { xs: '0.66rem', xl: '0.74rem' }, color: DS.t1, fontWeight: 600, minWidth: 0 }} noWrap>
                  {a.titulo}
                </Typography>
                <Typography sx={{ fontSize: '0.6rem', color: DS.t3, ml: 'auto', flexShrink: 0 }} noWrap>{a.cliente}</Typography>
                {!somenteLeitura ? (
                  <Tooltip title="Remover este ajuste">
                    <IconButton size="small" aria-label={`Remover ajuste ${a.titulo}`} onClick={() => apagarAjuste(a.manualId)}
                      sx={{ p: 0.3, flexShrink: 0, color: DS.t4, '&:hover': { color: DS.red } }}>
                      <DeleteOutlineIcon sx={{ fontSize: 14 }} />
                    </IconButton>
                  </Tooltip>
                ) : (
                  <AutorenewIcon sx={{ fontSize: 13, color: DS.alert, flexShrink: 0 }} />
                )}
              </Box>
            ))}
          </Box>
        </Box>
      )}

      {/* Nada ainda: a tela não some, orienta. */}
      {resumo.aprovadasTotal === 0 && resumo.aguardando === 0 && resumo.correcao === 0 && ajustados.length === 0 && (
        <Typography sx={{ fontSize: '0.72rem', color: DS.t3, mt: 0.5 }}>{cfg.vazio}</Typography>
      )}

      <DialogRelatorio
        aberto={relatorioAberto}
        onFechar={() => setRelatorioAberto(false)}
        artes={artes}
        ajustados={ajustados}
        now={now}
        quem={getDisplayName(designer)}
        subst={cfg.subst}
      />

      {cfg.manual && !somenteLeitura && (
        <FormManual
          aberto={formAberto}
          onFechar={() => setFormAberto(false)}
          onSalvar={dados => { gravar(adicionarManual(manuais, { ...dados, autor: currentUser })); setFormAberto(false) }}
          clientes={allClients}
          onAddClient={onAddClient}
          itens={items}
          now={now}
          tipoPadrao={cfg.tipoPadrao}
        />
      )}

      {!somenteLeitura && (
        <FormManual
          contexto="ajuste"
          aberto={formAjuste}
          onFechar={() => setFormAjuste(false)}
          onSalvar={dados => { gravarAjustes(adicionarManual(ajustesManuais, { ...dados, autor: currentUser })); setFormAjuste(false) }}
          clientes={allClients}
          onAddClient={onAddClient}
          itens={items}
          now={now}
          tipoPadrao={cfg.tipoPadrao}
        />
      )}
    </Paper>
  )
}

function BotaoHeader({ onClick, icon, rotulo, aria, title }: {
  onClick: () => void; icon: ReactNode; rotulo: string; aria: string; title: string
}) {
  return (
    <Tooltip title={title}>
      <Box {...clickable(onClick)} aria-label={aria} sx={{
        display: 'inline-flex', alignItems: 'center', gap: 0.4,
        px: 1, py: 0.5, borderRadius: '9px', cursor: 'pointer',
        border: `1px solid ${DS.border}`, bgcolor: DS.field,
        transition: 'all 0.18s ease', '&:hover': { borderColor: DS.borderHov, bgcolor: DS.surfaceAlt },
      }}>
        {icon}
        <Typography sx={{ fontSize: '0.63rem', fontWeight: 700, color: DS.t2, whiteSpace: 'nowrap' }}>{rotulo}</Typography>
      </Box>
    </Tooltip>
  )
}

const DIAS_SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']

function inicioDoDia(d: Date): number { return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() }

function DialogRelatorio({ aberto, onFechar, artes, ajustados, now, quem, subst }: {
  aberto: boolean; onFechar: () => void; artes: ArteDesigner[]; ajustados: VideoAjustado[]; now: Date; quem: string; subst: string
}) {
  const [aba, setAba] = useState<'cal' | 'mes'>('cal')
  const [copiado, setCopiado] = useState(false)
  // Mês exibido no calendário e o dia selecionado. Reabre sempre em hoje.
  const [mesRef, setMesRef] = useState(() => new Date(now.getFullYear(), now.getMonth(), 1))
  const [diaSel, setDiaSel] = useState(() => new Date(now))

  useEffect(() => {
    if (aberto) {
      setMesRef(new Date(now.getFullYear(), now.getMonth(), 1))
      setDiaSel(new Date(now))
      setAba('cal')
    }
  }, [aberto, now])

  // Quantos foram feitos em cada dia — preenche os números do calendário.
  const porDia = useMemo(() => {
    const m: Record<string, number> = {}
    for (const a of aprovadas(artes)) {
      if (a.aprovadaEm === null) continue
      const k = chaveDoDia(a.aprovadaEm)
      m[k] = (m[k] ?? 0) + 1
    }
    return m
  }, [artes])

  // Feitos do período: a QUANTIDADE e a quebra por cliente (o número grande +
  // "quais clientes", como no topo do painel) — não a lista de vídeos.
  const feitosDoPeriodo = useMemo(() => {
    const chave = aba === 'cal' ? chaveDoDia(diaSel.getTime()) : chaveDoMes(now.getTime())
    const list = aprovadas(artes).filter(a => a.aprovadaEm !== null && (
      aba === 'cal' ? chaveDoDia(a.aprovadaEm) === chave : chaveDoMes(a.aprovadaEm) === chave))
    const porCli: Record<string, number> = {}
    for (const a of list) porCli[a.cliente] = (porCli[a.cliente] ?? 0) + 1
    const clientes = Object.entries(porCli).map(([cliente, n]) => ({ cliente, n })).sort((a, b) => b.n - a.n)
    return { total: list.length, clientes }
  }, [aba, artes, diaSel, now])

  // Ajustados do mesmo período — entram como uma linha secundária.
  const ajDoPeriodo = useMemo(
    () => (aba === 'cal' ? ajustadosDoDia(ajustados, diaSel) : ajustadosDoMes(ajustados, now)),
    [aba, ajustados, diaSel, now],
  )

  const periodoLabel = aba === 'cal'
    ? diaSel.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : now.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
  const substPlural = `${subst}s`

  // Texto de Copiar/WhatsApp: acompanha o que está na tela (quantidade + clientes).
  const textoFinal = useMemo(() => {
    const titulo = `Produção de ${quem} · ${periodoLabel}`
    const linhas = feitosDoPeriodo.total === 0
      ? [titulo, `Nada ${aba === 'cal' ? 'neste dia' : 'neste mês'}.`]
      : [titulo, `${feitosDoPeriodo.total} ${feitosDoPeriodo.total === 1 ? subst : substPlural} feito${feitosDoPeriodo.total === 1 ? '' : 's'}`, '',
         ...feitosDoPeriodo.clientes.map(c => `• ${c.cliente} — ${c.n}`)]
    if (ajDoPeriodo.length) linhas.push('', `🔄 Ajustados: ${ajDoPeriodo.length}`,
      ...ajDoPeriodo.map(a => `• ${a.cliente} — ${a.titulo}`))
    return linhas.join('\n')
  }, [quem, periodoLabel, feitosDoPeriodo, ajDoPeriodo, aba, subst, substPlural])
  const vazioTudo = feitosDoPeriodo.total === 0 && ajDoPeriodo.length === 0

  const copiar = () => {
    navigator.clipboard.writeText(textoFinal).then(() => {
      setCopiado(true); setTimeout(() => setCopiado(false), 1800)
    }).catch(() => { /* sem permissão: o texto está na tela */ })
  }

  // Grade do mês: espaços em branco até o 1º dia + os dias do mês.
  const ano = mesRef.getFullYear(), mes = mesRef.getMonth()
  const primeiroDiaSemana = new Date(ano, mes, 1).getDay()
  const diasNoMes = new Date(ano, mes + 1, 0).getDate()
  const celulas: (number | null)[] = [
    ...Array<null>(primeiroDiaSemana).fill(null),
    ...Array.from({ length: diasNoMes }, (_, i) => i + 1),
  ]
  const hojeMs = inicioDoDia(now)
  const selMs = inicioDoDia(diaSel)
  // Não deixa avançar para meses futuros — não há produção lá.
  const mesAtualMs = new Date(now.getFullYear(), now.getMonth(), 1).getTime()
  const podeAvancar = mesRef.getTime() < mesAtualMs
  const nomeMes = mesRef.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })

  return (
    <Dialog open={aberto} onClose={onFechar} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ pb: 1 }}>
        <Typography sx={{ fontSize: '0.95rem', fontWeight: 800, color: DS.t1 }}>Relatório de produção</Typography>
        <Box sx={{ display: 'flex', gap: 0.8, mt: 1.2 }}>
          {([['cal', '📅 Por dia'], ['mes', 'Este mês']] as const).map(([k, rotulo]) => (
            <Box key={k} {...clickable(() => setAba(k))} sx={{
              px: 1.4, py: 0.5, borderRadius: '8px', cursor: 'pointer', fontSize: '0.68rem', fontWeight: 800,
              color: aba === k ? DS.t1 : DS.t3, bgcolor: aba === k ? DS.surfaceAlt : 'transparent',
              border: `1px solid ${aba === k ? DS.border : 'transparent'}`, transition: 'all 0.18s ease',
            }}>
              {rotulo}
            </Box>
          ))}
        </Box>
      </DialogTitle>
      <DialogContent>
        {aba === 'cal' && (
          <Box sx={{ mb: 1.4 }}>
            {/* Navegação de mês */}
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
              <Box {...clickable(() => setMesRef(new Date(ano, mes - 1, 1)))} aria-label="Mês anterior" sx={{
                width: 28, height: 28, borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', color: DS.t2, border: `1px solid ${DS.border}`, bgcolor: DS.field,
                '&:hover': { color: DS.t1, borderColor: DS.borderHov },
              }}>‹</Box>
              <Typography sx={{ fontSize: '0.82rem', fontWeight: 800, color: DS.t1, textTransform: 'capitalize' }}>{nomeMes}</Typography>
              <Box {...clickable(() => podeAvancar && setMesRef(new Date(ano, mes + 1, 1)))} aria-label="Próximo mês" sx={{
                width: 28, height: 28, borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: podeAvancar ? 'pointer' : 'default', color: podeAvancar ? DS.t2 : DS.t4,
                border: `1px solid ${DS.border}`, bgcolor: DS.field,
                '&:hover': podeAvancar ? { color: DS.t1, borderColor: DS.borderHov } : undefined,
              }}>›</Box>
            </Box>

            {/* Cabeçalho dos dias da semana */}
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 0.6, mb: 0.6 }}>
              {DIAS_SEMANA.map(d => (
                <Typography key={d} sx={{ fontSize: '0.56rem', fontWeight: 800, color: DS.t3, textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{d}</Typography>
              ))}
            </Box>

            {/* Grade dos dias */}
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 0.6 }}>
              {celulas.map((dia, i) => {
                if (dia === null) return <Box key={`b${i}`} />
                const dMs = new Date(ano, mes, dia).getTime()
                const n = porDia[chaveDoDia(new Date(ano, mes, dia, 12).getTime())] ?? 0
                const futuro = dMs > hojeMs
                const hoje = dMs === hojeMs
                const sel = dMs === selMs
                return (
                  <Box
                    key={dia}
                    {...(futuro ? {} : clickable(() => setDiaSel(new Date(ano, mes, dia, 12, 0, 0))))}
                    aria-label={`Dia ${dia}, ${n} ${n === 1 ? 'feito' : 'feitos'}`}
                    sx={{
                      aspectRatio: '1', borderRadius: '9px', position: 'relative',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                      cursor: futuro ? 'default' : 'pointer',
                      border: sel ? `1.5px solid ${DS.accent}` : `1px solid ${n > 0 ? `${DS.accent}33` : DS.border}`,
                      bgcolor: sel ? `${DS.accent}22` : n > 0 ? `${DS.accent}10` : DS.field,
                      opacity: futuro ? 0.35 : 1,
                      transition: 'all 0.14s ease',
                      '&:hover': futuro ? undefined : { borderColor: DS.accent, bgcolor: `${DS.accent}1a` },
                    }}
                  >
                    <Typography sx={{
                      fontSize: '0.72rem', fontWeight: hoje ? 900 : 600, lineHeight: 1,
                      color: sel ? DS.accent : hoje ? DS.t1 : DS.t2,
                    }}>{dia}</Typography>
                    {n > 0 && (
                      <Typography sx={{ fontSize: '0.6rem', fontWeight: 900, color: DS.accent, lineHeight: 1, mt: 0.2 }}>{n}</Typography>
                    )}
                    {hoje && <Box sx={{ position: 'absolute', bottom: 3, width: 4, height: 4, borderRadius: '50%', bgcolor: DS.green }} />}
                  </Box>
                )
              })}
            </Box>

            {/* Atalhos rápidos */}
            <Box sx={{ display: 'flex', gap: 0.6, mt: 1 }}>
              {([['Hoje', new Date(now)], ['Ontem', new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1)]] as const).map(([rot, d]) => {
                const ativo = inicioDoDia(d) === selMs
                return (
                  <Box key={rot} {...clickable(() => { setDiaSel(d); setMesRef(new Date(d.getFullYear(), d.getMonth(), 1)) })} sx={{
                    px: 1.1, py: 0.4, borderRadius: '8px', cursor: 'pointer', fontSize: '0.64rem', fontWeight: 700,
                    color: ativo ? DS.accent : DS.t3, bgcolor: ativo ? `${DS.accent}18` : DS.field,
                    border: `1px solid ${ativo ? `${DS.accent}55` : DS.border}`,
                  }}>{rot}</Box>
                )
              })}
            </Box>
          </Box>
        )}

        {/* Relatório do dia (ou do mês): a QUANTIDADE grande + quais clientes */}
        <Box sx={{ p: 1.6, borderRadius: '10px', bgcolor: DS.field, border: `1px solid ${DS.border}`, maxHeight: 260, overflow: 'auto' }}>
          {/* Dois números GRANDES lado a lado: feitos (verde) e ajustados (âmbar) */}
          <Box sx={{ display: 'flex', gap: 1.2, flexWrap: 'wrap' }}>
            <Box sx={{
              flex: '1 1 130px', p: 1.4, borderRadius: '12px',
              bgcolor: `${DS.green}0e`, border: `1px solid ${DS.green}33`,
            }}>
              <Typography sx={{
                fontSize: '0.56rem', fontWeight: 800, color: DS.green,
                textTransform: 'uppercase', letterSpacing: '0.09em',
              }}>
                Feitos {aba === 'cal' ? 'neste dia' : 'no mês'}
              </Typography>
              <Typography sx={{
                fontWeight: 900, lineHeight: 0.95, color: feitosDoPeriodo.total > 0 ? DS.green : DS.t3,
                fontSize: { xs: '3rem', md: '3.6rem' }, letterSpacing: '-0.04em',
                fontVariantNumeric: 'tabular-nums', mt: 0.4,
              }}>
                {feitosDoPeriodo.total}
              </Typography>
              <Typography sx={{ fontSize: '0.62rem', color: DS.t3, mt: 0.3 }}>
                {feitosDoPeriodo.total === 1 ? `1 ${subst} feito` : `${substPlural} feitos`}
              </Typography>
            </Box>

            <Box sx={{
              flex: '1 1 130px', p: 1.4, borderRadius: '12px',
              bgcolor: `${DS.alert}0e`, border: `1px solid ${DS.alert}33`,
            }}>
              <Typography sx={{
                fontSize: '0.56rem', fontWeight: 800, color: DS.alert,
                textTransform: 'uppercase', letterSpacing: '0.09em',
              }}>
                🔄 Ajustados {aba === 'cal' ? 'neste dia' : 'no mês'}
              </Typography>
              <Typography sx={{
                fontWeight: 900, lineHeight: 0.95, color: ajDoPeriodo.length > 0 ? DS.alert : DS.t3,
                fontSize: { xs: '3rem', md: '3.6rem' }, letterSpacing: '-0.04em',
                fontVariantNumeric: 'tabular-nums', mt: 0.4,
              }}>
                {ajDoPeriodo.length}
              </Typography>
              <Typography sx={{ fontSize: '0.62rem', color: DS.t3, mt: 0.3 }}>
                {ajDoPeriodo.length === 1 ? 'retrabalho' : 'retrabalhos'}
              </Typography>
            </Box>
          </Box>

          {feitosDoPeriodo.clientes.length > 0 && (
            <Box sx={{ display: 'flex', gap: 0.7, flexWrap: 'wrap', mt: 1.3 }}>
              {feitosDoPeriodo.clientes.map(c => (
                <Box key={c.cliente} sx={{
                  px: 1, py: 0.4, borderRadius: '7px', bgcolor: `${DS.green}12`, border: `1px solid ${DS.green}33`,
                  display: 'flex', alignItems: 'center', gap: 0.6,
                }}>
                  <Typography sx={{ fontSize: '0.63rem', color: DS.t1, fontWeight: 600 }} noWrap>{c.cliente}</Typography>
                  <Typography sx={{ fontSize: '0.63rem', color: DS.green, fontWeight: 800 }}>{c.n}</Typography>
                </Box>
              ))}
            </Box>
          )}

          {feitosDoPeriodo.total === 0 && ajDoPeriodo.length === 0 && (
            <Typography sx={{ fontSize: '0.72rem', color: DS.t3, mt: 1 }}>
              Nada {aba === 'cal' ? 'neste dia' : 'neste mês'}.
            </Typography>
          )}
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 2.5, pb: 2, gap: 1 }}>
        <Button size="small" onClick={onFechar} sx={{ color: DS.t3 }}>Fechar</Button>
        <Button size="small" startIcon={<ContentCopyIcon sx={{ fontSize: 14 }} />} onClick={copiar} disabled={vazioTudo} sx={{ color: DS.t2 }}>
          {copiado ? 'Copiado' : 'Copiar'}
        </Button>
        <Button size="small" variant="contained" startIcon={<WhatsAppIcon sx={{ fontSize: 15 }} />} disabled={vazioTudo}
          onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(textoFinal)}`, '_blank', 'noopener')}>
          WhatsApp
        </Button>
      </DialogActions>
    </Dialog>
  )
}

/** Data de hoje no formato do <input type="date">, em horário local. */
function hojeInput(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Registro manual de um vídeo feito fora do fluxo. Cliente é opcional (vira
    "Interno"); pode digitar um nome novo, não só escolher da lista. */
function FormManual({ aberto, onFechar, onSalvar, clientes, onAddClient, itens, now, tipoPadrao, contexto = 'feito' }: {
  aberto: boolean
  onFechar: () => void
  onSalvar: (d: { cliente: string; titulo: string; tipo: ContentType; ts: number }) => void
  clientes?: Client[]
  /** Cadastra um cliente novo aqui mesmo, sem ir na aba Clientes. */
  onAddClient?: (name: string) => void
  itens: ContentItem[]
  now: Date
  tipoPadrao: ContentType
  /** 'feito' = vídeo feito; 'ajuste' = retrabalho pedido pelo cliente. Muda só os textos. */
  contexto?: 'feito' | 'ajuste'
}) {
  const ehAjuste = contexto === 'ajuste'
  const [cliente, setCliente] = useState('')
  const [titulo, setTitulo] = useState('')
  const [tipo, setTipo] = useState<ContentType>(tipoPadrao)
  const [data, setData] = useState(() => hojeInput(now))
  const [cadastrarNovo, setCadastrarNovo] = useState(true)

  const opcoes = useMemo(() => {
    const dos = clientes?.map(c => c.name) ?? []
    const dosItens = [...new Set(itens.map(i => i.c))]
    return [...new Set([...dos, ...dosItens])].sort((a, b) => a.localeCompare(b))
  }, [clientes, itens])

  // Nome digitado que ainda não existe na lista — dá para cadastrar na hora.
  const nome = cliente.trim()
  const clienteNovo = !!nome && nome.toLowerCase() !== 'interno' &&
    !opcoes.some(o => o.toLowerCase() === nome.toLowerCase())

  const podeSalvar = !!titulo.trim() && !!data

  const salvar = () => {
    if (!podeSalvar) return
    // Cliente novo + opção marcada: cadastra ANTES de registrar, para o vídeo já
    // nascer amarrado a um cliente que existe no painel inteiro.
    if (clienteNovo && cadastrarNovo && onAddClient) onAddClient(nome)
    onSalvar({
      cliente: nome || 'Interno',
      titulo: titulo.trim(),
      tipo,
      ts: new Date(`${data}T12:00:00`).getTime(),
    })
    setCliente(''); setTitulo(''); setTipo(tipoPadrao); setData(hojeInput(now)); setCadastrarNovo(true)
  }

  return (
    <Dialog open={aberto} onClose={onFechar} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ pb: 0.5 }}>
        <Typography sx={{ fontSize: '0.95rem', fontWeight: 800, color: DS.t1 }}>
          {ehAjuste ? 'Registrar ajuste' : 'Registrar vídeo'}
        </Typography>
        <Typography sx={{ fontSize: '0.65rem', color: DS.t3, mt: 0.3 }}>
          {ehAjuste
            ? 'Inclua um vídeo/arte que o cliente mandou ajustar. Cada registro conta como um ajustado.'
            : 'Para um vídeo que você fez e não apareceu na conta automática.'}
        </Typography>
      </DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.6, pt: '10px !important' }}>
        <Autocomplete
          freeSolo size="small" fullWidth options={opcoes} value={cliente}
          onChange={(_, v) => setCliente(v ?? '')} onInputChange={(_, v) => setCliente(v)}
          renderInput={params => <TextField {...params} label="Cliente (opcional)" placeholder="Escolha ou digite um nome novo" />}
        />
        {clienteNovo && onAddClient && (
          <FormControlLabel
            sx={{ mt: -0.8, ml: 0.2 }}
            control={
              <Checkbox size="small" checked={cadastrarNovo} onChange={e => setCadastrarNovo(e.target.checked)}
                sx={{ py: 0.3, color: DS.t3, '&.Mui-checked': { color: DS.accent } }} />
            }
            label={
              <Typography sx={{ fontSize: '0.72rem', color: cadastrarNovo ? DS.t1 : DS.t3, fontWeight: 600 }}>
                Cadastrar <strong style={{ color: DS.accent }}>{nome}</strong> como cliente novo
              </Typography>
            }
          />
        )}
        <TextField size="small" fullWidth label={ehAjuste ? 'O que foi ajustado' : 'O que foi feito'} value={titulo}
          onChange={e => setTitulo(e.target.value)} placeholder={ehAjuste ? 'Ex.: Reel do lançamento — trocar música' : 'Ex.: Reel do lançamento'} />
        <Box sx={{ display: 'flex', gap: 1.2 }}>
          <TextField select size="small" label="Tipo" value={tipo} onChange={e => setTipo(e.target.value as ContentType)} sx={{ flex: 1 }}>
            {ALL_TYPES.map(t => <MenuItem key={t} value={t} sx={{ fontSize: '0.75rem' }}>{t}</MenuItem>)}
          </TextField>
          <TextField size="small" type="date" label="Quando" value={data} onChange={e => setData(e.target.value)}
            slotProps={{ inputLabel: { shrink: true }, htmlInput: { max: hojeInput(now) } }} sx={{ flex: 1 }} />
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 2.5, pb: 2, gap: 1 }}>
        <Button size="small" onClick={onFechar} sx={{ color: DS.t3 }}>Cancelar</Button>
        <Button size="small" variant="contained" onClick={salvar} disabled={!podeSalvar}>{ehAjuste ? 'Registrar ajuste' : 'Registrar'}</Button>
      </DialogActions>
    </Dialog>
  )
}
