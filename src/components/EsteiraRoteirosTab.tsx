/**
 * Aba 37 — "Roteiros" (2026-10-20): a esteira dos roteiros do mês.
 *
 * Um card por cliente por mês (ou por job avulso), de "A fazer" para
 * "Prontos": o documento de roteiros daquele mês. Kerges anexa o link e move;
 * Kaique, Arthur e os sócios veem e editam tudo. Regras em lib/esteiraRoteiros
 * (testadas); a Central de Roteiros de Produções (cada roteiro de cada
 * conteúdo) continua como está.
 */
import { useEffect, useState } from 'react'
import {
  Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, Menu, MenuItem,
  Snackbar, TextField, Tooltip, Typography,
} from '@mui/material'
import {
  DndContext, DragOverlay, PointerSensor, TouchSensor, closestCenter, pointerWithin,
  useDraggable, useDroppable, useSensor, useSensors,
  type CollisionDetection, type DragEndEvent, type DragStartEvent,
} from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import MoreHorizIcon from '@mui/icons-material/MoreHoriz'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import { DS } from '../theme'
import { clickable } from '../shared/a11y'
import { NAME_MAP } from '../lib/users'
import { nomeDoCliente, useCarteira } from '../lib/clientes'
import { naCarteira } from '../lib/planejamentoMes'
import {
  EVENTO_ESTEIRA_ROTEIROS, RESPONSAVEL_PADRAO, arquivarCard, cardsDaTela, carregarEsteira, chaveDoMes, criarCard,
  editarCard, ehFreelancer, excluirCard, linkValido, moverCard, nomeDoCard, quantidadeValida, restaurarCard,
  salvarEsteira, type CardRoteiro, type EsteiraStore, type NovoCardRoteiro,
} from '../lib/esteiraRoteiros'

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
const COLUNAS = [
  { status: 'a_fazer' as const, titulo: 'A fazer' },
  { status: 'pronto' as const, titulo: 'Prontos' },
]
const CAMPO = { '& .MuiInputBase-root': { fontSize: '0.78rem', bgcolor: DS.field, borderRadius: '9px', height: 36 } }
const pad = (n: number) => String(n).padStart(2, '0')
const dataCurta = (ts: number) => { const d = new Date(ts); return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}` }
const dataHora = (ts: number) => { const d = new Date(ts); return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} às ${pad(d.getHours())}:${pad(d.getMinutes())}` }
const rotuloMes = (ym: string) => { const [a, m] = ym.split('-').map(Number); return `${MESES[m - 1]} de ${a}` }
const nomePessoa = (u: string) => NAME_MAP[u]?.fullName ?? u

