/**
 * Painel lateral de um conteúdo, aberto pelo Calendário. Edita o MESMO card da
 * Produção — não há base paralela: o que muda aqui muda lá, e vice-versa.
 *
 * Campos: cliente, nome, tipo, data e hora de publicação, etapa, observação e
 * etiquetas. A data de entrega não se edita aqui: quem decide é a fila
 * inteligente (lib/datasEntrega) — mudar a publicação recoloca o card na fila.
 */
import { useEffect, useState } from 'react'
import { Autocomplete, Box, Button, Chip, Drawer, IconButton, MenuItem, TextField, Typography } from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import type { ContentItem, ContentType, ItemState, Status } from '../../types'
import { STATUS_CONFIG } from '../../types'
import { DS } from '../../theme'
import { horaValida, postagemDoCard } from '../../lib/programacao'
import EscolherQuando, { dataInput } from './EscolherQuando'

const TIPOS: { tp: ContentType; rotulo: string }[] = [
  { tp: 'Reel', rotulo: 'Reel' }, { tp: 'Post', rotulo: 'Post Design' }, { tp: 'Feed', rotulo: 'Post Feed' },
  { tp: 'Carrossel', rotulo: 'Carrossel' }, { tp: 'Story', rotulo: 'Story' },
]
/** Etapas na ordem da esteira (o 8 aposentado fica de fora). */
const ETAPAS: Status[] = [0, 1, 2, 6, 3, 4, 5, 9 as Status, 7]

export interface EdicaoConteudo {
  cliente?: string
  nome?: string
  tipo?: ContentType
  data?: Date
  hora?: string
  status?: Status
  notas?: string
  etiquetas?: string[]
}

