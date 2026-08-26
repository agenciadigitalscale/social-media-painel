import { Box, ButtonBase, type SxProps, type Theme } from '@mui/material'
import type { ReactNode } from 'react'
import { PESQ } from '../../lib/pesq/brand'

/* Primitivos do ambiente PESQ. Existem para que nenhuma tela precise repetir
   cor, raio, sombra ou curva à mão — e para que a identidade não escorra para
   o resto do painel: nada daqui é exportado para fora do módulo. */

/** `sx` do MUI pode ser objeto, função ou lista; espalhar com `...` quebra os
 *  dois últimos casos. Compor em lista é a forma que aceita qualquer um. */
export type EstiloSx = Exclude<Extract<SxProps<Theme>, readonly unknown[]>[number], boolean>

export function sxLista(sx?: SxProps<Theme>): EstiloSx[] {
  if (!sx) return []
  return (Array.isArray(sx) ? sx : [sx]) as EstiloSx[]
}

// ── Superfície ────────────────────────────────────────────────────────
interface SurfaceProps {
  children: ReactNode
  /** Cartão que reage ao ponteiro (sobe 4px, borda acende) */
  interactive?: boolean
  /** Elevado: fundo mais claro e sombra maior (painéis de destaque) */
  raised?: boolean
  /** Fio de luz na borda superior — só para o painel principal */
  crown?: boolean
  sx?: SxProps<Theme>
}

export function PesqSurface({ children, interactive, raised, crown, sx }: SurfaceProps) {
  return (
    <Box sx={[{
      position: 'relative',
      background: raised
        ? `linear-gradient(168deg, ${PESQ.surfaceAlt} 0%, ${PESQ.surface} 100%)`
        : PESQ.surface,
      border: `1px solid ${PESQ.border}`,
      borderRadius: `${PESQ.r.card}px`,
      boxShadow: raised ? PESQ.shadowUp : PESQ.shadow,
      transition: `transform ${PESQ.base} ${PESQ.ease}, border-color ${PESQ.base} ${PESQ.soft}, box-shadow ${PESQ.base} ${PESQ.soft}`,
      ...(crown && {
        '&::before': {
          content: '""', position: 'absolute', top: 0, left: 18, right: 18, height: '1px',
          background: `linear-gradient(90deg, transparent, ${PESQ.greenLum}66, transparent)`,
        },
      }),
      ...(interactive && {
        '@media (hover: hover)': {
          '&:hover': {
            transform: 'translateY(-4px)',
            borderColor: PESQ.borderLive,
            boxShadow: `${PESQ.shadowUp}, 0 0 0 1px ${PESQ.greenLum}1f`,
          },
        },
        '&:focus-within': { borderColor: PESQ.borderLive },
      }),
    }, ...sxLista(sx)]}>
      {children}
    </Box>
  )
}

// ── Botão ─────────────────────────────────────────────────────────────
type BotaoTom = 'cta' | 'solid' | 'ghost' | 'outline' | 'danger'

interface BotaoProps {
  children: ReactNode
  onClick?: (e: React.MouseEvent) => void
  tom?: BotaoTom
  /** `sm` cabe em linha de card; `md` é o padrão; `lg` é CTA de topo */
  tamanho?: 'sm' | 'md' | 'lg'
  disabled?: boolean
  fullWidth?: boolean
  startIcon?: ReactNode
  title?: string
  'aria-label'?: string
  type?: 'button' | 'submit'
  sx?: SxProps<Theme>
}

// Alvo de toque: nada abaixo de 34px de altura, e botão só-ícone quadrado — no
// celular a diferença entre 27 e 36 é acertar ou errar o botão com o polegar.
const ALTURA = { sm: 34, md: 40, lg: 46 }
const FONTE  = { sm: '0.72rem', md: '0.8rem', lg: '0.86rem' }