export default function EsteiraRoteirosTab({ clients, now }: { clients: string[]; now: Date }) {
  const [store, setStore] = useState<EsteiraStore>(() => carregarEsteira())
  // Mudou aqui, em outra aba ou chegou do sync → relê.
  useEffect(() => {
    const reler = () => setStore(carregarEsteira())
    window.addEventListener(EVENTO_ESTEIRA_ROTEIROS, reler)
    return () => window.removeEventListener(EVENTO_ESTEIRA_ROTEIROS, reler)
  }, [])
  const gravar = (s: EsteiraStore) => { if (s !== store) { setStore(s); salvarEsteira(s) } }

  const carteira = useCarteira()
  const tipoDoCliente = (id: string) => naCarteira(carteira, id).tipo
  const [ano, setAno] = useState(now.getFullYear())
  const [mesIdx, setMesIdx] = useState(now.getMonth())
  const mes = chaveDoMes(ano, mesIdx)
  const [tipo, setTipo] = useState<'todos' | 'fixos' | 'freelancer'>('todos')
  const [busca, setBusca] = useState('')
  const [arquivados, setArquivados] = useState(false)
  const [form, setForm] = useState<{ editando?: CardRoteiro } | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [ativo, setAtivo] = useState<string | null>(null)

  const cards = cardsDaTela(store, { mes, tipo, busca, arquivados }, nomeDoCliente, tipoDoCliente)
  const porColuna = (s: 'a_fazer' | 'pronto') => cards.filter(c => c.status === s)

  const andarMes = (d: -1 | 1) => { const n = new Date(ano, mesIdx + d, 1); setAno(n.getFullYear()); setMesIdx(n.getMonth()) }

  const mover = (id: string, para: 'a_fazer' | 'pronto') => {
    const c = store[id]
    if (!c || c.status === para) return
    gravar(moverCard(store, id, para, Date.now()))
    if (para === 'pronto' && !linkValido(c.link)) setAviso('Marcado como pronto, mas sem o link do roteiro — cole o link no card.')
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 10 } }),
  )
  const colisao: CollisionDetection = args => {
    const hits = pointerWithin(args).filter(({ id }) => String(id).startsWith('col-'))
    return hits.length ? hits : closestCenter(args)
  }
  const onDragStart = (e: DragStartEvent) => setAtivo(String(e.active.id))
  const onDragEnd = (e: DragEndEvent) => {
    setAtivo(null)
    const alvo = e.over ? String(e.over.id) : ''
    if (alvo === 'col-a_fazer' || alvo === 'col-pronto') mover(String(e.active.id), alvo.slice(4) as 'a_fazer' | 'pronto')
  }

  const pill = (sel: boolean) => ({
    px: 1.4, height: 34, display: 'flex', alignItems: 'center', borderRadius: '8px', cursor: 'pointer',
    fontSize: { xs: '0.74rem', xl: '0.82rem' }, fontWeight: 700, transition: 'all 0.18s ease',
    ...(sel ? { bgcolor: `${DS.accent}1f`, color: DS.accent } : { color: DS.t2, '&:hover': { color: DS.t1 } }),
  })

  const acoesDoCard = {
    onMover: mover,
    onLink: (id: string, link: string) => gravar(editarCard(store, id, { link: link.trim() || undefined }, Date.now())),
    onObs: (id: string, obs: string) => gravar(editarCard(store, id, { observacao: obs.trim() || undefined }, Date.now())),
    onQtd: (id: string, qtd: number | undefined) => gravar(editarCard(store, id, { quantidade: quantidadeValida(qtd) ? qtd : undefined }, Date.now())),
    onEditar: (c: CardRoteiro) => setForm({ editando: c }),
    onArquivar: (id: string) => gravar(arquivarCard(store, id, Date.now())),
    onRestaurar: (id: string) => gravar(restaurarCard(store, id, Date.now())),
    onExcluir: (c: CardRoteiro) => {
      if (window.confirm(`Excluir o card "${nomeDoCard(c, nomeDoCliente)}"? Não dá para desfazer. Para guardar, use Arquivar.`)) gravar(excluirCard(store, c.id))
    },
  }

  return (
    <Box sx={{ p: { xs: 1.5, md: 2.5, xl: 3.5 }, maxWidth: { xl: 1800 }, mx: 'auto' }}>
      {/* Cabeçalho */}
      <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 1.5, flexWrap: 'wrap', mb: 2 }}>
        <Box sx={{ flex: 1, minWidth: 240 }}>
          <Typography sx={{ fontFamily: DS.fontDisplay, textTransform: 'uppercase', fontSize: { xs: '1.5rem', md: '1.9rem', xl: '2.3rem' }, color: DS.t1, lineHeight: 1 }}>
            Roteiros
          </Typography>
          <Typography sx={{ fontSize: { xs: '0.78rem', xl: '0.88rem' }, color: DS.t2, mt: 0.4 }}>
            O roteiro de cada cliente no mês, de "A fazer" para "Prontos". Cliente novo entra sozinho.
          </Typography>
        </Box>
        <Button variant="contained" size="small" onClick={() => setForm({})}
          sx={{ height: 36, px: 2.2, borderRadius: '9px', fontSize: '0.82rem', fontWeight: 800, textTransform: 'none' }}>
          + Novo roteiro
        </Button>
      </Box>

      {/* Filtros */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2, flexWrap: 'wrap', mb: 1.6, p: 1, borderRadius: '12px', bgcolor: DS.surface, border: `1px solid ${DS.border}` }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4 }}>
          <IconButton size="small" aria-label="Mês anterior" onClick={() => andarMes(-1)} sx={{ color: DS.t1 }}><ChevronLeftIcon /></IconButton>
          <Typography sx={{ minWidth: 160, textAlign: 'center', fontWeight: 800, color: DS.t1, fontSize: { xs: '0.9rem', xl: '1.05rem' } }}>{rotuloMes(mes)}</Typography>
          <IconButton size="small" aria-label="Próximo mês" onClick={() => andarMes(1)} sx={{ color: DS.t1 }}><ChevronRightIcon /></IconButton>
          {(ano !== now.getFullYear() || mesIdx !== now.getMonth()) && (
            <Button size="small" onClick={() => { setAno(now.getFullYear()); setMesIdx(now.getMonth()) }} sx={{ textTransform: 'none', fontWeight: 700, color: DS.accent }}>Este mês</Button>
          )}
        </Box>
        <Box sx={{ display: 'flex', gap: 0.4, p: 0.4, borderRadius: '10px', bgcolor: DS.field }}>
          {([['todos', 'Todos'], ['fixos', 'Clientes fixos'], ['freelancer', 'Freelancer']] as const).map(([t, r]) => (
            <Box key={t} {...clickable(() => setTipo(t))} aria-pressed={tipo === t} sx={pill(tipo === t)}>{r}</Box>
          ))}
        </Box>
        <TextField size="small" value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar cliente ou projeto…" sx={{ width: { xs: 180, md: 240 }, ...CAMPO }} />
        <Box sx={{ flex: 1 }} />
        <Box {...clickable(() => setArquivados(v => !v))} aria-pressed={arquivados} sx={{ ...pill(arquivados), border: `1px solid ${arquivados ? DS.accent : DS.border}` }}>
          {arquivados ? '← Voltar à esteira' : `Arquivados (${Object.values(store).filter(c => c.mes === mes && c.status === 'arquivado').length})`}
        </Box>
      </Box>

      {arquivados ? (
        cards.length === 0 ? (
          <Box sx={{ py: 8, textAlign: 'center', border: `1px dashed ${DS.border}`, borderRadius: '14px' }}>
            <Typography sx={{ color: DS.t2 }}>Nenhum card arquivado em {rotuloMes(mes).toLowerCase()}.</Typography>
          </Box>
        ) : (
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr', xl: 'repeat(3, 1fr)' }, gap: 1 }}>
            {cards.map(c => <CardEsteira key={c.id} c={c} tipoDoCliente={tipoDoCliente} acoes={acoesDoCard} />)}
          </Box>
        )
      ) : (
        <DndContext sensors={sensors} collisionDetection={colisao} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setAtivo(null)}>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 1.6, alignItems: 'start' }}>
            {COLUNAS.map(col => (
              <Coluna key={col.status} status={col.status} titulo={col.titulo} n={porColuna(col.status).length}
                onNovo={col.status === 'a_fazer' ? () => setForm({}) : undefined}>
                {porColuna(col.status).map(c => (
                  <Arrastavel key={c.id} id={c.id}>
                    <CardEsteira c={c} tipoDoCliente={tipoDoCliente} acoes={acoesDoCard} />
                  </Arrastavel>
                ))}
              </Coluna>
            ))}
          </Box>
          <DragOverlay dropAnimation={null}>
            {ativo && store[ativo] && (
              <Box sx={{ opacity: 0.9, transform: 'rotate(2deg)' }}>
                <CardEsteira c={store[ativo]} tipoDoCliente={tipoDoCliente} acoes={acoesDoCard} />
              </Box>
            )}
          </DragOverlay>
        </DndContext>
      )}

      <FormRoteiro aberto={!!form} editando={form?.editando} clients={clients} mesPadrao={mes}
        onClose={() => setForm(null)}
        onSalvar={(n, id) => {
          const agora = Date.now()
          if (id) {
            gravar(editarCard(store, id, {
              tipo: n.tipo, mes: n.mes, prazo: n.prazo || undefined, link: n.link?.trim() || undefined,
              quantidade: quantidadeValida(n.quantidade) ? n.quantidade : undefined,
              observacao: n.observacao?.trim() || undefined, responsavel: n.responsavel || RESPONSAVEL_PADRAO,
              clienteId: n.tipo === 'fixo' ? n.clienteId : undefined, nomeLivre: n.tipo === 'freelancer' ? n.nomeLivre?.trim() : undefined,
            }, agora))
          } else {
            gravar(criarCard(store, n, agora).store)
          }
          setForm(null)
        }} />

      <Snackbar open={!!aviso} autoHideDuration={6000} onClose={() => setAviso(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity="warning" onClose={() => setAviso(null)} sx={{ fontSize: '0.8rem' }}>{aviso}</Alert>
      </Snackbar>
    </Box>
  )
}

