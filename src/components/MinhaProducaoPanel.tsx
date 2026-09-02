/* MinhaProducaoPanel — "quantos vídeos eu fiz hoje, e no mês".

   O painel media tudo que está PARADO e nada do que foi FEITO. Este é o
   contrapeso: o número sobe quando o trabalho sai, não quando ele entra.

   A conta vem de `lib/producaoEditor.ts` e é deduzida dos carimbos que o card
   já tem — não há registro novo a alimentar, então o histórico conta desde o
   primeiro dia em que a tela existe.
*/
import { useEffect, useMemo, useState } from 'react'
import {
  Box, Paper, Typography, Tooltip, Collapse, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, MenuItem, Button, IconButton,
} from '@mui/material'
import MovieCreationIcon from '@mui/icons-material/MovieCreation'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import AddIcon from '@mui/icons-material/Add'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import type { Client, ContentItem, ContentType, ItemState } from '../types'
import { ALL_TYPES } from './producao/shared'
import {
  entregasDoAutor, resumoDoDia, resumoDoMes, serieDiaria, melhorDia,
  mediaPorDiaTrabalhado, chaveDoDia, MOTIVO_LABEL, adicionarManual, removerManual,
  carregarManuais, salvarManuais, type Entrega, type EntregaManual,
} from '../lib/producaoEditor'
import { carregarPaineis, carregarAtribuicoes } from '../lib/paineis'
import { getDisplayName, NAME_MAP } from '../lib/users'
import { clickable } from '../shared/a11y'
import { DS } from '../theme'

interface Props {
  items: ContentItem[]
  states: Record<number, ItemState>
  currentUser: string
  now: Date
  /** Para o seletor de cliente do registro manual. */
  allClients?: Client[]
}

const DIAS_NA_SERIE = 14

