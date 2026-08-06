import { useEffect, useRef, useState } from 'react'
import { Box, Button, Typography } from '@mui/material'
import { DS } from '../../theme'
import { driveViewUrlFor, streamUrlFor } from '../../lib/videoMatch'

/**
 * Moldura de reprodução do criativo — a mesma no modal de revisão e dentro do
 * card. Nasceu no `ReviewModal`; virou primitivo quando o segundo lugar pediu
 * a mesma coisa (ver o vídeo sem sair de onde se está).
 *
 * O que ela resolve, e que um `<video src>` solto não resolve:
 *  - **Proporção.** Reel e Story são verticais. Numa moldura 16:9 fixa o vídeo
 *    virava uma tarja no meio da tela — e o board de Vídeo só tem vertical. A
 *    moldura usa um palpite pelo tipo do card e se corrige com a proporção real
 *    assim que o arquivo carrega.
 *  - **Poster.** Vem do `/api/thumb` (service account): a pasta Publicar é
 *    privada, então `drive.google.com/thumbnail` devolve nada e o player abre
 *    preto.
 *  - **Mime.** `streamUrlFor(..., 'video'|'image')` manda a dica que o
 *    `/api/stream` usa quando o Drive responde `application/octet-stream` —
 *    sem ela o Safari recusa o arquivo sem nem tentar.
 *  - **Descarregar ao sair.** Sem o desmonte explícito, o buffer continua
 *    baixando em segundo plano depois de fechar.
 */

/** Extensão como plano B quando o vínculo não guardou o mime. */
const IMAGE_EXT = /\.(png|jpe?g|webp|gif|heic|avif)$/i

export function isImageFile(mimeType?: string, filename?: string): boolean {
  if (mimeType) return mimeType.startsWith('image/')
  return !!filename && IMAGE_EXT.test(filename)
}

/** Palpite de proporção enquanto o arquivo não carrega. */
export function ratioHint(contentType?: string): number {
  return contentType === 'Reel' || contentType === 'Story' ? 9 / 16 : 16 / 9
}

interface Props {
  fileId: string
  /** Título do card — só `alt` da imagem. */
  title?: string
  /** Nome do arquivo no Drive — plano B para adivinhar o formato sem mime. */
  filename?: string
  /** Mime do arquivo vinculado — decide entre player e imagem. */
  mimeType?: string
  /** Tipo do card: só serve de palpite de formato até o arquivo carregar. */
  contentType?: string
  /**
   * Teto de altura da moldura. O modal pode ocupar a tela; dentro do card, não —
   * um Reel a `64dvh` empurraria todo o resto do card para fora da vista.
   */
  maxHeight?: { xs: string; md: string }
  /**
   * `metadata` é o padrão: o card pode ter um player que ninguém vai tocar, e
   * baixar o vídeo inteiro por precaução custa banda de todo mundo.
   */
  preload?: 'none' | 'metadata' | 'auto'
  autoPlay?: boolean
}

export default function MediaPreview({
  fileId, title, filename, mimeType, contentType,
  maxHeight = { xs: '52dvh', md: '64dvh' },
  preload = 'metadata',
  autoPlay = false,
}: Props) {
  const [failed, setFailed] = useState(false)
  // Proporção real do arquivo, conhecida só depois que ele carrega.
  const [ratio, setRatio]   = useState<number | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)

  const isImage = isImageFile(mimeType, filename)
  const r = ratio ?? ratioHint(contentType)

  // Trocar de arquivo é remontar: quem chama passa `key={fileId}`. Zerar
  // `failed`/`ratio` por efeito faria uma renderização em cascata para chegar
  // no mesmo lugar — e deixaria a proporção do arquivo anterior aparecer por
  // um quadro.
  useEffect(() => () => {
    const v = videoRef.current
    if (!v) return
    try { v.pause(); v.removeAttribute('src'); v.load() } catch { /* já descartado */ }
  }, [])

  const fill = {
    position: 'absolute' as const, inset: 0,
    width: '100%', height: '100%',
    objectFit: 'contain' as const, bgcolor: '#000', border: 0,
  }

  return (
    <Box sx={{
      position: 'relative', width: '100%', mx: 'auto',
      aspectRatio: String(r),
      maxHeight,
      maxWidth: { xs: `calc(${maxHeight.xs} * ${r})`, md: `calc(${maxHeight.md} * ${r})` },
      borderRadius: '14px', overflow: 'hidden', bgcolor: '#000',
      border: `1px solid ${DS.border}`,
      transition: 'max-width 0.2s ease',
    }}>
      {failed ? (
        <Box sx={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1, px: 3, textAlign: 'center' }}>
          <Typography sx={{ fontSize: '0.75rem', color: DS.t2 }}>
            Não foi possível {isImage ? 'exibir' : 'reproduzir'} aqui.
          </Typography>
          <Button size="small" component="a" href={driveViewUrlFor(fileId)} target="_blank" rel="noopener"
            sx={{ fontSize: '0.65rem', color: DS.accent }}>
            Abrir no Drive
          </Button>
        </Box>
      ) : isImage ? (
        <Box
          component="img"
          src={streamUrlFor(fileId, 'image')}
          alt={title ?? ''}
          onLoad={e => {
            const img = e.currentTarget
            if (img.naturalWidth > 0 && img.naturalHeight > 0) setRatio(img.naturalWidth / img.naturalHeight)
          }}
          onError={() => setFailed(true)}
          sx={fill}
        />
      ) : (
        <Box
          component="video"
          ref={videoRef}
          src={streamUrlFor(fileId, 'video')}
          poster={`/api/thumb?id=${encodeURIComponent(fileId)}&sz=400`}
          controls
          playsInline
          preload={preload}
          autoPlay={autoPlay}
          onLoadedMetadata={e => {
            const v = e.currentTarget
            if (v.videoWidth > 0 && v.videoHeight > 0) setRatio(v.videoWidth / v.videoHeight)
          }}
          onError={() => setFailed(true)}
          sx={fill}
        />
      )}
    </Box>
  )
}