export default function EditarConteudoPainel({ item, st, clientes, podeTrocarCliente, etiquetasConhecidas, onClose, onSalvar }: {
  item: ContentItem | null
  st: ItemState | undefined
  clientes: string[]
  /** Só card criado à mão troca de cliente (os semeados de jun/jul vêm do código). */
  podeTrocarCliente: boolean
  etiquetasConhecidas: string[]
  onClose: () => void
  onSalvar: (id: number, e: EdicaoConteudo) => void
}) {
  const [cliente, setCliente] = useState('')
  const [nome, setNome] = useState('')
  const [tipo, setTipo] = useState<ContentType>('Reel')
  const [data, setData] = useState('')
  const [hora, setHora] = useState('')
  const [status, setStatus] = useState<Status>(0)
  const [notas, setNotas] = useState('')
  const [etiquetas, setEtiquetas] = useState<string[]>([])

  useEffect(() => {
    if (!item) return
    setCliente(item.c)
    setNome(st?.title || item.n)
    setTipo(item.tp)
    setData(dataInput(item.dt))
    setHora(postagemDoCard(item, st).hora ?? '')
    setStatus((st?.status ?? item.s) as Status)
    setNotas(st?.notes ?? '')
    setEtiquetas(st?.tags ?? [])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.i])

  if (!item) return null
  const [a, m, d] = data.split('-').map(Number)
  const novaData = a && m && d ? new Date(a, m - 1, d, item.dt.getHours() || 12, item.dt.getMinutes()) : item.dt

  const salvar = () => {
    const e: EdicaoConteudo = {}
    if (cliente && cliente !== item.c) e.cliente = cliente
    if (nome.trim() && nome.trim() !== (st?.title || item.n)) e.nome = nome.trim()
    if (tipo !== item.tp) e.tipo = tipo
    if (dataInput(novaData) !== dataInput(item.dt)) e.data = novaData
    if (hora !== (postagemDoCard(item, st).hora ?? '') && (hora === '' || horaValida(hora))) e.hora = hora
    if (status !== (st?.status ?? item.s)) e.status = status
    if (notas !== (st?.notes ?? '')) e.notas = notas
    if (JSON.stringify(etiquetas) !== JSON.stringify(st?.tags ?? [])) e.etiquetas = etiquetas
    onSalvar(item.i, e)
    onClose()
  }

  return (
    <Drawer anchor="right" open={!!item} onClose={onClose}
      slotProps={{ paper: { sx: { width: { xs: '100vw', sm: 440, xl: 520 }, bgcolor: DS.bg, borderLeft: `1px solid ${DS.border}`, backgroundImage: 'none' } } }}>
      <Box sx={{ p: 2.4, display: 'flex', flexDirection: 'column', gap: 2, minHeight: '100%' }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontSize: '0.62rem', fontWeight: 900, letterSpacing: '0.14em', color: DS.accent }}>CONTEÚDO</Typography>
            <Typography sx={{ fontSize: { xs: '1.05rem', xl: '1.2rem' }, fontWeight: 800, color: DS.t1, lineHeight: 1.25 }}>{st?.title || item.n}</Typography>
          </Box>
          <IconButton onClick={onClose} aria-label="Fechar" sx={{ color: DS.t2 }}><CloseIcon /></IconButton>
        </Box>

        <TextField select size="small" label="Cliente" value={cliente} onChange={e => setCliente(e.target.value)} disabled={!podeTrocarCliente}
          helperText={podeTrocarCliente ? undefined : 'Card do calendário original de jun/jul — o cliente não muda.'}
          slotProps={{ inputLabel: { shrink: true } }}>
          {[...new Set([item.c, ...clientes])].map(c => <MenuItem key={c} value={c} sx={{ fontSize: '0.8rem' }}>{c}</MenuItem>)}
        </TextField>
        <TextField size="small" label="Nome" value={nome} onChange={e => setNome(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
        <Box sx={{ display: 'flex', gap: 1.2 }}>
          <TextField select size="small" label="Tipo" value={tipo} onChange={e => setTipo(e.target.value as ContentType)} sx={{ flex: 1 }}
            slotProps={{ inputLabel: { shrink: true } }}>
            {TIPOS.map(t => <MenuItem key={t.tp} value={t.tp} sx={{ fontSize: '0.8rem' }}>{t.rotulo}</MenuItem>)}
          </TextField>
          <TextField select size="small" label="Etapa" value={status} onChange={e => setStatus(Number(e.target.value) as Status)} sx={{ flex: 1 }}
            slotProps={{ inputLabel: { shrink: true } }}>
            {ETAPAS.map(s => <MenuItem key={s} value={s} sx={{ fontSize: '0.8rem' }}>{STATUS_CONFIG[s]?.label ?? s}</MenuItem>)}
          </TextField>
        </Box>

        <Box>
          <Typography sx={{ fontSize: '0.62rem', fontWeight: 800, letterSpacing: '0.1em', color: DS.t3, mb: 0.8 }}>PUBLICAÇÃO</Typography>
          <EscolherQuando data={data} hora={hora} onData={setData} onHora={setHora} direcao="livre" />
          <Typography sx={{ fontSize: '0.72rem', color: DS.t2, mt: 1 }}>
            Entrega: {st?.deliveryDate
              ? <b style={{ color: DS.t1 }}>{new Date(st.deliveryDate).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' })}</b>
              : <b style={{ color: DS.t3 }}>sem data</b>}
            {' '}— definida pela fila de entrega (a publicação mais próxima entrega primeiro)
          </Typography>
        </Box>

        <TextField size="small" label="Observação" value={notas} onChange={e => setNotas(e.target.value)} multiline minRows={3}
          slotProps={{ inputLabel: { shrink: true } }} />

        <Autocomplete multiple freeSolo size="small" options={etiquetasConhecidas} value={etiquetas}
          onChange={(_, v) => setEtiquetas([...new Set(v.map(x => String(x).trim()).filter(Boolean))])}
          renderTags={(v, getTagProps) => v.map((opt, i) => {
            const { key, ...rest } = getTagProps({ index: i })
            return <Chip key={key} {...rest} label={opt} size="small" sx={{ fontSize: '0.7rem', fontWeight: 700 }} />
          })}
          renderInput={p => <TextField {...p} label="Etiquetas" placeholder="Digite e Enter" slotProps={{ inputLabel: { shrink: true } }} />} />

        <Box sx={{ flex: 1 }} />
        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
          <Button onClick={onClose} sx={{ color: DS.t2 }}>Cancelar</Button>
          <Button variant="contained" onClick={salvar}>Salvar</Button>
        </Box>
      </Box>
    </Drawer>
  )
}
