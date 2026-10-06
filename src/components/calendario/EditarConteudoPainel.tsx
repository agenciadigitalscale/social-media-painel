/**
 * Painel lateral de um conteúdo, aberto pelo Calendário. Edita o MESMO card da
 * Produção — não há base paralela: o que muda aqui muda lá, e vice-versa.
 *
 * Campos: cliente, nome, tipo, data e hora de postagem, data de entrega,
 * responsável, etapa, observação e etiquetas. Postagem e entrega são campos
 * independentes: a entrega pode ser fixada à mão; em branco, a fila de entrega
 * (lib/datasEntrega) decide.
 */
import { useEffect, useState } from 'react'
import { Autocomplete, Box, Button, Chip, Drawer, IconButton, MenuItem, TextField, Typography } from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import type { ContentItem, ContentType, ItemState, Status } from '../../types'
import { STATUS_CONFIG } from '../../types'
import { DS } from '../../theme'
import { horaValida, postagemDoCard } from '../../lib/programacao'
import { TIPOS_CRIACAO, rotuloDoTipo } from '../../lib/padraoEditorial'
import { corDaEtiqueta, type Etiqueta } from '../../lib/etiquetas'
import EscolherQuando, { dataInput } from './EscolherQuando'
import { ETAPAS_CONTEUDO, RESPONSAVEIS, nomeDe } from './equipe'

export interface EdicaoConteudo {
  cliente?: string
  nome?: string
  tipo?: ContentType
  data?: Date
  hora?: string
  status?: Status
  notas?: string
  etiquetas?: string[]
  /** null = volta para a fila de entrega decidir. */
  entrega?: Date | null
  responsavel?: string
}

const deInput = (v: string) => { const [a, m, d] = v.split('-').map(Number); return a && m && d ? new Date(a, m - 1, d, 12) : null }

