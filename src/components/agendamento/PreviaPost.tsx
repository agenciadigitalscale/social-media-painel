/**
 * Prévia do post como ele vai aparecer no feed — o lado direito do compositor,
 * no espírito do Meta Business Suite (2026-10-19), nas cores do painel.
 * Mostra a mídia anexada (a que vai ao ar), o perfil/Página de destino e a
 * descrição; é ilustração, não renderização da Meta.
 */
import { useState } from 'react'
import { Box, Typography } from '@mui/material'
import InstagramIcon from '@mui/icons-material/Instagram'
import FacebookIcon from '@mui/icons-material/Facebook'
import FavoriteBorderIcon from '@mui/icons-material/FavoriteBorder'
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline'
import SendOutlinedIcon from '@mui/icons-material/SendOutlined'
import BookmarkBorderIcon from '@mui/icons-material/BookmarkBorder'
import ThumbUpOutlinedIcon from '@mui/icons-material/ThumbUpOutlined'
import ReplyOutlinedIcon from '@mui/icons-material/ReplyOutlined'
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined'
import { DS } from '../../theme'
import { clickable } from '../../shared/a11y'
import type { Anexo } from '../../lib/anexos'
import type { Rede } from '../../lib/instagram'

export default function PreviaPost({ anexos, legenda, perfil, pagina, nomeCliente, quando, redesDisponiveis }: {
  anexos: Anexo[]
  legenda: string
  /** @perfil do Instagram (vazio = não conectado). */
  perfil?: string
  /** Nome da Página do Facebook (vazio = não conectada). */
  pagina?: string
  nomeCliente: string
  /** Texto do momento ("ter, 21/10 às 18:00"); vazio = "Agora mesmo". */
  quando?: string
  /** Redes marcadas para publicar — a prévia abre na primeira. */
  redesDisponiveis?: Rede[]
}) {
  const [rede, setRede] = useState<Rede>(redesDisponiveis?.[0] ?? 'instagram')
  const [peca, setPeca] = useState(0)
  const atual = anexos[Math.min(peca, Math.max(0, anexos.length - 1))]
  const nome = rede === 'instagram' ? (perfil?.replace(/^@/, '') || nomeCliente) : (pagina || nomeCliente)
  const inicial = nome.trim().charAt(0).toUpperCase() || '·'
  const texto = legenda.trim()

  const midia = (
    <Box sx={{ position: 'relative', width: '100%', aspectRatio: rede === 'instagram' ? '4 / 5' : '1 / 1', bgcolor: DS.field, display: 'grid', placeItems: 'center', overflow: 'hidden' }}>
      {atual ? (atual.tipo.startsWith('video/')
        ? <Box component="video" src={atual.url} muted controls preload="metadata" sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : <Box component="img" src={atual.url} alt="" sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />)
        : (
          <Box sx={{ textAlign: 'center', color: DS.t4 }}>
            <ImageOutlinedIcon sx={{ fontSize: 64 }} />
            <Typography sx={{ fontSize: '0.72rem', color: DS.t3 }}>A mídia anexada aparece aqui</Typography>
          </Box>
        )}
      {anexos.length > 1 && (
        <>
          <Box sx={{ position: 'absolute', top: 10, right: 10, px: 1, py: 0.2, borderRadius: '999px', bgcolor: 'rgba(0,0,0,0.6)' }}>
            <Typography sx={{ fontSize: '0.66rem', fontWeight: 700, color: '#fff' }}>{peca + 1}/{anexos.length}</Typography>
          </Box>
          <Box sx={{ position: 'absolute', bottom: 8, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 0.5 }}>
            {anexos.map((a, i) => (
              <Box key={a.key} {...clickable(() => setPeca(i))} aria-label={`Peça ${i + 1}`}
                sx={{ width: 7, height: 7, borderRadius: '50%', cursor: 'pointer', bgcolor: i === peca ? DS.accent : 'rgba(255,255,255,0.5)' }} />
            ))}
          </Box>
        </>
      )}
    </Box>
  )

  return (
    <Box>
      {/* Escolha da prévia — como o "Prévia do Feed do Facebook ▾" da Meta */}
      <Box sx={{ display: 'flex', gap: 0.6, mb: 1.4 }}>
        {(['instagram', 'facebook'] as Rede[]).map(r => {
          const Icone = r === 'instagram' ? InstagramIcon : FacebookIcon
          const ativo = rede === r
          return (
            <Box key={r} {...clickable(() => setRede(r))} aria-pressed={ativo} sx={{
              display: 'flex', alignItems: 'center', gap: 0.6, px: 1.4, height: 34, borderRadius: '9px', cursor: 'pointer',
              border: `1px solid ${ativo ? DS.accent : DS.border}`, bgcolor: ativo ? `${DS.accent}14` : DS.surface,
              transition: 'all 0.18s ease',
            }}>
              <Icone sx={{ fontSize: 16, color: ativo ? DS.accent : DS.t2 }} />
              <Typography sx={{ fontSize: '0.74rem', fontWeight: 700, color: ativo ? DS.accent : DS.t2 }}>
                Prévia do {r === 'instagram' ? 'Instagram' : 'Facebook'}
              </Typography>
            </Box>
          )
        })}
      </Box>

      <Box sx={{ maxWidth: { xs: '100%', md: 420, xl: 480 }, mx: 'auto', borderRadius: '14px', overflow: 'hidden', bgcolor: DS.surfaceAlt, border: `1px solid ${DS.border}` }}>
        {/* Cabeçalho do post */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.1, px: 1.6, py: 1.2 }}>
          <Box sx={{ width: 36, height: 36, borderRadius: '50%', bgcolor: DS.accent, color: DS.onAccent, display: 'grid', placeItems: 'center', fontWeight: 900, fontSize: '0.9rem', flexShrink: 0 }}>
            {inicial}
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography noWrap sx={{ fontSize: '0.84rem', fontWeight: 800, color: DS.t1 }}>{nome}</Typography>
            <Typography noWrap sx={{ fontSize: '0.68rem', color: DS.t3 }}>{quando || 'Agora mesmo'}</Typography>
          </Box>
        </Box>

        {/* Facebook: texto acima da mídia; Instagram: abaixo */}
        {rede === 'facebook' && (
          <Typography sx={{ px: 1.6, pb: 1.2, fontSize: '0.8rem', color: texto ? DS.t1 : DS.t4, whiteSpace: 'pre-wrap', display: '-webkit-box', WebkitLineClamp: 5, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {texto || 'O texto do post aparece aqui.'}
          </Typography>
        )}
        {midia}

        {rede === 'instagram' ? (
          <Box sx={{ px: 1.6, py: 1.2 }}>
            <Box sx={{ display: 'flex', gap: 1.6, color: DS.t1, mb: 1 }}>
              <FavoriteBorderIcon sx={{ fontSize: 22 }} /><ChatBubbleOutlineIcon sx={{ fontSize: 21 }} /><SendOutlinedIcon sx={{ fontSize: 21 }} />
              <Box sx={{ flex: 1 }} /><BookmarkBorderIcon sx={{ fontSize: 22 }} />
            </Box>
            <Typography sx={{ fontSize: '0.8rem', color: texto ? DS.t1 : DS.t4, whiteSpace: 'pre-wrap', display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
              {texto ? <><b>{nome}</b> {texto}</> : 'A descrição aparece aqui.'}
            </Typography>
          </Box>
        ) : (
          <Box sx={{ display: 'flex', justifyContent: 'space-around', py: 1.1, borderTop: `1px solid ${DS.border}`, color: DS.t2 }}>
            {[[ThumbUpOutlinedIcon, 'Curtir'], [ChatBubbleOutlineIcon, 'Comentar'], [ReplyOutlinedIcon, 'Compartilhar']].map(([Icone, rotulo]) => {
              const I = Icone as typeof ThumbUpOutlinedIcon
              return (
                <Box key={rotulo as string} sx={{ display: 'flex', alignItems: 'center', gap: 0.6 }}>
                  <I sx={{ fontSize: 18, transform: rotulo === 'Compartilhar' ? 'scaleX(-1)' : undefined }} />
                  <Typography sx={{ fontSize: '0.76rem', fontWeight: 600 }}>{rotulo as string}</Typography>
                </Box>
              )
            })}
          </Box>
        )}
      </Box>
      {((rede === 'instagram' && !perfil) || (rede === 'facebook' && !pagina)) && (
        <Typography sx={{ fontSize: '0.7rem', color: DS.amber, textAlign: 'center', mt: 1 }}>
          {rede === 'instagram' ? 'Instagram' : 'Página do Facebook'} não conectado para este cliente — publicação manual.
        </Typography>
      )}
    </Box>
  )
}
