import { Box, Typography } from '@mui/material'
import type { ReactNode } from 'react'
import { DS } from '../../theme'

/**
 * PageHero — cabeçalho padrão das telas (SaaS premium, azul/ciano).
 * - Sem ícone: vira o cabeçalho de saudação/título grande (ex.: Dashboard).
 * - Com `icon`: vira o hero de página (quadrado azul→ciano com glow + título + badge).
 * `actions` fica alinhado à direita (seletor de mês, CTA, etc.).
 *
 * `accent` troca o quadrado do ícone por caixa tingida na cor dada — é o que
 * permite o Meu Dia usar a cor do membro sem sair da escala tipográfica comum.
 * O título fica em `DS.t1` nos dois casos: é ele que faz as telas parecerem o
 * mesmo produto, e headline colorida barateia o conjunto.
 */
interface PageHeroProps {
  title: ReactNode
  subtitle?: ReactNode
  icon?: ReactNode
  badge?: ReactNode
  actions?: ReactNode
  compact?: boolean
  accent?: string
}

export default function PageHero({ title, subtitle, icon, badge, actions, compact, accent }: PageHeroProps) {
  return (
    <Box sx={{
      display: 'flex', alignItems: { xs: 'flex-start', md: 'center' },
      gap: { xs: 1.4, md: 2 }, flexWrap: { xs: 'wrap', md: 'nowrap' },
    }}>
      {icon && (
        <Box sx={{
          width: { xs: 46, md: 54, xl: 62 }, height: { xs: 46, md: 54, xl: 62 }, flexShrink: 0,
          borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center',
          ...(accent
            ? {
                background: `${accent}18`,
                border: `1px solid ${accent}55`,
                boxShadow: `0 0 0 5px ${accent}0b, 0 10px 28px ${accent}22`,
                color: accent,
              }
            : {
                background: `linear-gradient(135deg, ${DS.accent}, ${DS.cyan})`,
                boxShadow: `0 10px 28px ${DS.accent}40, inset 0 1px 0 ${DS.t1}40`,
                color: '#fff',
              }),
          fontSize: { xs: '1.45rem', md: '1.65rem', xl: '1.9rem' },
          lineHeight: 1,
        }}>
          {icon}
        </Box>
      )}

      <Box sx={{ minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <Typography sx={{
            fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.05, color: DS.t1,
            fontSize: compact
              ? { xs: '1.15rem', md: '1.4rem', xl: '1.7rem' }
              : { xs: '1.5rem', md: '1.9rem', xl: '2.3rem' },
          }}>
            {title}
          </Typography>
          {badge}
        </Box>
        {subtitle && (
          <Typography sx={{
            fontSize: { xs: '0.72rem', md: '0.8rem', xl: '0.88rem' },
            color: 'text.secondary', mt: 0.4, lineHeight: 1.4,
          }}>
            {subtitle}
          </Typography>
        )}
      </Box>

      {actions && (
        <Box sx={{
          ml: { md: 'auto' }, display: 'flex', alignItems: 'center', gap: 1,
          flexShrink: 0, flexWrap: 'wrap',
        }}>
          {actions}
        </Box>
      )}
    </Box>
  )
}