function nomeCurtoDoDia(chave: string): string {
  const [a, m, d] = chave.split('-').map(Number)
  return new Date(a, m - 1, d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

/* Número grande com a subida do `countUp`. A `key` muda junto com o valor: sem
   ela o React reaproveita o nó, a animação não reinicia e o número troca seco. */
function Numero({ valor, cor }: { valor: number; cor: string }) {
  return (
    <Typography
      key={valor}
      sx={{
        fontWeight: 900, lineHeight: 1, color: cor,
        fontSize: { xs: '2rem', md: '2.4rem', xl: '2.9rem' },
        letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums',
        animation: 'countUp 0.45s cubic-bezier(0.16,1,0.3,1) both',
      }}
    >
      {valor}
    </Typography>
  )
}

function Metrica({ label, valor, cor, detalhe }: {
  label: string; valor: number; cor: string; detalhe?: string
}) {
  return (
    <Box sx={{ flex: 1, minWidth: { xs: 96, sm: 116 } }}>
      <Typography sx={{
        fontSize: { xs: '0.55rem', xl: '0.63rem' }, color: DS.t2, fontWeight: 800,
        textTransform: 'uppercase', letterSpacing: '0.09em', mb: 0.5,
      }}>
        {label}
      </Typography>
      <Numero valor={valor} cor={cor} />
      {detalhe && (
        <Typography sx={{ fontSize: { xs: '0.58rem', xl: '0.66rem' }, color: DS.t3, mt: 0.35 }}>
          {detalhe}
        </Typography>
      )}
    </Box>
  )
}

export default function MinhaProducaoPanel({ items, states, currentUser, now, allClients }: Props) {
  const [aberto, setAberto] = useState(false)
  const [manuais, setManuais] = useState<EntregaManual[]>(() => carregarManuais())
  const [formAberto, setFormAberto] = useState(false)

  /* O estado é lido uma vez no mount. `sm_producao_manual` sincroniza, então
     um registro feito no celular chega pelo poll enquanto esta tela está
     aberta — sem isto ele só apareceria no próximo F5. */
  useEffect(() => {
    const recarregar = () => setManuais(carregarManuais())
    window.addEventListener('ds:producaoManual', recarregar)
    return () => window.removeEventListener('ds:producaoManual', recarregar)
  }, [])

  // As gavetas moram no localStorage e mudam por gesto na tela, não por prop —
  // reler a cada mudança de `states` mantém a conta em dia sem canal novo.
  const { entregas, semData } = useMemo(() => {
    if (!currentUser) return { entregas: [] as Entrega[], semData: 0 }
    return entregasDoAutor(items, states, carregarAtribuicoes(), carregarPaineis(), currentUser, {}, manuais)
  }, [items, states, currentUser, manuais])

  const gravar = (lista: EntregaManual[]) => { setManuais(lista); salvarManuais(lista) }
  const apagarManual = (id: string) => gravar(removerManual(manuais, id))

  const hoje  = useMemo(() => resumoDoDia(entregas, now), [entregas, now])
  const mes   = useMemo(() => resumoDoMes(entregas, now), [entregas, now])
  const serie = useMemo(() => serieDiaria(entregas, now, DIAS_NA_SERIE), [entregas, now])
  const recorde = useMemo(() => melhorDia(entregas), [entregas])
  const media = useMemo(() => mediaPorDiaTrabalhado(mes.entregas), [mes.entregas])

  const info = NAME_MAP[currentUser]
  const cor = info?.color ?? DS.accent
  const pico = Math.max(1, ...serie.map(d => d.n))

  const topClientes = useMemo(
    () => Object.entries(mes.porCliente).sort((a, b) => b[1] - a[1]).slice(0, 3),
    [mes.porCliente],
  )

  /* Sem nenhuma entrega, o painel inteiro com quatro zeros ocuparia o topo do
     Meu Dia sem dizer nada. Mas sumir de vez tirava também o botão de
     registrar — e quem mais precisa dele é justamente quem ainda não tem
     nada contado. Fica uma faixa fina com a porta de entrada. */
  if (entregas.length === 0 && semData === 0) {
    return (
      <>
        <Paper sx={{
          mb: 2.25, px: 2, py: 1.3, display: 'flex', alignItems: 'center', gap: 1.2,
          border: `1px solid ${DS.border}`, borderRadius: 3, bgcolor: DS.surface,
        }}>
          <MovieCreationIcon sx={{ fontSize: 17, color: DS.t3, flexShrink: 0 }} />
          <Typography sx={{ fontSize: '0.7rem', color: DS.t2, flex: 1, minWidth: 0 }}>
            Nenhuma entrega contada ainda neste mês.
          </Typography>
          <BotaoRegistrar onClick={() => setFormAberto(true)} />
        </Paper>
        <FormManual
          aberto={formAberto}
          onFechar={() => setFormAberto(false)}
          onSalvar={dados => { gravar(adicionarManual(manuais, { ...dados, autor: currentUser })); setFormAberto(false) }}
          clientes={allClients}
          itens={items}
          now={now}
        />
      </>
    )
  }

  const mesLabel = now.toLocaleDateString('pt-BR', { month: 'long' })

  return (
    <Paper sx={{
      position: 'relative', overflow: 'hidden', mb: 2.25, flexShrink: 0,
      px: { xs: 2, md: 2.5, xl: 3 }, py: { xs: 1.7, md: 2, xl: 2.3 },
      background: `linear-gradient(115deg, ${cor}0e 0%, ${DS.surface} 52%, ${DS.surfaceAlt} 100%)`,
      border: `1px solid ${cor}26`, borderRadius: 3,
      animation: 'fadeInUp 0.4s cubic-bezier(0.16,1,0.3,1) both',
    }}>
      {/* ── Cabeçalho ── */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.4, mb: 1.6 }}>
        <Box sx={{
          width: { xs: 34, md: 38 }, height: { xs: 34, md: 38 }, borderRadius: '11px', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: `${cor}18`, border: `1px solid ${cor}45`, color: cor,
        }}>
          <MovieCreationIcon sx={{ fontSize: 19 }} />
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{
            fontWeight: 800, color: DS.t1, letterSpacing: '-0.02em', lineHeight: 1.15,
            fontSize: { xs: '0.95rem', md: '1.05rem', xl: '1.2rem' },
          }}>
            Minha produção
          </Typography>
          <Typography sx={{ fontSize: { xs: '0.63rem', xl: '0.72rem' }, color: DS.t3 }}>
            O que {getDisplayName(currentUser)} entregou — conta ao detectar o export, ao finalizar e na aprovação do cliente
          </Typography>
        </Box>
        <Box sx={{ ml: 'auto', flexShrink: 0 }}>
          <BotaoRegistrar onClick={() => setFormAberto(true)} />
        </Box>
      </Box>

      {/* ── Os números ── */}
      <Box sx={{ display: 'flex', gap: { xs: 1.5, md: 2.5 }, flexWrap: 'wrap', mb: 2 }}>
        <Metrica label="Hoje" valor={hoje.total} cor={hoje.total > 0 ? DS.green : DS.t3}
          detalhe={hoje.total === 0 ? 'nada fechado ainda' : hoje.total === 1 ? '1 entrega' : `${hoje.total} entregas`} />
        <Metrica label={`Em ${mesLabel}`} valor={mes.total} cor={cor}
          detalhe={media > 0 ? `${media.toFixed(1)}/dia trabalhado` : undefined} />
        {recorde && (
          <Metrica label="Melhor dia" valor={recorde.n} cor={DS.purpleSoft}
            detalhe={nomeCurtoDoDia(recorde.dia)} />
        )}
        <Metrica label="Total registrado" valor={entregas.length} cor={DS.t2}
          detalhe={semData > 0 ? `+${semData} sem data` : undefined} />
      </Box>

      {/* ── Últimos 14 dias ── */}
      <Box sx={{ mb: topClientes.length > 0 ? 1.6 : 0 }}>
        <Typography sx={{
          fontSize: { xs: '0.55rem', xl: '0.62rem' }, color: DS.t3, fontWeight: 800,
          textTransform: 'uppercase', letterSpacing: '0.09em', mb: 0.8,
        }}>
          Últimos {DIAS_NA_SERIE} dias
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: { xs: 0.5, md: 0.7 }, height: 46 }}>
          {serie.map((d, i) => {
            const ehHoje = i === serie.length - 1
            return (
              <Tooltip key={d.dia} title={`${nomeCurtoDoDia(d.dia)} · ${d.n} ${d.n === 1 ? 'entrega' : 'entregas'}`}>
                <Box sx={{
                  flex: 1, minWidth: 0, borderRadius: '4px 4px 2px 2px',
                  // Barra zerada vira um traço, não some: dia vazio é informação.
                  height: d.n === 0 ? 3 : `${Math.max(12, (d.n / pico) * 100)}%`,
                  bgcolor: d.n === 0 ? DS.border : ehHoje ? DS.green : `${cor}bb`,
                  boxShadow: ehHoje && d.n > 0 ? `0 0 10px ${DS.green}55` : 'none',
                  transition: 'all 0.24s cubic-bezier(0.16,1,0.3,1)',
                  '&:hover': { filter: 'brightness(1.25)' },
                }} />
              </Tooltip>
            )
          })}
        </Box>
      </Box>

      {/* ── Por cliente, no mês ── */}
      {topClientes.length > 0 && (
        <Box sx={{ display: 'flex', gap: 0.7, flexWrap: 'wrap' }}>
          {topClientes.map(([cliente, n]) => (
            <Box key={cliente} sx={{
              px: 1, py: 0.4, borderRadius: '7px',
              bgcolor: `${cor}0f`, border: `1px solid ${cor}2e`,
              display: 'flex', alignItems: 'center', gap: 0.6,
            }}>
              <Typography sx={{ fontSize: { xs: '0.6rem', xl: '0.68rem' }, color: DS.t2, fontWeight: 600 }} noWrap>
                {cliente}
              </Typography>
              <Typography sx={{ fontSize: { xs: '0.6rem', xl: '0.68rem' }, color: cor, fontWeight: 800 }}>
                {n}
              </Typography>
            </Box>
          ))}
        </Box>
      )}

      {/* ── A lista, sob demanda ── */}
      {mes.entregas.length > 0 && (
        <Box sx={{ mt: 1.5, pt: 1.2, borderTop: `1px solid ${cor}1a` }}>
          <Box
            {...clickable(() => setAberto(v => !v))}
            aria-label={aberto ? 'Esconder as entregas do mês' : 'Ver as entregas do mês'}
            sx={{
              display: 'flex', alignItems: 'center', gap: 0.6, cursor: 'pointer',
              color: DS.t3, '&:hover': { color: DS.t1 }, transition: 'color 0.18s ease',
            }}
          >
            <ExpandMoreIcon sx={{
              fontSize: 16, transition: 'transform 0.2s ease',
              transform: aberto ? 'rotate(180deg)' : 'none',
            }} />
            <Typography sx={{ fontSize: { xs: '0.63rem', xl: '0.7rem' }, fontWeight: 700 }}>
              {aberto ? 'Esconder' : `Ver as ${mes.entregas.length} de ${mesLabel}`}
            </Typography>
          </Box>

          <Collapse in={aberto} unmountOnExit>
            <Box sx={{ mt: 1, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
              {mes.entregas.map(e => (
                /* `manualId` primeiro: registros à mão sem card recebem todos
                   itemId -1, e usar isso como chave dava chave duplicada — o
                   React reaproveita o nó errado e a linha some ou troca de lugar. */
                <Box key={e.manualId ?? e.itemId} sx={{
                  display: 'flex', alignItems: 'center', gap: 1,
                  px: 1, py: 0.6, borderRadius: '8px', bgcolor: DS.field,
                  border: `1px solid ${DS.border}`,
                }}>
                  <Typography sx={{ fontSize: '0.6rem', color: DS.t3, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                    {nomeCurtoDoDia(chaveDoDia(e.ts))}
                  </Typography>
                  <Typography sx={{ fontSize: { xs: '0.66rem', xl: '0.74rem' }, color: DS.t1, fontWeight: 600, minWidth: 0 }} noWrap>
                    {e.titulo}
                  </Typography>
                  <Typography sx={{ fontSize: '0.6rem', color: DS.t3, ml: 'auto', flexShrink: 0 }} noWrap>
                    {e.cliente}
                  </Typography>
                  <Tooltip title={MOTIVO_LABEL[e.motivo]}>
                    <Box sx={{
                      width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                      bgcolor: e.motivo === 'manual' ? DS.amber
                        : e.motivo === 'aprovado' || e.motivo === 'publicado' ? DS.green : cor,
                    }} />
                  </Tooltip>
                  {/* Só o que foi lançado à mão pode ser apagado aqui. O que
                      vem do card se corrige no card — apagar a dedução daria
                      um número que não bate com o board. */}
                  {e.manual && e.manualId && (
                    <Tooltip title="Remover este registro">
                      <IconButton
                        size="small"
                        aria-label={`Remover registro de ${e.titulo}`}
                        onClick={() => apagarManual(e.manualId!)}
                        sx={{ p: 0.3, flexShrink: 0, color: DS.t4, '&:hover': { color: DS.red } }}
                      >
                        <DeleteOutlineIcon sx={{ fontSize: 14 }} />
                      </IconButton>
                    </Tooltip>
                  )}
                </Box>
              ))}
            </Box>
          </Collapse>
        </Box>
      )}

      <FormManual
        aberto={formAberto}
        onFechar={() => setFormAberto(false)}
        onSalvar={dados => { gravar(adicionarManual(manuais, { ...dados, autor: currentUser })); setFormAberto(false) }}
        clientes={allClients}
        itens={items}
        now={now}
      />

      {/* Honestidade: entrega sem carimbo existe e não entra na conta por dia. */}
      {semData > 0 && (
        <Typography sx={{ mt: 1.2, fontSize: { xs: '0.58rem', xl: '0.65rem' }, color: DS.t4, lineHeight: 1.5 }}>
          {semData} {semData === 1 ? 'entrega não tem' : 'entregas não têm'} data registrada — {semData === 1 ? 'ela é' : 'elas são'} anterior
          {semData === 1 ? '' : 'es'} ao histórico do painel, então {semData === 1 ? 'aparece' : 'aparecem'} no total mas não no dia.
        </Typography>
      )}
    </Paper>
  )
}

/** O botão que abre o registro manual. Discreto: a conta automática é a regra. */
function BotaoRegistrar({ onClick }: { onClick: () => void }) {
  return (
    <Tooltip title="Registrar um vídeo que não apareceu aqui">
      <Box
        {...clickable(onClick)}
        aria-label="Registrar entrega manualmente"
        sx={{
          display: 'inline-flex', alignItems: 'center', gap: 0.4,
          px: 1, py: 0.5, borderRadius: '9px', cursor: 'pointer',
          border: `1px solid ${DS.border}`, bgcolor: DS.field,
          transition: 'all 0.18s ease',
          '&:hover': { borderColor: DS.borderHov, bgcolor: DS.surfaceAlt },
        }}
      >
        <AddIcon sx={{ fontSize: 14, color: DS.t2 }} />
        <Typography sx={{ fontSize: '0.63rem', fontWeight: 700, color: DS.t2, whiteSpace: 'nowrap' }}>
          Registrar
        </Typography>
      </Box>
    </Tooltip>
  )
}

/** Data de hoje no formato do `<input type="date">`, em horário local. */
function hojeInput(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * O formulário do registro manual.
 *
 * Pede o mínimo: cliente, título, tipo e o dia em que o trabalho foi feito.
 * O campo de card é opcional e existe por um motivo só — é ele que impede a
 * contagem dobrada quando o card for carimbado depois.
 */
function FormManual({ aberto, onFechar, onSalvar, clientes, itens, now }: {
  aberto: boolean
  onFechar: () => void
  onSalvar: (d: { cliente: string; titulo: string; tipo: ContentType; ts: number; itemId?: number }) => void
  clientes?: Client[]
  itens: ContentItem[]
  now: Date
}) {
  const [cliente, setCliente] = useState('')
  const [titulo, setTitulo]   = useState('')
  const [tipo, setTipo]       = useState<ContentType>('Reel')
  const [data, setData]       = useState(() => hojeInput(now))
  const [itemId, setItemId]   = useState<string>('')

  // A lista vem dos clientes cadastrados; se ela não chegar, cai nos clientes
  // que já aparecem nos itens — melhor um seletor menor que um campo vazio.
  const opcoes = useMemo(() => {
    const dos = clientes?.map(c => c.name) ?? []
    const dosItens = [...new Set(itens.map(i => i.c))]
    return [...new Set([...dos, ...dosItens])].sort((a, b) => a.localeCompare(b))
  }, [clientes, itens])

  // Cards do cliente escolhido, para poder amarrar o registro a um deles.
  const cards = useMemo(
    () => itens.filter(i => i.c === cliente).slice(0, 60),
    [itens, cliente],
  )

  const podeSalvar = !!cliente && !!titulo.trim() && !!data

  const salvar = () => {
    if (!podeSalvar) return
    onSalvar({
      cliente,
      titulo: titulo.trim(),
      tipo,
      // Meio-dia local: a data crua vira meia-noite UTC e escorrega um dia.
      ts: new Date(`${data}T12:00:00`).getTime(),
      itemId: itemId ? Number(itemId) : undefined,
    })
    setCliente(''); setTitulo(''); setTipo('Reel'); setItemId('')
  }

  return (
    <Dialog open={aberto} onClose={onFechar} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ pb: 0.5 }}>
        <Typography sx={{ fontSize: '0.95rem', fontWeight: 800, color: DS.t1 }}>
          Registrar entrega
        </Typography>
        <Typography sx={{ fontSize: '0.65rem', color: DS.t3, mt: 0.3 }}>
          Para o que você fez e não apareceu na conta automática.
        </Typography>
      </DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.6, pt: '10px !important' }}>
        <TextField
          select size="small" fullWidth label="Cliente"
          value={cliente} onChange={e => { setCliente(e.target.value); setItemId('') }}
        >
          {opcoes.map(c => (
            <MenuItem key={c} value={c} sx={{ fontSize: '0.75rem' }}>{c}</MenuItem>
          ))}
        </TextField>

        <TextField
          size="small" fullWidth label="O que foi feito"
          value={titulo} onChange={e => setTitulo(e.target.value)}
          placeholder="Ex.: Reel do lançamento"
        />

        <Box sx={{ display: 'flex', gap: 1.2 }}>
          <TextField
            select size="small" label="Tipo" value={tipo}
            onChange={e => setTipo(e.target.value as ContentType)}
            sx={{ flex: 1 }}
          >
            {ALL_TYPES.map(t => (
              <MenuItem key={t} value={t} sx={{ fontSize: '0.75rem' }}>{t}</MenuItem>
            ))}
          </TextField>
          <TextField
            size="small" type="date" label="Quando" value={data}
            onChange={e => setData(e.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
            sx={{ flex: 1 }}
          />
        </Box>

        {cards.length > 0 && (
          <TextField
            select size="small" fullWidth label="Card correspondente (opcional)"
            value={itemId} onChange={e => setItemId(e.target.value)}
            helperText="Amarrar a um card evita contar duas vezes se ele for carimbado depois."
            slotProps={{ formHelperText: { sx: { fontSize: '0.6rem', mx: 0, mt: 0.5 } } }}
          >
            <MenuItem value="" sx={{ fontSize: '0.75rem', color: DS.t3 }}>Nenhum</MenuItem>
            {cards.map(i => (
              <MenuItem key={i.i} value={String(i.i)} sx={{ fontSize: '0.75rem' }}>{i.n}</MenuItem>
            ))}
          </TextField>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 2.5, pb: 2, gap: 1 }}>
        <Button size="small" onClick={onFechar} sx={{ color: DS.t3 }}>Cancelar</Button>
        <Button size="small" variant="contained" onClick={salvar} disabled={!podeSalvar}>
          Registrar
        </Button>
      </DialogActions>
    </Dialog>
  )
}