function Coluna({ status, titulo, n, onNovo, children }: { status: string; titulo: string; n: number; onNovo?: () => void; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: `col-${status}` })
  return (
    <Box ref={setNodeRef} sx={{
      borderRadius: '14px', bgcolor: DS.surface, border: `1px solid ${isOver ? DS.accent : DS.border}`,
      p: 1, minHeight: 160, transition: 'border-color 0.18s ease',
    }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 0.6, pb: 1 }}>
        <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: status === 'pronto' ? DS.green : DS.t3 }} />
        <Typography sx={{ fontSize: { xs: '0.78rem', xl: '0.88rem' }, fontWeight: 800, color: DS.t1, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{titulo}</Typography>
        <Typography sx={{ fontSize: { xs: '0.78rem', xl: '0.88rem' }, fontWeight: 800, color: DS.t3 }}>{n}</Typography>
        <Box sx={{ flex: 1 }} />
        {onNovo && <Button size="small" onClick={onNovo} sx={{ textTransform: 'none', fontWeight: 700, color: DS.accent, minWidth: 0 }}>+ Novo</Button>}
      </Box>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.8 }}>
        {n === 0 && <Typography sx={{ fontSize: '0.74rem', color: DS.t4, textAlign: 'center', py: 3 }}>Arraste um card para cá</Typography>}
        {children}
      </Box>
    </Box>
  )
}

