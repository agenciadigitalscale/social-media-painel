import { useState, useEffect } from 'react'
import { Box, Typography, InputBase } from '@mui/material'
import CheckIcon from '@mui/icons-material/Check'
import type { ContentItem, ItemState } from '../../types'
import { NAME_MAP } from '../../lib/users'
import { DS } from '../../theme'
import BottomSheet from '../system/BottomSheet'
import { haptic } from '../system/haptics'

interface CheckDef { key: string; label: string; required: boolean; auto?: (s: ItemState) => boolean }
const CHECKS: CheckDef[] = [
  { key: 'exportado', label: 'Vídeo exportado', required: true },
  { key: 'anexado',   label: 'Arquivo anexado', required: true, auto: (s) => !!s.link || !!s.footageLink },
  { key: 'legenda',   label: 'Legenda pronta', required: true, auto: (s) => !!s.caption?.trim() },
  { key: 'thumb',     label: 'Thumbnail / capa pronta', required: true },
  { key: 'obs',       label: 'Observações preenchidas (se necessário)', required: false },
]

interface Props {
  item: ContentItem | null
  state: ItemState | null
  onCancel: () => void
  onConfirm: (item: ContentItem, obs: string) => void
}

export default function SendSocialSheet({ item, state, onCancel, onConfirm }: Props) {
  const [checked, setChecked] = useState<Record<string, boolean>>({})
  const [obs, setObs] = useState('')

  useEffect(() => {
    if (!item || !state) return
    const init: Record<string, boolean> = {}
    CHECKS.forEach((c) => { init[c.key] = c.auto ? c.auto(state) : false })
    setChecked(init)
    setObs(state.notes || '')
  }, [item?.i]) // eslint-disable-line react-hooks/exhaustive-deps

  const open = !!item && !!state
  const social = NAME_MAP['arthur']
  const allRequired = CHECKS.filter((c) => c.required).every((c) => checked[c.key])

  const toggle = (k: string) => { haptic('light'); setChecked((p) => ({ ...p, [k]: !p[k] })) }

  return (
    <BottomSheet
      open={open}
      onClose={onCancel}
      title={<Typography sx={{ fontSize: '0.98rem', fontWeight: 800, color: DS.t1 }}>Enviar para Social 🚀</Typography>}
    >
      {item && state && (
        <Box sx={{ px: 2.2, pb: 2 }}>
          <Typography sx={{ fontSize: '0.8rem', color: DS.t2, mb: 1.6 }}>
            <b style={{ color: DS.t1 }}>{state.title || item.n}</b> · {item.c}
          </Typography>

          {/* responsável do social */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, p: 1.2, borderRadius: 2.5, background: `${social?.color ?? DS.green}12`, border: `1px solid ${social?.color ?? DS.green}44` }}>
            <Box sx={{ width: 34, height: 34, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.05rem', background: `${social?.color ?? DS.green}22` }}>
              {social?.emoji ?? '📱'}
            </Box>
            <Box>
              <Typography sx={{ fontSize: '0.58rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: DS.t3 }}>Responsável Social</Typography>
              <Typography sx={{ fontSize: '0.82rem', fontWeight: 800, color: DS.t1, textTransform: 'capitalize' }}>Arthur</Typography>
            </Box>
          </Box>

          {/* checklist */}
          <Typography sx={{ fontSize: '0.6rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: DS.t3, mb: 1 }}>Checklist obrigatório</Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.8, mb: 2 }}>
            {CHECKS.map((c) => {
              const on = checked[c.key]
              return (
                <Box key={c.key} onClick={() => toggle(c.key)} sx={{ display: 'flex', alignItems: 'center', gap: 1.1, py: 0.7, cursor: 'pointer' }}>
                  <Box sx={{
                    width: 24, height: 24, borderRadius: 1.5, flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: on ? DS.green : 'transparent',
                    border: `1.5px solid ${on ? DS.green : DS.border}`,
                    transition: 'all 0.15s',
                  }}>
                    {on && <CheckIcon sx={{ fontSize: 16, color: '#000' }} />}
                  </Box>
                  <Typography sx={{ fontSize: '0.82rem', fontWeight: 600, color: on ? DS.t1 : DS.t2 }}>
                    {c.label}{c.required && <span style={{ color: DS.red }}> *</span>}
                  </Typography>
                </Box>
              )
            })}
          </Box>

          <InputBase
            value={obs}
            onChange={(e) => setObs(e.target.value)}
            placeholder="Observações para o Social…"
            multiline minRows={2}
            sx={{ width: '100%', fontSize: '0.8rem', color: DS.t1, px: 1.4, py: 1, borderRadius: 2.5, background: 'rgba(255,255,255,0.04)', border: `1px solid ${DS.border}`, mb: 2 }}
          />

          <Box sx={{ display: 'flex', gap: 1 }}>
            <Box onClick={() => { haptic('light'); onCancel() }} sx={{ flex: 1, textAlign: 'center', py: 1.3, borderRadius: 2.5, background: 'rgba(255,255,255,0.05)', border: `1px solid ${DS.border}`, cursor: 'pointer' }}>
              <Typography sx={{ fontSize: '0.8rem', fontWeight: 700, color: DS.t2 }}>Cancelar</Typography>
            </Box>
            <Box
              onClick={() => { if (allRequired) { haptic('success'); onConfirm(item, obs) } }}
              sx={{
                flex: 1.5, textAlign: 'center', py: 1.3, borderRadius: 2.5, cursor: allRequired ? 'pointer' : 'default',
                background: allRequired ? `linear-gradient(135deg, ${DS.green}, #16a34a)` : 'rgba(255,255,255,0.06)',
                boxShadow: allRequired ? '0 6px 20px rgba(34,197,94,0.3)' : 'none', opacity: allRequired ? 1 : 0.5,
              }}
            >
              <Typography sx={{ fontSize: '0.8rem', fontWeight: 800, color: allRequired ? '#000' : DS.t3 }}>Enviar 🚀</Typography>
            </Box>
          </Box>
        </Box>
      )}
    </BottomSheet>
  )
}