export function PesqBotao({
  children, onClick, tom = 'ghost', tamanho = 'md', disabled, fullWidth,
  startIcon, title, type = 'button', sx, ...rest
}: BotaoProps) {
  // O CTA usa `gradientCta` (para no verde intermediário) com texto quase
  // preto: é a única combinação da marca que passa em AA na extensão inteira
  // do gradiente. Ver a medição em `brand.ts`.
  const tons: Record<BotaoTom, EstiloSx> = {
    cta: {
      background: PESQ.gradientCta,
      color: PESQ.onAccent,
      fontWeight: 800,
      boxShadow: PESQ.shadowGlow,
      '@media (hover: hover)': {
        '&:hover': { filter: 'brightness(1.06)', transform: 'translateY(-1px)', boxShadow: `0 14px 40px ${PESQ.greenMid}55` },
      },
    },
    solid: {
      background: PESQ.emerald, color: PESQ.white, fontWeight: 700,
      '@media (hover: hover)': { '&:hover': { background: PESQ.greenMid } },
    },
    ghost: {
      background: 'rgba(234,247,241,0.05)', color: PESQ.t1,
      border: `1px solid ${PESQ.borderSoft}`,
      '@media (hover: hover)': { '&:hover': { background: 'rgba(82,220,96,0.12)', borderColor: PESQ.borderLive, color: PESQ.t1 } },
    },
    outline: {
      background: 'transparent', color: PESQ.greenLum,
      border: `1px solid ${PESQ.borderLive}`,
      '@media (hover: hover)': { '&:hover': { background: 'rgba(82,220,96,0.1)' } },
    },
    danger: {
      background: 'rgba(229,84,75,0.12)', color: PESQ.danger,
      border: `1px solid rgba(229,84,75,0.34)`,
      '@media (hover: hover)': { '&:hover': { background: 'rgba(229,84,75,0.2)' } },
    },
  }

  return (
    <ButtonBase
      type={type}
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={rest['aria-label']}
      sx={[{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 0.9,
        height: ALTURA[tamanho], minWidth: ALTURA[tamanho], px: tamanho === 'sm' ? 1.5 : 2.2,
        width: fullWidth ? '100%' : 'auto',
        borderRadius: `${PESQ.r.pill}px`,
        fontSize: FONTE[tamanho], fontWeight: 700, letterSpacing: '-0.01em',
        lineHeight: 1, whiteSpace: 'nowrap',
        transition: `all ${PESQ.base} ${PESQ.soft}`,
        '&.Mui-disabled': { opacity: 0.42, filter: 'saturate(0.5)' },
        '& svg': { fontSize: tamanho === 'sm' ? 15 : 18 },
      }, tons[tom], ...sxLista(sx)]}
    >
      {startIcon}
      {children}
    </ButtonBase>
  )
}

// ── Pílula / chip ─────────────────────────────────────────────────────
export function PesqPill({ children, cor = PESQ.t2, forte, sx }: {
  children: ReactNode; cor?: string; forte?: boolean; sx?: SxProps<Theme>
}) {
  return (
    <Box sx={[{
      display: 'inline-flex', alignItems: 'center', gap: 0.6,
      px: 1, py: 0.36, borderRadius: `${PESQ.r.chip}px`,
      fontSize: '0.63rem', fontWeight: 700, lineHeight: 1.5,
      color: cor,
      background: forte ? `${cor}1f` : 'rgba(234,247,241,0.05)',
      border: `1px solid ${forte ? `${cor}45` : PESQ.borderSoft}`,
      whiteSpace: 'nowrap',
    }, ...sxLista(sx)]}>
      {children}
    </Box>
  )
}

// ── Rótulo de seção ───────────────────────────────────────────────────
export function PesqLabel({ children, sx }: { children: ReactNode; sx?: SxProps<Theme> }) {
  return (
    <Box component="h2" sx={[{
      m: 0, fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase',
      letterSpacing: '0.12em', color: PESQ.t3,
    }, ...sxLista(sx)]}>
      {children}
    </Box>
  )
}

// ── Ponto de status ───────────────────────────────────────────────────
export function PesqDot({ cor, pulsar }: { cor: string; pulsar?: boolean }) {
  return (
    <Box aria-hidden sx={{
      width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
      bgcolor: cor, boxShadow: `0 0 8px ${cor}aa`,
      ...(pulsar && { animation: 'pesqPulse 2.2s ease-in-out infinite' }),
    }} />
  )
}