export default function EditarConteudoPainel({ item, st, clientes, podeTrocarCliente, etiquetasBase, responsavelAtual, onClose, onSalvar, onArquivar, onExcluir }: {
  item: ContentItem | null
  st: ItemState | undefined
  clientes: string[]
  /** Só card criado à mão troca de cliente (os semeados de jun/jul vêm do código). */
  podeTrocarCliente: boolean
  /** Base global de etiquetas (com cor) + as já usadas nos cards. */
  etiquetasBase: Etiqueta[]
  /** Quem é o dono do card hoje (gaveta → editor → responsável). */
  responsavelAtual?: string
  onClose: () => void
  onSalvar: (id: number, e: EdicaoConteudo) => void
  /** Ausente = quem vê não pode arquivar/excluir este conteúdo. */
  onArquivar?: () => void
  onExcluir?: () => void
}) {
  const [cliente, setCliente] = useState('')
  const [nome, setNome] = useState('')
  const [tipo, setTipo] = useState<ContentType>('Reel')
  const [data, setData] = useState('')
  const [hora, setHora] = useState('')
  const [entrega, setEntrega] = useState('')
  const [responsavel, setResponsavel] = useState('')
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
    setEntrega(st?.deliveryDate ? dataInput(new Date(st.deliveryDate)) : '')
    setResponsavel(responsavelAtual ?? '')
    setStatus((st?.status ?? item.s) as Status)
    setNotas(st?.notes ?? '')
    setEtiquetas(st?.tags ?? [])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.i])

  if (!item) return null
  const [a, m, d] = data.split('-').map(Number)
  const novaData = a && m && d ? new Date(a, m - 1, d, item.dt.getHours() || 12, item.dt.getMinutes()) : item.dt
  const entregaAntes = st?.deliveryDate ? dataInput(new Date(st.deliveryDate)) : ''
  // Story/Carrossel antigos continuam selecionáveis NESTE card; conteúdo novo não os oferece.
  const tipos = TIPOS_CRIACAO.some(t => t.tp === item.tp) ? TIPOS_CRIACAO : [...TIPOS_CRIACAO, { tp: item.tp, rotulo: rotuloDoTipo(item.tp) }]
  const responsaveis = responsavelAtual && !RESPONSAVEIS.includes(responsavelAtual) ? [...RESPONSAVEIS, responsavelAtual] : RESPONSAVEIS

  const salvar = () => {
    const e: EdicaoConteudo = {}
    if (cliente && cliente !== item.c) e.cliente = cliente
    if (nome.trim() && nome.trim() !== (st?.title || item.n)) e.nome = nome.trim()
    if (tipo !== item.tp) e.tipo = tipo
    if (dataInput(novaData) !== dataInput(item.dt)) e.data = novaData
    if (hora !== (postagemDoCard(item, st).hora ?? '') && (hora === '' || horaValida(hora))) e.hora = hora
    if (entrega !== entregaAntes) e.entrega = deInput(entrega)
    if (responsavel && responsavel !== (responsavelAtual ?? '')) e.responsavel = responsavel
    if (status !== (st?.status ?? item.s)) e.status = status
    if (notas !== (st?.notes ?? '')) e.notas = notas
    if (JSON.stringify(etiquetas) !== JSON.stringify(st?.tags ?? [])) e.etiquetas = etiquetas
    onSalvar(item.i, e)
    onClose()
  }

  return (
    <Drawer anchor="right" open={!!item} onClose={onClose}
      slotProps={{ paper: { sx: { width: { xs: '100vw', sm: 480, xl: 560 }, bgcolor: DS.bg, borderLeft: `1px solid ${DS.border}`, backgroundImage: 'none' } } }}>
      <Box sx={{ p: 2.4, display: 'flex', flexDirection: 'column', gap: 2.2, minHeight: '100%' }}>
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
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.4 }}>
          <TextField select size="small" label="Tipo" value={tipo} onChange={e => setTipo(e.target.value as ContentType)}
            slotProps={{ inputLabel: { shrink: true } }}>
            {tipos.map(t => <MenuItem key={t.tp} value={t.tp} sx={{ fontSize: '0.8rem' }}>{t.rotulo}</MenuItem>)}
          </TextField>
          <TextField select size="small" label="Status" value={status} onChange={e => setStatus(Number(e.target.value) as Status)}
            slotProps={{ inputLabel: { shrink: true } }}>
            {ETAPAS_CONTEUDO.map(s => <MenuItem key={s} value={s} sx={{ fontSize: '0.8rem' }}>{STATUS_CONFIG[s]?.label ?? s}</MenuItem>)}
          </TextField>
        </Box>
        <TextField select size="small" label="Responsável" value={responsavel} onChange={e => setResponsavel(e.target.value)}
          slotProps={{ inputLabel: { shrink: true }, select: { displayEmpty: true } }}>
          <MenuItem value="" disabled sx={{ fontSize: '0.8rem' }}>Sem responsável</MenuItem>
          {responsaveis.map(u => <MenuItem key={u} value={u} sx={{ fontSize: '0.8rem' }}>{nomeDe(u)}</MenuItem>)}
        </TextField>

        <Box>
          <Rotulo>POSTAGEM</Rotulo>
          <EscolherQuando data={data} hora={hora} onData={setData} onHora={setHora} direcao="livre" rotulo="Data de postagem" titulo="DATA DE POSTAGEM" />
        </Box>
        <Box>
          <Rotulo>ENTREGA</Rotulo>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2, flexWrap: 'wrap' }}>
            <EscolherQuando data={entrega} hora="" onData={setEntrega} onHora={() => {}} semHora direcao="livre" rotulo="Data de entrega" titulo="DATA DE ENTREGA" />
            {entrega
              ? <Button size="small" onClick={() => setEntrega('')} sx={{ fontSize: '0.72rem', color: DS.t2, textTransform: 'none' }}>Limpar</Button>
              : <Typography sx={{ fontSize: '0.72rem', color: DS.t3 }}>Sem data: "Reordenar datas" encaixa pela postagem.</Typography>}
          </Box>
        </Box>

        <TextField size="small" label="Observação" value={notas} onChange={e => setNotas(e.target.value)} multiline minRows={3}
          slotProps={{ inputLabel: { shrink: true } }} />

        <Autocomplete multiple freeSolo size="small" options={etiquetasBase.map(e => e.nome)} value={etiquetas}
          onChange={(_, v) => setEtiquetas([...new Set(v.map(x => String(x).trim()).filter(Boolean))])}
          renderTags={(v, getTagProps) => v.map((opt, i) => {
            const { key, ...rest } = getTagProps({ index: i })
            const cor = corDaEtiqueta(etiquetasBase, opt)
            return <Chip key={key} {...rest} label={opt} size="small" sx={{ fontSize: '0.7rem', fontWeight: 700, bgcolor: `${cor}22`, border: `1px solid ${cor}88`, color: DS.t1 }} />
          })}
          renderOption={(props, opt) => {
            const { key, ...rest } = props as typeof props & { key: string }
            return (
              <Box component="li" key={key} {...rest} sx={{ display: 'flex', gap: 1, fontSize: '0.8rem' }}>
                <Box sx={{ width: 9, height: 9, borderRadius: '50%', bgcolor: corDaEtiqueta(etiquetasBase, opt), flexShrink: 0 }} />{opt}
              </Box>
            )
          }}
          renderInput={p => <TextField {...p} label="Etiquetas" placeholder="Escolha ou digite uma nova e Enter" slotProps={{ inputLabel: { shrink: true } }} />} />

        <Box sx={{ flex: 1 }} />
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap', pt: 1, borderTop: `1px solid ${DS.border}` }}>
          {onArquivar && (
            <Button size="small" onClick={onArquivar} sx={{ color: DS.t2, border: `1px solid ${DS.border}`, textTransform: 'none', fontWeight: 700, px: 1.4 }}>Arquivar</Button>
          )}
          {onExcluir && (
            <Button size="small" onClick={onExcluir} sx={{ color: DS.red, border: `1px solid ${DS.red}55`, textTransform: 'none', fontWeight: 700, px: 1.4, '&:hover': { bgcolor: `${DS.red}14` } }}>Excluir</Button>
          )}
          <Box sx={{ flex: 1 }} />
          <Button onClick={onClose} sx={{ color: DS.t2 }}>Cancelar</Button>
          <Button variant="contained" onClick={salvar}>Salvar</Button>
        </Box>
      </Box>
    </Drawer>
  )
}

function Rotulo({ children }: { children: React.ReactNode }) {
  return <Typography sx={{ fontSize: '0.62rem', fontWeight: 800, letterSpacing: '0.1em', color: DS.t3, mb: 0.8 }}>{children}</Typography>
}
