import { useState, useEffect } from 'react'
import { Box, Typography, TextField, InputBase } from '@mui/material'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import type { ContentItem, ItemState, Status, Comment } from '../../types'
import { STATUS_CONFIG } from '../../types'
import { DS, typeColor } from '../../theme'
import { shouldShowDelivery } from '../../lib/cardDate'
import BottomSheet from '../system/BottomSheet'
import { haptic } from '../system/haptics'
import { deadlineInfo } from './MobileCard'

const ALL_STATUSES: Status[] = [0, 1, 2, 3, 4, 5, 6, 7]

type TabKey = 'resumo' | 'arquivos' | 'checklist' | 'comentarios' | 'timeline' | 'historico'
const TABS: { key: TabKey; label: string }[] = [
  { key: 'resumo', label: 'Resumo' },
  { key: 'arquivos', label: 'Arquivos' },
  { key: 'checklist', label: 'Checklist' },
  { key: 'comentarios', label: 'Comentários' },
  { key: 'timeline', label: 'Timeline' },
  { key: 'historico', label: 'Histórico' },
]

interface Props {
  item: ContentItem | null
  state: ItemState | null
  now: Date
  currentUser: string
  clientColor?: string
  vip?: boolean
  onToggleVip?: () => void
  onClose: () => void
  onStatusChange: (id: number, s: Status) => void
  onUpdate: (id: number, patch: Partial<ItemState>) => void
}

const fieldSx = {
  '& .MuiInputBase-root': {
    fontSize: '0.82rem', color: DS.t1, borderRadius: 2.5,
    background: 'rgba(255,255,255,0.04)', border: `1px solid ${DS.border}`,
  },
  '& .MuiOutlinedInput-notchedOutline': { border: 'none' },
} as const

