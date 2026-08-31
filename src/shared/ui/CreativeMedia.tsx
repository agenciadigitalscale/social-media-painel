import { useState, useEffect, useRef } from 'react'
import { Box, Typography, Button, CircularProgress } from '@mui/material'
import { DS } from '../../theme'
import type { CreativeFile } from '../../lib/creativeLink'

/* O criativo na tela de quem decide.
   Estava duplicado: o viewer do cliente tinha uma cadeia de fontes e a revisão
   interna tinha outra (só o lh3.googleusercontent, que falha em pasta privada).
   Um arquivo que abre para o cliente e não abre para o revisor — ou o contrário —
   é a pior forma de descobrir um problema de entrega. Agora é o mesmo código. */

function buildImageCandidates(fileId: string | null, rawLink: string): string[] {
  // Nossos endpoints primeiro: os do Google só respondem para arquivo público, e
  // pasta Publicar é privada por padrão — começar por eles é começar por falhar.
  //
  // ⚠️ O `/api/stream` vem ANTES do `/api/thumb`, e a ordem é o ponto: o thumb
  // limita o lado maior em 400px (acima disso o Drive devolve o quadro cheio,
  // 871 KB, e o endpoint existe para servir POSTER de vídeo). Como ele
  // respondia 200, a cadeia parava nele e **o cliente aprovava um JPG de
  // 400px** — arte de 1080 chegando borrada, que é metade do "manda em outro
  // formato" que a equipe ouvia. O stream entrega o arquivo original, já
  // espelhado no R2.
  if (fileId) return [
    `/api/stream?id=${fileId}&kind=image`,
    `/api/thumb?id=${fileId}&sz=400`,
    `https://lh3.googleusercontent.com/d/${fileId}=w1600`,
    `https://drive.google.com/thumbnail?id=${fileId}&sz=w1600`,
  ]
  if (rawLink && /^https?:\/\//i.test(rawLink)) return [rawLink]
  return []
}

export function CreativeImage({ fileId, rawLink, title, onExhausted }: {
  fileId: string | null
  rawLink: string
  title: string
  /** Nada carregou — a agência precisa saber, e precisa saber POR QUÊ. */
  onExhausted?: (detail: string) => void
}) {
  const candidates = buildImageCandidates(fileId, rawLink)
  const [idx, setIdx]       = useState(0)
  const [loaded, setLoaded] = useState(false)
  const [zoomed, setZoomed] = useState(false)

  useEffect(() => { setIdx(0); setLoaded(false) }, [fileId, rawLink])

  const exhausted = candidates.length === 0 || idx >= candidates.length
  const reportedRef = useRef(false)
  useEffect(() => {
    if (!exhausted || reportedRef.current) return
    reportedRef.current = true

    /**
     * O caso `candidates.length === 0` era SILENCIOSO até 2026-08-07: o cliente
     * recebia um link para nada ("o criativo ainda não foi anexado") e a equipe
     * nunca ficava sabendo. É pior que imagem quebrada — foi mandado vazio.
     *
     * E "todas as fontes falharam" não dizia o suficiente: com fileId do Drive,
     * as quatro fontes caem juntas quando o arquivo está numa pasta que a nossa
     * conta de serviço não lê (link colado de outro Drive, sem compartilhar).
     * Sem essa distinção, o registro não separa "arquivo inacessível" de "link
     * que não é do Drive" — e as duas pedem ações diferentes.
     */
    onExhausted?.(
      candidates.length === 0
        ? (rawLink ? 'imagem: link não reconhecido como criativo' : 'imagem: nenhum criativo anexado ao card')
        : fileId
          ? `imagem: ${candidates.length} fontes falharam — arquivo do Drive inacessível (${fileId.slice(0, 12)})`
          : `imagem: ${candidates.length} fontes falharam — link direto não carregou`,
    )
  }, [exhausted, candidates.length, fileId, rawLink, onExhausted])

  if (exhausted) {
    const openUrl = fileId ? `https://drive.google.com/file/d/${fileId}/view` : rawLink
    return (
      <Box sx={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1.5, px: 3, textAlign: 'center', bgcolor: '#000' }}>
        <Box component="img" src="/logotipo.png" sx={{ height: 32, opacity: 0.55, mb: 0.5 }} />
        <Typography sx={{ fontSize: '0.82rem', color: 'rgba(244,247,255,0.6)', lineHeight: 1.6, maxWidth: 280 }}>
          Não foi possível carregar a imagem.{!fileId && !rawLink ? ' O criativo ainda não foi anexado.' : ''}
        </Typography>
        {openUrl && (
          <Button variant="outlined" size="small" href={openUrl} target="_blank" rel="noopener"
            sx={{ borderColor: 'rgba(59,130,246,0.5)', color: DS.accent, fontWeight: 700, mt: 0.5 }}>
            Abrir imagem
          </Button>
        )}
      </Box>
    )
  }

  return (
    <Box
      onClick={() => setZoomed(z => !z)}
      sx={{
        position: 'absolute', inset: 0, bgcolor: '#000',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        overflow: zoomed ? 'auto' : 'hidden',
        cursor: zoomed ? 'zoom-out' : 'zoom-in',
      }}
    >
      {!loaded && (
        <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
          <CircularProgress size={30} sx={{ color: DS.accent }} />
        </Box>
      )}
      <Box
        component="img"
        src={candidates[idx]}
        alt={title}
        onLoad={() => setLoaded(true)}
        onError={() => { setLoaded(false); setIdx(i => i + 1) }}
        sx={{
          display: 'block',
          width:  zoomed ? 'auto' : '100%',
          height: zoomed ? 'auto' : '100%',
          maxWidth:  zoomed ? 'none' : '100%',
          maxHeight: zoomed ? 'none' : '100%',
          objectFit: 'contain',
          opacity: loaded ? 1 : 0,
          transition: 'opacity 0.25s ease',
        }}
      />
    </Box>
  )
}

