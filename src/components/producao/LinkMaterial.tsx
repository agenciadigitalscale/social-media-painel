import { useState, type ReactNode } from 'react'
import { Box, TextField, Tooltip, Typography } from '@mui/material'
import EditIcon from '@mui/icons-material/Edit'
import LinkIcon from '@mui/icons-material/Link'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import type { ContentItem, ItemState } from '../../types'
import { clickableStop } from '../../shared/a11y'
import { DS } from '../../theme'
import { linkDoMaterial, normalizarLinkMaterial } from '../../lib/linkMaterial'
import SendIcon from '@mui/icons-material/Send'

/**
 * O link do vídeo/arte FINAL, colado à mão por quem produziu, e a mensagem
 * padrão do cliente pronta para copiar com ele.
 *
 * É o MESMO link do "Link do criativo" do card aberto e da edição (fonte única:
 * `linkDoMaterial`, gravado em `linkMaterial`). Não é o `link`: esse a esteira
 * e a Inbox reescrevem ao vincular arquivo, e o que o editor colou sumiria.
 */
export default function LinkMaterial({ state, onSalvar, onEnviar }: {
  item: ContentItem
  state: ItemState
  onSalvar: (link: string) => void
  /** Envio ao cliente pela rotina central (confirma, copia a mensagem, move p/ Enviado). */
  onEnviar?: () => void
}) {
  const link = linkDoMaterial(state)
  const [editando, setEditando] = useState(false)
  const [rascunho, setRascunho] = useState('')
  const [erro, setErro] = useState(false)

  const abrir = () => { setRascunho(link); setErro(false); setEditando(true) }
  const salvar = () => {
    const ok = normalizarLinkMaterial(rascunho)
    if (!ok && rascunho.trim()) { setErro(true); return }
    onSalvar(ok ?? '')
    setEditando(false)
  }

  const miniBtn = (titulo: string, icone: ReactNode, fn: () => void) => (
    <Tooltip title={titulo} placement="top">
      <Box {...clickableStop(fn)} aria-label={titulo} sx={{
        flexShrink: 0, width: 24, height: 24, borderRadius: '6px', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: DS.t2, border: `1px solid ${DS.border}`,
        '&:hover': { color: DS.t1, borderColor: DS.t3 },
      }}>{icone}</Box>
    </Tooltip>
  )

  if (editando) {
    return (
      <Box onPointerDown={e => e.stopPropagation()} onClick={e => e.stopPropagation()} sx={{ mt: 0.8 }}>
        <TextField
          autoFocus size="small" fullWidth
          value={rascunho}
          onChange={e => { setRascunho(e.target.value); setErro(false) }}
          onKeyDown={e => {
            if (e.key === 'Enter') { e.preventDefault(); salvar() }
            if (e.key === 'Escape') { e.preventDefault(); setEditando(false) }
          }}
          placeholder="Cole o link do vídeo/arte final (Drive…)"
          error={erro}
          helperText={erro ? 'Isso não parece um link' : undefined}
          sx={{
            '& .MuiInputBase-input': { fontSize: '0.64rem', py: 0.7 },
            '& .MuiFormHelperText-root': { fontSize: '0.55rem', mx: 0 },
          }}
        />
        <Box sx={{ display: 'flex', gap: 0.4, mt: 0.45 }}>
          <Box {...clickableStop(salvar)} sx={{ px: 0.9, py: 0.3, borderRadius: '6px', fontSize: '0.56rem', fontWeight: 800, color: DS.onAccent, bgcolor: DS.accent, cursor: 'pointer', '&:hover': { filter: 'brightness(1.08)' } }}>
            Salvar
          </Box>
          <Box {...clickableStop(() => setEditando(false))} sx={{ px: 0.9, py: 0.3, borderRadius: '6px', fontSize: '0.56rem', fontWeight: 700, color: DS.t3, border: `1px solid ${DS.border}`, cursor: 'pointer', '&:hover': { color: DS.t2 } }}>
            Cancelar
          </Box>
        </Box>
      </Box>
    )
  }

  if (!link) {
    return (
      <Box {...clickableStop(abrir)} aria-label="Colar link do material" sx={{
        mt: 0.8, py: 0.6, borderRadius: '8px', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5,
        border: `1px dashed ${DS.border}`, color: DS.t3,
        transition: 'all 0.15s', '&:hover': { color: DS.t1, borderColor: DS.t3 },
      }}>
        <LinkIcon sx={{ fontSize: 13 }} />
        <Typography sx={{ fontSize: '0.6rem', fontWeight: 700 }}>Colar link do material</Typography>
      </Box>
    )
  }

  // Antes de Aprovado (ou para quem não manda ao cliente): só o link, sem a mensagem.
  if (!onEnviar) {
    return (
      <Box sx={{ mt: 0.8, display: 'flex', gap: 0.4, alignItems: 'center' }}>
        <Box sx={{
          flex: 1, minWidth: 0, py: 0.55, px: 0.8, borderRadius: '8px',
          display: 'flex', alignItems: 'center', gap: 0.5, border: `1px solid ${DS.border}`,
        }}>
          <CheckCircleIcon sx={{ fontSize: 12, color: DS.green, flexShrink: 0 }} />
          <Typography noWrap sx={{ fontSize: '0.6rem', fontWeight: 700, color: DS.t2 }}>
            Link do material salvo
          </Typography>
        </Box>
        {miniBtn('Abrir o material', <OpenInNewIcon sx={{ fontSize: 12 }} />, () => window.open(link, '_blank', 'noopener'))}
        {miniBtn('Trocar o link', <EditIcon sx={{ fontSize: 12 }} />, abrir)}
      </Box>
    )
  }

  return (
    <Box sx={{ mt: 0.8, display: 'flex', gap: 0.4, alignItems: 'center' }}>
      <Tooltip title="Copia a mensagem padrão com este link, abre o WhatsApp do cliente e move para Enviado" placement="top">
        <Box {...clickableStop(onEnviar)} aria-label="Copiar mensagem para o cliente" sx={{
          flex: 1, minWidth: 0, py: 0.6, borderRadius: '8px', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5,
          fontSize: '0.62rem', fontWeight: 800,
          color: DS.onAccent, bgcolor: DS.accent, border: '1px solid transparent',
          transition: 'all 0.15s', '&:hover': { filter: 'brightness(1.06)' },
        }}>
          <SendIcon sx={{ fontSize: 12 }} />
          Copiar mensagem p/ cliente
        </Box>
      </Tooltip>
      {miniBtn('Abrir o material', <OpenInNewIcon sx={{ fontSize: 12 }} />, () => window.open(link, '_blank', 'noopener'))}
      {miniBtn('Trocar o link', <EditIcon sx={{ fontSize: 12 }} />, abrir)}
    </Box>
  )
}
