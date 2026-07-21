import { useEffect, useState } from 'react'
import { Box, Typography, CircularProgress } from '@mui/material'
import type { ContentItem } from '../../types'
import { DS } from '../../theme'
import { haptic } from '../system/haptics'
import BottomSheet from '../system/BottomSheet'
import { isStalePhase, type ReadyAutomationState } from '../../lib/readyAutomation'
import type { DriveFile } from '../../lib/videoMatch'

interface Props {
  item: ContentItem | null
  /** Título do card (states[].title), não o nome original do item. */
  title?: string
  ready?: ReadyAutomationState
  onClose: () => void
  onSend: () => void
  onRetry: () => void
  onBackToProduction: () => void
  listCandidates: () => Promise<{ files: DriveFile[]; error?: string }>
  onPick: (file: DriveFile) => void
}

function toneFor(ready: ReadyAutomationState | undefined, stale: boolean): string {
  if (!ready) return DS.t2
  if (stale) return DS.t2
  if (ready.phase === 'searching' || ready.phase === 'found') return DS.accent
  if (ready.phase === 'done' || ready.phase === 'awaiting_send') return DS.green
  if (ready.phase === 'idle') return DS.t2
  if (ready.phase === 'ambiguous') return DS.amber
  return DS.alert
}

/**
 * Esteira no celular. O desktop mostra tudo dentro do card; aqui a tela é
 * estreita demais para isso, então o card fica com a linha de status e o toque
 * abre esta folha com as ações.
 */
export default function ReadySheet({
  item, title, ready, onClose, onSend, onRetry, onBackToProduction, listCandidates, onPick,
}: Props) {
  const [picking, setPicking] = useState(false)
  const [files, setFiles] = useState<DriveFile[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | undefined>()

  useEffect(() => {
    if (!item) { setPicking(false); setFiles([]); setError(undefined) }
  }, [item])

  const stale = isStalePhase(ready)
  const tone = toneFor(ready, stale)
  const busy = !!ready && (ready.phase === 'searching' || ready.phase === 'found') && !stale
  const message = stale ? 'A busca ficou pelo caminho' : ready?.message ?? 'Pronto para buscar na pasta Publicar'

  const openPicker = async () => {
    haptic('selection')
    setPicking(true)
    setLoading(true)
    const res = await listCandidates()
    setFiles(res.files)
    setError(res.error)
    setLoading(false)
  }

  const Action = ({ label, onClick, primary }: { label: string; onClick: () => void; primary?: boolean }) => (
    <Box
      role="button"
      tabIndex={0}
      onClick={() => { haptic(primary ? 'success' : 'selection'); onClick() }}
      sx={{
        px: 2, py: 1.4, borderRadius: 3, textAlign: 'center', cursor: 'pointer',
        fontSize: '0.82rem', fontWeight: 800,
        color: primary ? '#FFFFFF' : DS.t2,
        background: primary ? 'linear-gradient(90deg, #3B82F6 0%, #06B6D4 100%)' : 'rgba(255,255,255,0.05)',
        border: primary ? 'none' : `1px solid ${DS.border}`,
        boxShadow: primary ? '0 4px 16px rgba(59,130,246,0.28)' : 'none',
        transition: 'filter 0.18s ease',
        '&:active': { filter: 'brightness(0.92)' },
      }}
    >{label}</Box>
  )

  return (
    <BottomSheet
      open={!!item}
      onClose={onClose}
      title={
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontSize: '0.56rem', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: DS.green }}>
            Pronto
          </Typography>
          <Typography sx={{ fontSize: '0.95rem', fontWeight: 800, color: DS.t1 }} noWrap>
            {title || item?.n}
          </Typography>
        </Box>
      }
    >
      <Box sx={{ px: 2, pb: 3, display: 'flex', flexDirection: 'column', gap: 1.2 }}>

        {/* status atual */}
        <Box sx={{
          px: 1.6, py: 1.4, borderRadius: 3,
          background: `${tone}12`, border: `1px solid ${tone}33`,
          display: 'flex', alignItems: 'center', gap: 1.2,
        }}>
          {busy && <CircularProgress size={14} sx={{ color: tone }} />}
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontSize: '0.8rem', fontWeight: 700, color: tone, lineHeight: 1.35 }}>
              {message}
            </Typography>
            {ready?.filename && (
              <Typography sx={{ fontSize: '0.68rem', color: DS.t3, mt: 0.2 }} noWrap>
                {ready.filename}
              </Typography>
            )}
          </Box>
        </Box>

        {picking ? (
          <>
            {loading && (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress size={22} sx={{ color: DS.accent }} />
              </Box>
            )}
            {!loading && error && (
              <Typography sx={{ fontSize: '0.75rem', color: DS.red, py: 2, textAlign: 'center' }}>{error}</Typography>
            )}
            {!loading && !error && files.length === 0 && (
              <Typography sx={{ fontSize: '0.75rem', color: DS.t3, py: 3, textAlign: 'center' }}>
                Nenhum arquivo na pasta Publicar de {item?.c}
              </Typography>
            )}
            {!loading && files.map(f => (
              <Box key={f.id}
                role="button"
                tabIndex={0}
                onClick={() => { haptic('success'); onPick(f) }}
                sx={{
                  px: 1.6, py: 1.3, borderRadius: 3, cursor: 'pointer',
                  background: 'rgba(255,255,255,0.04)', border: `1px solid ${DS.border}`,
                  '&:active': { background: 'rgba(59,130,246,0.12)' },
                }}>
                <Typography sx={{ fontSize: '0.8rem', fontWeight: 700, color: DS.t1 }} noWrap>{f.name}</Typography>
                <Typography sx={{ fontSize: '0.65rem', color: DS.t3 }}>{f.mimeType}</Typography>
              </Box>
            ))}
            <Action label="Voltar" onClick={() => setPicking(false)} />
          </>
        ) : (
          <>
            {ready?.phase === 'awaiting_send' && (
              <Action label="Enviar para revisão" onClick={onSend} primary />
            )}
            {!busy && ready?.phase !== 'awaiting_send' && (
              <Action label={ready ? 'Tentar novamente' : 'Procurar arquivo'} onClick={onRetry} primary />
            )}
            <Action label="Escolher arquivo na pasta" onClick={openPicker} />
            <Action label="Voltar para Produção" onClick={onBackToProduction} />
          </>
        )}
      </Box>
    </BottomSheet>
  )
}
