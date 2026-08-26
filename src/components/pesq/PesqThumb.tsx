import { Box } from '@mui/material'
import { PESQ, PESQ_LOGO } from '../../lib/pesq/brand'
import { extractDriveFileId } from '../../lib/whatsapp'
import type { PesqFormato, PesqPublicacao } from '../../lib/pesq/publicacoes'

/**
 * A miniatura do conteúdo.
 *
 * A pasta do cliente no Drive é privada, e `drive.google.com/thumbnail` só
 * responde para arquivo público — é por isso que o caminho é o `/api/thumb`
 * do painel, que passa pela conta de serviço. Mesma decisão já tomada na
 * Inbox: sem isso a lista vira uma coluna de emojis e ninguém reconhece o
 * criativo pelo nome do arquivo.
 *
 * Sem imagem, o lugar dela não fica vazio nem quebrado: vira um cartão da
 * marca com o ícone do formato. Falta de miniatura não é erro.
 */
export function thumbDe(pub: Pick<PesqPublicacao, 'thumbUrl' | 'driveLink'>): string | null {
  if (pub.thumbUrl) return pub.thumbUrl
  const id = pub.driveLink ? extractDriveFileId(pub.driveLink) : null
  return id ? `/api/thumb?id=${id}` : null
}

export const FORMATO_ICONE: Record<PesqFormato, string> = {
  Reels: '🎬', Carrossel: '🖼️', Foto: '📷', Stories: '⚡',
}

/** Reels e Stories são verticais; Carrossel e Foto, quadrados. */
export function proporcaoDe(formato: PesqFormato): string {
  return formato === 'Reels' || formato === 'Stories' ? '9 / 16' : '1 / 1'
}

export default function PesqThumb({ pub, largura = 78 }: { pub: PesqPublicacao; largura?: number }) {
  const src = thumbDe(pub)

  return (
    <Box sx={{
      position: 'relative', width: largura, aspectRatio: proporcaoDe(pub.formato),
      flexShrink: 0, borderRadius: `${PESQ.r.field}px`, overflow: 'hidden',
      border: `1px solid ${PESQ.borderSoft}`,
      background: `linear-gradient(150deg, ${PESQ.deep} 0%, ${PESQ.bgDeep} 100%)`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {src ? (
        <Box
          component="img"
          src={src}
          alt={`Prévia de ${pub.titulo}`}
          loading="lazy"
          onError={(e: React.SyntheticEvent<HTMLImageElement>) => { e.currentTarget.style.display = 'none' }}
          sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      ) : (
        <>
          <Box
            aria-hidden
            component="img"
            src={PESQ_LOGO}
            alt=""
            sx={{ position: 'absolute', width: '150%', height: '150%', objectFit: 'contain', opacity: 0.07 }}
          />
          <Box aria-hidden sx={{ position: 'relative', fontSize: largura > 70 ? '1.5rem' : '1.1rem', opacity: 0.9 }}>
            {FORMATO_ICONE[pub.formato]}
          </Box>
        </>
      )}
    </Box>
  )
}