function Arrastavel({ id, children }: { id: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id })
  return (
    <Box ref={setNodeRef} {...attributes} {...listeners}
      sx={{ transform: CSS.Translate.toString(transform), opacity: isDragging ? 0.35 : 1, willChange: isDragging ? 'transform' : undefined, touchAction: 'manipulation' }}>
      {children}
    </Box>
  )
}

function CardEsteira({ c, tipoDoCliente, acoes }: {
  c: CardRoteiro
  tipoDoCliente: (id: string) => 'mensal' | 'freelancer'
  acoes: {
    onMover: (id: string, para: 'a_fazer' | 'pronto') => void
    onLink: (id: string, link: string) => void
    onObs: (id: string, obs: string) => void
    onQtd: (id: string, qtd: number | undefined) => void
    onEditar: (c: CardRoteiro) => void
    onArquivar: (id: string) => void
    onRestaurar: (id: string) => void
    onExcluir: (c: CardRoteiro) => void
  }
}) {
  const [menu, setMenu] = useState<HTMLElement | null>(null)
  const [link, setLink] = useState(c.link ?? '')
  const [obs, setObs] = useState(c.observacao ?? '')
  const [qtd, setQtd] = useState(c.quantidade ? String(c.quantidade) : '')
  useEffect(() => { setQtd(c.quantidade ? String(c.quantidade) : '') }, [c.quantidade])
  // O card mudou por fora (sync, outra pessoa): os campos acompanham.
  useEffect(() => { setLink(c.link ?? '') }, [c.link])
  useEffect(() => { setObs(c.observacao ?? '') }, [c.observacao])

  const nome = nomeDoCard(c, nomeDoCliente)
  const free = ehFreelancer(c, tipoDoCliente)
  const pronto = c.status === 'pronto'
  const arquivado = c.status === 'arquivado'
  const prazoVencido = !pronto && !!c.prazo && c.prazo < new Date().toISOString().slice(0, 10)
  const parar = { onPointerDown: (e: React.PointerEvent) => e.stopPropagation(), onKeyDown: (e: React.KeyboardEvent) => e.stopPropagation() }

  return (
    <Box sx={{
      p: { xs: 1.2, xl: 1.5 }, borderRadius: '11px', bgcolor: DS.surfaceAlt, border: `1px solid ${DS.border}`,
      borderLeft: `3px solid ${pronto ? DS.green : arquivado ? DS.t4 : DS.accent}`, cursor: arquivado ? 'default' : 'grab',
    }}>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
        <Box sx={{ width: 32, height: 32, borderRadius: '8px', bgcolor: DS.field, border: `1px solid ${DS.border}`, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
          <Typography sx={{ fontWeight: 900, fontSize: '0.9rem', color: DS.t1 }}>{nome.charAt(0).toUpperCase()}</Typography>
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, flexWrap: 'wrap' }}>
            <Typography sx={{ fontSize: { xs: '0.9rem', xl: '1rem' }, fontWeight: 800, color: DS.t1 }}>{nome}</Typography>
            {free && (
              <Box sx={{ px: 0.8, py: '1px', borderRadius: '6px', bgcolor: `${DS.amber}22`, border: `1px solid ${DS.amber}66` }}>
                <Typography sx={{ fontSize: '0.6rem', fontWeight: 800, color: DS.amber, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Freelancer</Typography>
              </Box>
            )}
          </Box>
          <Typography sx={{ fontSize: '0.68rem', color: DS.t3, mt: 0.2 }}>
            {rotuloMes(c.mes)} · entrou {dataCurta(c.entradaEm)}{c.origem === 'automatico' ? ' (automático)' : ''}
          </Typography>
        </Box>
        <IconButton size="small" aria-label="Mais ações" onPointerDown={e => e.stopPropagation()} onClick={e => setMenu(e.currentTarget)} sx={{ color: DS.t3, p: 0.4 }}>
          <MoreHorizIcon fontSize="small" />
        </IconButton>
        <Menu anchorEl={menu} open={!!menu} onClose={() => setMenu(null)}>
          {!arquivado && <MenuItem onClick={() => { setMenu(null); acoes.onEditar(c) }} sx={{ fontSize: '0.8rem' }}>Editar</MenuItem>}
          {!arquivado && <MenuItem onClick={() => { setMenu(null); acoes.onArquivar(c.id) }} sx={{ fontSize: '0.8rem' }}>Arquivar</MenuItem>}
          {arquivado && <MenuItem onClick={() => { setMenu(null); acoes.onRestaurar(c.id) }} sx={{ fontSize: '0.8rem' }}>Restaurar</MenuItem>}
          {c.origem === 'manual' && <MenuItem onClick={() => { setMenu(null); acoes.onExcluir(c) }} sx={{ fontSize: '0.8rem', color: DS.redSoft }}>Excluir</MenuItem>}
        </Menu>
      </Box>

      <Box sx={{ display: 'flex', gap: 1.4, flexWrap: 'wrap', mt: 1 }}>
        <Info rotulo="Prazo" valor={c.prazo ? c.prazo.split('-').reverse().slice(0, 2).join('/') : '—'} cor={prazoVencido ? DS.red : undefined} />
        <Info rotulo="Roteiros" valor={c.quantidade ? String(c.quantidade) : '—'} />
        <Info rotulo="Responsável" valor={nomePessoa(c.responsavel)} />
        {c.prontoEm && <Info rotulo="Pronto em" valor={dataHora(c.prontoEm)} cor={DS.green} />}
      </Box>

      {/* Link do roteiro (colar e abrir) + quantidade de roteiros */}
      <Box sx={{ display: 'flex', gap: 0.6, mt: 1 }} {...parar}>
        <TextField size="small" fullWidth value={link} disabled={arquivado} placeholder="Cole o link do roteiro (Docs/Drive)"
          onChange={e => setLink(e.target.value)} onBlur={() => { if (link.trim() !== (c.link ?? '')) acoes.onLink(c.id, link) }}
          error={!!link.trim() && !linkValido(link)}
          sx={{ '& .MuiInputBase-root': { fontSize: '0.74rem', height: 32, bgcolor: DS.field, borderRadius: '8px' } }} />
        <Tooltip title={linkValido(c.link) ? 'Abrir o roteiro' : 'Sem link'}>
          <span>
            <IconButton size="small" disabled={!linkValido(c.link)} onClick={() => window.open(c.link, '_blank', 'noopener')}
              sx={{ border: `1px solid ${DS.border}`, borderRadius: '8px', color: DS.accent }}>
              <OpenInNewIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title="Quantidade de roteiros">
          <TextField size="small" value={qtd} disabled={arquivado} placeholder="Qtd."
            onChange={e => setQtd(e.target.value.replace(/\D/g, '').slice(0, 3))}
            onBlur={() => { const n = qtd ? Number(qtd) : undefined; if (n !== c.quantidade) acoes.onQtd(c.id, n) }}
            slotProps={{ htmlInput: { inputMode: 'numeric', 'aria-label': 'Quantidade de roteiros' } }}
            sx={{ width: 72, flexShrink: 0, '& .MuiInputBase-root': { fontSize: '0.74rem', height: 32, bgcolor: DS.field, borderRadius: '8px' } }} />
        </Tooltip>
      </Box>
      <Box sx={{ mt: 0.8 }} {...parar}>
        <TextField size="small" fullWidth multiline maxRows={4} value={obs} disabled={arquivado} placeholder="Observação (opcional)"
          onChange={e => setObs(e.target.value)} onBlur={() => { if (obs.trim() !== (c.observacao ?? '')) acoes.onObs(c.id, obs) }}
          sx={{ '& .MuiInputBase-root': { fontSize: '0.74rem', bgcolor: DS.field, borderRadius: '8px' } }} />
      </Box>

      {!arquivado && (
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1 }} {...parar}>
          {pronto
            ? <Button size="small" onClick={() => acoes.onMover(c.id, 'a_fazer')} sx={{ textTransform: 'none', fontWeight: 700, color: DS.t2 }}>Voltar para a fazer</Button>
            : <Button size="small" variant="contained" onClick={() => acoes.onMover(c.id, 'pronto')} sx={{ textTransform: 'none', fontWeight: 800 }}>Marcar como pronto</Button>}
        </Box>
      )}
    </Box>
  )
}