function label(sx: object = {}) {
  return { fontSize: '0.6rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: DS.t3, mb: 0.7, ...sx } as const
}

export default function CardDetailSheet({ item, state, now, currentUser, clientColor, vip, onToggleVip, onClose, onStatusChange, onUpdate }: Props) {
  const [tab, setTab] = useState<TabKey>('resumo')
  const [title, setTitle] = useState('')
  const [notes, setNotes] = useState('')
  const [link, setLink] = useState('')
  const [footage, setFootage] = useState('')
  const [roteiro, setRoteiro] = useState('')
  const [delivery, setDelivery] = useState('')
  const [newComment, setNewComment] = useState('')

  useEffect(() => {
    if (!item || !state) return
    setTab('resumo')
    setTitle(state.title || item.n)
    setNotes(state.notes || '')
    setLink(state.link || '')
    setFootage(state.footageLink || '')
    setRoteiro(state.roteiroLink || '')
    setDelivery(state.deliveryDate ? new Date(state.deliveryDate).toISOString().slice(0, 10) : '')
    setNewComment('')
  }, [item?.i]) // eslint-disable-line react-hooks/exhaustive-deps

  const open = !!item && !!state
  if (!item || !state) {
    return <BottomSheet open={false} onClose={onClose}>{null}</BottomSheet>
  }

  const cfg = STATUS_CONFIG[state.status]
  const stripe = clientColor || cfg.color
  const commit = (patch: Partial<ItemState>) => onUpdate(item.i, patch)

  const addComment = () => {
    const text = newComment.trim()
    if (!text) return
    const c: Comment = { id: `${Date.now()}`, text, author: currentUser || 'equipe', authorType: 'internal', createdAt: Date.now(), statusAt: state.status }
    commit({ comments: [...(state.comments ?? []), c] })
    setNewComment('')
    haptic('light')
  }

  const openLink = (url: string) => { if (url) window.open(url.startsWith('http') ? url : `https://${url}`, '_blank') }

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.7, mb: 0.6 }}>
            <Box sx={{
              px: 0.8, py: 0.2, borderRadius: 1.5,
              background: `${typeColor(item.tp)}1e`, border: `1px solid ${typeColor(item.tp)}44`,
            }}>
              <Typography sx={{ fontSize: '0.58rem', fontWeight: 800, color: typeColor(item.tp) }}>{item.tp}</Typography>
            </Box>
            <Typography sx={{ fontSize: '0.68rem', fontWeight: 800, color: stripe }} noWrap>{item.c}</Typography>
            {onToggleVip && (
              <Box
                onClick={() => { haptic(vip ? 'light' : 'success'); onToggleVip() }}
                sx={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  width: 24, height: 24, borderRadius: '50%', cursor: 'pointer', flexShrink: 0,
                  background: vip ? 'rgba(255,215,0,0.16)' : 'rgba(255,255,255,0.05)',
                  border: `1px solid ${vip ? 'rgba(255,215,0,0.5)' : DS.border}`,
                  '&:active': { transform: 'scale(0.88)' }, transition: 'transform 0.12s',
                }}
                title={vip ? 'Remover VIP' : 'Marcar como VIP'}
              >
                <span style={{ fontSize: '0.72rem', filter: vip ? 'none' : 'grayscale(1) opacity(0.5)' }}>⭐</span>
              </Box>
            )}
            <Box sx={{ flex: 1 }} />
            {(() => {
              const showDel = shouldShowDelivery(state)
              const dl = deadlineInfo(showDel ? new Date(state.deliveryDate!) : item.dt, now)
              return (
                <Typography sx={{ fontSize: '0.6rem', fontWeight: 800, color: dl.color }}>
                  {showDel && '📥 '}{dl.label}
                </Typography>
              )
            })()}
          </Box>
          <Typography sx={{ fontSize: '1rem', fontWeight: 800, color: DS.t1, lineHeight: 1.25 }}>
            {state.title || item.n}
          </Typography>
        </Box>
      }
    >
      {/* seletor de status */}
      <Box sx={{ px: 2.2, pb: 1.2 }}>
        <Typography sx={label()}>Status</Typography>
        <Box sx={{ display: 'flex', gap: 0.7, overflowX: 'auto', pb: 0.5, '&::-webkit-scrollbar': { display: 'none' } }}>
          {ALL_STATUSES.map((s) => {
            const sc = STATUS_CONFIG[s]
            const active = s === state.status
            return (
              <Box
                key={s}
                onClick={() => { if (!active) { haptic('medium'); onStatusChange(item.i, s) } }}
                sx={{
                  flexShrink: 0, px: 1.1, py: 0.6, borderRadius: 2, cursor: 'pointer',
                  background: active ? `${sc.color}22` : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${active ? `${sc.color}88` : DS.border}`,
                  display: 'flex', alignItems: 'center', gap: 0.4,
                  transition: 'transform 0.12s', '&:active': { transform: 'scale(0.94)' },
                }}
              >
                <span style={{ fontSize: '0.72rem' }}>{sc.emoji}</span>
                <Typography sx={{ fontSize: '0.6rem', fontWeight: 800, color: active ? sc.color : DS.t2, whiteSpace: 'nowrap' }}>
                  {sc.shortLabel}
                </Typography>
              </Box>
            )
          })}
        </Box>
      </Box>

      {/* abas */}
      <Box sx={{ display: 'flex', gap: 0.5, px: 2.2, overflowX: 'auto', borderBottom: `1px solid ${DS.border}`, '&::-webkit-scrollbar': { display: 'none' } }}>
        {TABS.map((t) => {
          const active = t.key === tab
          return (
            <Box
              key={t.key}
              onClick={() => { haptic('selection'); setTab(t.key) }}
              sx={{
                flexShrink: 0, py: 1, px: 0.6, cursor: 'pointer',
                borderBottom: `2px solid ${active ? DS.orange : 'transparent'}`,
              }}
            >
              <Typography sx={{ fontSize: '0.68rem', fontWeight: active ? 800 : 600, color: active ? DS.orange : DS.t2 }}>
                {t.label}
              </Typography>
            </Box>
          )
        })}
      </Box>

      <Box sx={{ px: 2.2, py: 2 }}>
        {tab === 'resumo' && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Box>
              <Typography sx={label()}>Título</Typography>
              <TextField fullWidth size="small" value={title} onChange={(e) => setTitle(e.target.value)} onBlur={() => commit({ title })} sx={fieldSx} />
            </Box>
            <Box>
              <Typography sx={label()}>📥 Data de entrega (prazo interno)</Typography>
              <TextField
                fullWidth size="small" type="date" value={delivery}
                onChange={(e) => {
                  const v = e.target.value
                  setDelivery(v)
                  commit({ deliveryDate: v ? new Date(v + 'T12:00:00').getTime() : undefined })
                  haptic('light')
                }}
                sx={{ ...fieldSx, '& input': { colorScheme: 'dark' } }}
              />
              <Typography sx={{ fontSize: '0.58rem', color: DS.t3, mt: 0.6 }}>
                Postagem: {new Date(item.dt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                {' · '}o card mostra a entrega até ser aprovado pelo cliente
              </Typography>
            </Box>
            <Box>
              <Typography sx={label()}>Prioridade</Typography>
              <Box sx={{ display: 'flex', gap: 0.7 }}>
                {(['alta', 'media', 'baixa'] as const).map((p) => {
                  const active = state.priority === p
                  const c = p === 'alta' ? DS.red : p === 'media' ? DS.amber : DS.t2
                  return (
                    <Box key={p} onClick={() => { haptic('light'); commit({ priority: p }) }}
                      sx={{ px: 1.4, py: 0.7, borderRadius: 2, cursor: 'pointer', textTransform: 'capitalize',
                        background: active ? `${c}22` : 'rgba(255,255,255,0.03)', border: `1px solid ${active ? `${c}77` : DS.border}` }}>
                      <Typography sx={{ fontSize: '0.68rem', fontWeight: 700, color: active ? c : DS.t2 }}>{p}</Typography>
                    </Box>
                  )
                })}
              </Box>
            </Box>
            <Box>
              <Typography sx={label()}>Notas internas</Typography>
              <TextField fullWidth multiline minRows={3} size="small" value={notes} onChange={(e) => setNotes(e.target.value)} onBlur={() => commit({ notes })} placeholder="Observações do time…" sx={fieldSx} />
            </Box>
          </Box>
        )}

        {tab === 'arquivos' && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {([
              ['Criativo / publicação', link, setLink, 'link'],
              ['Material bruto', footage, setFootage, 'footageLink'],
              ['Roteiro (Docs)', roteiro, setRoteiro, 'roteiroLink'],
            ] as const).map(([lbl, val, setter, key]) => (
              <Box key={key}>
                <Typography sx={label()}>{lbl}</Typography>
                <Box sx={{ display: 'flex', gap: 0.7, alignItems: 'center' }}>
                  <TextField fullWidth size="small" value={val} onChange={(e) => setter(e.target.value)} onBlur={() => commit({ [key]: val } as Partial<ItemState>)} placeholder="Colar link…" sx={fieldSx} />
                  {val && (
                    <Box onClick={() => openLink(val)} sx={{ p: 1, borderRadius: 2, background: `${DS.orange}18`, border: `1px solid ${DS.orange}44`, cursor: 'pointer', display: 'inline-flex' }}>
                      <OpenInNewIcon sx={{ fontSize: 16, color: DS.orange }} />
                    </Box>
                  )}
                </Box>
              </Box>
            ))}
          </Box>
        )}

        {tab === 'checklist' && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {ALL_STATUSES.map((s) => {
              const sc = STATUS_CONFIG[s]
              const done = s < state.status
              const current = s === state.status
              return (
                <Box key={s} sx={{ display: 'flex', alignItems: 'center', gap: 1.2, opacity: done || current ? 1 : 0.45 }}>
                  <Box sx={{
                    width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: done ? DS.green : current ? sc.color : 'transparent',
                    border: `1.5px solid ${done ? DS.green : current ? sc.color : DS.border}`,
                    fontSize: '0.6rem',
                  }}>
                    {done ? '✓' : current ? sc.emoji : ''}
                  </Box>
                  <Typography sx={{ fontSize: '0.78rem', fontWeight: current ? 800 : 600, color: current ? sc.color : DS.t1 }}>
                    {sc.label}
                  </Typography>
                </Box>
              )
            })}
          </Box>
        )}

        {tab === 'comentarios' && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.2 }}>
            {(state.comments ?? []).length === 0 && (
              <Typography sx={{ fontSize: '0.76rem', color: DS.t3, textAlign: 'center', py: 2 }}>Nenhum comentário ainda</Typography>
            )}
            {(state.comments ?? []).map((c) => (
              <Box key={c.id} sx={{ p: 1.2, borderRadius: 2.5, background: c.authorType === 'client' ? 'rgba(249,115,22,0.08)' : 'rgba(255,255,255,0.03)', border: `1px solid ${c.authorType === 'client' ? 'rgba(249,115,22,0.25)' : DS.border}` }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6, mb: 0.4 }}>
                  <Typography sx={{ fontSize: '0.62rem', fontWeight: 800, color: c.authorType === 'client' ? DS.orange : DS.blueSoft, textTransform: 'capitalize' }}>
                    {c.authorType === 'client' ? '🙋 Cliente' : c.author}
                  </Typography>
                  <Box sx={{ flex: 1 }} />
                  <Typography sx={{ fontSize: '0.56rem', color: DS.t3 }}>
                    {new Date(c.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </Typography>
                </Box>
                <Typography sx={{ fontSize: '0.78rem', color: DS.t1, lineHeight: 1.45 }}>{c.text}</Typography>
              </Box>
            ))}
            <Box sx={{ display: 'flex', gap: 0.8, alignItems: 'center', mt: 0.5 }}>
              <InputBase
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') addComment() }}
                placeholder="Escrever comentário…"
                sx={{ flex: 1, fontSize: '0.8rem', color: DS.t1, px: 1.4, py: 0.9, borderRadius: 2.5, background: 'rgba(255,255,255,0.04)', border: `1px solid ${DS.border}` }}
              />
              <Box onClick={addComment} sx={{ px: 1.6, py: 1, borderRadius: 2.5, background: `linear-gradient(135deg, ${DS.orange}, #ff5339)`, cursor: 'pointer' }}>
                <Typography sx={{ fontSize: '0.72rem', fontWeight: 800, color: '#000' }}>Enviar</Typography>
              </Box>
            </Box>
          </Box>
        )}

        {tab === 'timeline' && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.4 }}>
            {([
              ['Enviado ao cliente', state.sentToClientAt, DS.orange],
              ['Aprovado pelo cliente', state.approvedByClientAt, DS.green],
              ['Publicado', state.publishedAt, DS.greenDim],
            ] as const).filter(([, ts]) => !!ts).map(([lbl, ts, c]) => (
              <Box key={lbl} sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
                <Box sx={{ width: 9, height: 9, borderRadius: '50%', background: c, flexShrink: 0 }} />
                <Typography sx={{ fontSize: '0.78rem', color: DS.t1, flex: 1 }}>{lbl}</Typography>
                <Typography sx={{ fontSize: '0.64rem', color: DS.t2 }}>
                  {new Date(ts as number).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </Typography>
              </Box>
            ))}
            {!state.sentToClientAt && !state.approvedByClientAt && !state.publishedAt && (
              <Typography sx={{ fontSize: '0.76rem', color: DS.t3, textAlign: 'center', py: 2 }}>Sem marcos registrados</Typography>
            )}
          </Box>
        )}

        {tab === 'historico' && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {(state.history ?? []).length === 0 && (
              <Typography sx={{ fontSize: '0.76rem', color: DS.t3, textAlign: 'center', py: 2 }}>Sem histórico</Typography>
            )}
            {[...(state.history ?? [])].reverse().map((h, i) => (
              <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box sx={{ width: 5, height: 5, borderRadius: '50%', background: DS.t3, flexShrink: 0 }} />
                <Typography sx={{ fontSize: '0.74rem', color: DS.t1, flex: 1 }}>
                  {h.action}{h.user ? ` · ${h.user}` : ''}
                </Typography>
                <Typography sx={{ fontSize: '0.6rem', color: DS.t3 }}>
                  {new Date(h.ts).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                </Typography>
              </Box>
            ))}
          </Box>
        )}
      </Box>
    </BottomSheet>
  )
}
