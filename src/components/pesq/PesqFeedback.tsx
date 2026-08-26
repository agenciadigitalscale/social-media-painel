import { useEffect } from 'react'
import { Box, Snackbar } from '@mui/material'
import { PESQ } from '../../lib/pesq/brand'
import PesqLogo from './PesqLogo'
import { PesqBotao } from './PesqUI'

/* Confirmação e aviso. Duas peças pequenas que carregam o sentimento do
   módulo: a celebração quando algo sai do ar de pendência, e o aviso quando
   algo precisa de atenção. */

// ── Celebração ────────────────────────────────────────────────────────
export interface PesqSucessoInfo {
  titulo: string
  codigo: string
}

/**
 * Some sozinha em 2,2 s. Comemorar é bom; obrigar a fechar um modal para
 * continuar trabalhando, não — quem confirmou uma publicação normalmente tem
 * outra na fila.
 */
export function PesqSucesso({ info, onFim }: { info: PesqSucessoInfo | null; onFim: () => void }) {
  useEffect(() => {
    if (!info) return
    const id = setTimeout(onFim, 2200)
    return () => clearTimeout(id)
  }, [info, onFim])

  if (!info) return null

  return (
    <Box
      role="status"
      aria-live="polite"
      onClick={onFim}
      sx={{
        position: 'fixed', inset: 0, zIndex: 1400,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(4,19,17,0.72)', backdropFilter: 'blur(8px)',
        animation: `pesqPop 0.3s ${PESQ.ease} both`, cursor: 'pointer', px: 3,
      }}
    >
      <Box sx={{ position: 'relative', textAlign: 'center' }}>
        {/* Ondas concêntricas — água, não confete */}
        {[0, 1, 2].map(i => (
          <Box key={i} aria-hidden sx={{
            position: 'absolute', top: '50%', left: '50%', width: 150, height: 150,
            mt: '-75px', ml: '-75px', borderRadius: '50%',
            border: `1.5px solid ${PESQ.greenLum}`,
            animation: `pesqRipple 2.1s ${PESQ.soft} ${i * 340}ms infinite`,
          }} />
        ))}

        <Box sx={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          <Box sx={{ position: 'relative', width: 104, height: 104 }}>
            <PesqLogo size={104} variant="glow" />
            <Box
              component="svg"
              viewBox="0 0 52 52"
              aria-hidden
              sx={{
                position: 'absolute', right: -8, bottom: -8, width: 46, height: 46,
                borderRadius: '50%', background: PESQ.bg,
                border: `2px solid ${PESQ.greenLum}`, p: '6px',
                boxShadow: `0 8px 24px ${PESQ.greenMid}66`,
              }}
            >
              <path
                d="M12 27 L22 37 L40 16"
                fill="none" stroke={PESQ.greenLum} strokeWidth="5"
                strokeLinecap="round" strokeLinejoin="round"
                style={{ strokeDasharray: 44, animation: `pesqCheck 0.62s ${PESQ.ease} 0.14s both` }}
              />
            </Box>
          </Box>

          <Box>
            <Box sx={{ fontSize: { xs: '1.3rem', md: '1.6rem' }, fontWeight: 800, color: PESQ.t1, letterSpacing: '-0.03em' }}>
              Publicado! 🎣
            </Box>
            <Box sx={{ mt: 0.6, fontSize: '0.84rem', color: PESQ.t2, maxWidth: 420 }}>
              {info.titulo}
            </Box>
            <Box sx={{
              mt: 0.4, fontSize: '0.68rem', color: PESQ.t3,
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
            }}>
              {info.codigo} · lembretes encerrados
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  )
}

// ── Aviso ─────────────────────────────────────────────────────────────
export interface PesqAviso {
  msg: string
  tom: 'ok' | 'alerta' | 'erro'
  acao?: { label: string; onClick: () => void }
}

const TOM = {
  ok:     { cor: PESQ.greenLum, icone: '✅' },
  alerta: { cor: PESQ.amber,    icone: '⚠️' },
  erro:   { cor: PESQ.danger,   icone: '⛔' },
}

export function PesqToast({ aviso, onFechar }: { aviso: PesqAviso | null; onFechar: () => void }) {
  const t = aviso ? TOM[aviso.tom] : TOM.ok

  return (
    <Snackbar
      open={!!aviso}
      autoHideDuration={aviso?.acao ? 8000 : 4200}
      onClose={onFechar}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      sx={{ bottom: { xs: 78, md: 26 } }}
    >
      <Box
        role="alert"
        sx={{
          display: 'flex', alignItems: 'center', gap: 1.2,
          px: 1.8, py: 1.2, maxWidth: 460,
          borderRadius: `${PESQ.r.pill}px`,
          background: `linear-gradient(140deg, ${PESQ.surfaceAlt}, ${PESQ.bg})`,
          border: `1px solid ${t.cor}44`,
          boxShadow: `${PESQ.shadowUp}, 0 0 0 1px ${t.cor}14`,
          backdropFilter: 'blur(24px)',
          animation: `pesqRise 0.3s ${PESQ.ease} both`,
        }}
      >
        <Box aria-hidden sx={{ fontSize: '1rem', lineHeight: 1 }}>{t.icone}</Box>
        <Box sx={{ fontSize: '0.78rem', color: PESQ.t1, lineHeight: 1.45, flex: 1 }}>{aviso?.msg}</Box>
        {aviso?.acao && (
          <PesqBotao tamanho="sm" tom="outline" onClick={() => { aviso.acao?.onClick(); onFechar() }}>
            {aviso.acao.label}
          </PesqBotao>
        )}
      </Box>
    </Snackbar>
  )
}