/**
 * Carrossel — a pasta do Drive virando as lâminas que o cliente aprova.
 *
 * Cada imagem passa pelo mesmo `PostImage` (mesma cadeia de fontes, mesmo
 * fallback honesto). O que muda é a navegação: arrasta no dedo, seta no
 * teclado/mouse, e o contador dizendo em qual lâmina está — sem contador o
 * cliente não sabe se viu o carrossel inteiro, e é a sequência que ele aprova.
 */
export function CreativeCarousel({ imagens, title, i, setI, onExhausted }: {
  imagens: CreativeFile[]
  title: string
  /** O índice mora no pai: o botão de baixar precisa saber qual lâmina está na tela. */
  i: number
  setI: (n: number) => void
  onExhausted?: (detail: string) => void
}) {
  const toqueX = useRef<number | null>(null)

  const total = imagens.length
  const ir = (delta: number) => setI(Math.min(Math.max(i + delta, 0), total - 1))

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') ir(1)
      if (e.key === 'ArrowLeft')  ir(-1)
    }
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  })

  const seta = (lado: 'left' | 'right', ativo: boolean, onClick: () => void) => (
    <Box
      onClick={e => { e.stopPropagation(); onClick() }}
      role="button"
      aria-label={lado === 'left' ? 'Imagem anterior' : 'Próxima imagem'}
      tabIndex={0}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick() } }}
      sx={{
        position: 'absolute', top: '50%', [lado]: 8, transform: 'translateY(-50%)',
        width: 38, height: 38, borderRadius: '50%', zIndex: 3,
        display: ativo ? 'flex' : 'none', alignItems: 'center', justifyContent: 'center',
        bgcolor: 'rgba(5,9,18,0.62)', border: '1px solid rgba(244,247,255,0.18)',
        color: '#fff', fontSize: '1.1rem', cursor: 'pointer', userSelect: 'none',
        backdropFilter: 'blur(6px)',
        '&:hover': { bgcolor: 'rgba(5,9,18,0.82)' },
      }}
    >
      {lado === 'left' ? '‹' : '›'}
    </Box>
  )

  return (
    <Box
      sx={{ position: 'absolute', inset: 0, bgcolor: '#000' }}
      onTouchStart={e => { toqueX.current = e.touches[0].clientX }}
      onTouchEnd={e => {
        if (toqueX.current === null) return
        const dx = e.changedTouches[0].clientX - toqueX.current
        // 45px: abaixo disso é toque tremido, não gesto de virar página.
        if (Math.abs(dx) > 45) ir(dx < 0 ? 1 : -1)
        toqueX.current = null
      }}
    >
      {/* Só a lâmina atual e as vizinhas ficam montadas: uma pasta de 10 fotos
          pediria 10 downloads de uma vez no 4G do cliente. */}
      {imagens.map((img, idx) => (
        Math.abs(idx - i) <= 1 ? (
          <Box key={img.id} sx={{ position: 'absolute', inset: 0, opacity: idx === i ? 1 : 0, pointerEvents: idx === i ? 'auto' : 'none', transition: 'opacity 0.22s ease' }}>
            <CreativeImage
              fileId={img.id}
              rawLink=""
              title={`${title} — ${idx + 1} de ${total}`}
              onExhausted={idx === i ? onExhausted : undefined}
            />
          </Box>
        ) : null
      ))}

      {seta('left', i > 0, () => ir(-1))}
      {seta('right', i < total - 1, () => ir(1))}

      <Box sx={{
        position: 'absolute', top: 10, right: 10, zIndex: 3,
        px: 1, py: 0.3, borderRadius: 2, fontSize: '0.68rem', fontWeight: 700,
        color: '#fff', bgcolor: 'rgba(5,9,18,0.66)', border: '1px solid rgba(244,247,255,0.16)',
      }}>
        {i + 1}/{total}
      </Box>

      <Box sx={{
        position: 'absolute', bottom: 10, left: 0, right: 0, zIndex: 3,
        display: 'flex', justifyContent: 'center', gap: 0.7,
      }}>
        {imagens.map((img, idx) => (
          <Box
            key={img.id}
            onClick={e => { e.stopPropagation(); setI(idx) }}
            role="button"
            aria-label={`Ir para a imagem ${idx + 1}`}
            tabIndex={0}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setI(idx) } }}
            sx={{
              width: idx === i ? 20 : 7, height: 7, borderRadius: 4, cursor: 'pointer',
              bgcolor: idx === i ? DS.accent : 'rgba(244,247,255,0.42)',
              transition: 'all 0.2s ease',
            }}
          />
        ))}
      </Box>
    </Box>
  )
}