function Info({ rotulo, valor, cor }: { rotulo: string; valor: string; cor?: string }) {
  return (
    <Box>
      <Typography sx={{ fontSize: '0.58rem', fontWeight: 700, color: DS.t3, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{rotulo}</Typography>
      <Typography sx={{ fontSize: '0.74rem', fontWeight: 700, color: cor ?? DS.t1 }}>{valor}</Typography>
    </Box>
  )
}

function FormRoteiro({ aberto, editando, clients, mesPadrao, onClose, onSalvar }: {
  aberto: boolean
  editando?: CardRoteiro
  clients: string[]
  mesPadrao: string
  onClose: () => void
  onSalvar: (n: NovoCardRoteiro, id?: string) => void
}) {
  const [n, setN] = useState<NovoCardRoteiro>({ tipo: 'fixo', mes: mesPadrao, responsavel: RESPONSAVEL_PADRAO })
  useEffect(() => {
    if (!aberto) return
    setN(editando
      ? { tipo: editando.tipo, clienteId: editando.clienteId, nomeLivre: editando.nomeLivre, mes: editando.mes, prazo: editando.prazo, link: editando.link, quantidade: editando.quantidade, observacao: editando.observacao, responsavel: editando.responsavel }
      : { tipo: 'fixo', mes: mesPadrao, responsavel: RESPONSAVEL_PADRAO })
  }, [aberto, editando, mesPadrao])

  const pode = !!n.mes && (n.tipo === 'fixo' ? !!n.clienteId : !!n.nomeLivre?.trim()) && (!n.link?.trim() || linkValido(n.link))
  const set = (p: Partial<NovoCardRoteiro>) => setN(v => ({ ...v, ...p }))

  return (
    <Dialog open={aberto} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ pb: 0.5 }}>
        <Typography sx={{ fontFamily: DS.fontDisplay, textTransform: 'uppercase', fontSize: '1.2rem', color: DS.t1 }}>{editando ? 'Editar roteiro' : 'Novo roteiro'}</Typography>
      </DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.6, pt: '12px !important' }}>
        <Box sx={{ display: 'flex', gap: 0.8 }}>
          {([['fixo', 'Cliente fixo'], ['freelancer', 'Freelancer / Avulso']] as const).map(([t, r]) => (
            <Box key={t} {...clickable(() => set({ tipo: t }))} aria-pressed={n.tipo === t} sx={{
              flex: 1, py: 1, textAlign: 'center', borderRadius: '9px', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 800,
              border: `1px solid ${n.tipo === t ? DS.accent : DS.border}`, bgcolor: n.tipo === t ? `${DS.accent}14` : DS.surfaceAlt,
              color: n.tipo === t ? DS.accent : DS.t1,
            }}>{r}</Box>
          ))}
        </Box>
        {n.tipo === 'fixo' ? (
          <TextField select size="small" label="Cliente" value={n.clienteId ?? ''} onChange={e => set({ clienteId: e.target.value })}>
            {clients.map(c => <MenuItem key={c} value={c} sx={{ fontSize: '0.8rem' }}>{nomeDoCliente(c)}</MenuItem>)}
          </TextField>
        ) : (
          <TextField size="small" label="Nome do cliente ou projeto" value={n.nomeLivre ?? ''} onChange={e => set({ nomeLivre: e.target.value })}
            helperText="Não precisa estar cadastrado na aba Clientes." />
        )}
        <Box sx={{ display: 'flex', gap: 1.2, flexWrap: 'wrap' }}>
          <TextField size="small" type="month" label="Mês de referência" value={n.mes} onChange={e => set({ mes: e.target.value })}
            slotProps={{ inputLabel: { shrink: true } }} sx={{ flex: 1, minWidth: 160, '& input': { colorScheme: 'dark' } }} />
          <TextField size="small" type="date" label="Prazo (opcional)" value={n.prazo ?? ''} onChange={e => set({ prazo: e.target.value || undefined })}
            slotProps={{ inputLabel: { shrink: true } }} sx={{ flex: 1, minWidth: 160, '& input': { colorScheme: 'dark' } }} />
        </Box>
        <TextField size="small" label="Link do roteiro (opcional)" value={n.link ?? ''} onChange={e => set({ link: e.target.value })}
          placeholder="https://docs.google.com/…" error={!!n.link?.trim() && !linkValido(n.link)}
          helperText={!!n.link?.trim() && !linkValido(n.link) ? 'Cole o link completo, começando com https://' : ' '} />
        <TextField size="small" label="Quantidade de roteiros (opcional)" value={n.quantidade ?? ''}
          onChange={e => { const v = e.target.value.replace(/\D/g, '').slice(0, 3); set({ quantidade: v ? Number(v) : undefined }) }}
          slotProps={{ htmlInput: { inputMode: 'numeric' } }} placeholder="Ex.: 8" />
        <TextField size="small" label="Observação (opcional)" multiline minRows={2} value={n.observacao ?? ''} onChange={e => set({ observacao: e.target.value })} />
        <TextField select size="small" label="Responsável" value={n.responsavel ?? RESPONSAVEL_PADRAO} onChange={e => set({ responsavel: e.target.value })}>
          {Object.keys(NAME_MAP).map(u => <MenuItem key={u} value={u} sx={{ fontSize: '0.8rem' }}>{nomePessoa(u)}</MenuItem>)}
        </TextField>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button variant="outlined" onClick={onClose} sx={{ color: DS.t1, borderColor: DS.border }}>Cancelar</Button>
        <Button variant="contained" disabled={!pode} onClick={() => onSalvar(n, editando?.id)}>{editando ? 'Salvar' : 'Criar roteiro'}</Button>
      </DialogActions>
    </Dialog>
  )
}
