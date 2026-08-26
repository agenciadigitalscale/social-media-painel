import { Box, TextField, type SxProps, type Theme } from '@mui/material'
import type { ReactNode } from 'react'
import { PESQ } from '../../lib/pesq/brand'
import { sxLista, type EstiloSx } from './PesqUI'

/* Campos de formulário na linguagem do PESQ. O MUI entra por baixo (foco,
   teclado, leitor de tela e `label` de verdade continuam sendo dele) e só a
   pele muda — reescrever input à mão seria jogar acessibilidade fora por
   estética. */

export const campoSx: EstiloSx = {
  '& .MuiOutlinedInput-root': {
    background: PESQ.field,
    borderRadius: `${PESQ.r.field}px`,
    color: PESQ.t1,
    fontSize: '0.84rem',
    // O `size="small"` do MUI dá 36px de altura, curto para dedo. No celular
    // o campo cresce; no desktop, onde o alvo é o ponteiro, fica compacto.
    minHeight: { xs: 46, md: 40 },
    '& fieldset': { borderColor: PESQ.borderSoft },
    '&:hover fieldset': { borderColor: PESQ.border },
    '&.Mui-focused fieldset': { borderColor: PESQ.greenLum, borderWidth: '1.5px' },
  },
  '& .MuiInputLabel-root': { color: PESQ.t2, fontSize: '0.82rem' },
  '& .MuiInputLabel-root.Mui-focused': { color: PESQ.greenLum },
  '& .MuiFormHelperText-root': { color: PESQ.t3, fontSize: '0.66rem', ml: 0.4 },
  '& .MuiFormHelperText-root.Mui-error': { color: PESQ.danger },
  '& input::-webkit-calendar-picker-indicator': { filter: 'invert(0.8) sepia(1) saturate(3) hue-rotate(85deg)' },
}

export function PesqCampo(props: React.ComponentProps<typeof TextField>) {
  const { sx, ...resto } = props
  return <TextField size="small" fullWidth {...resto} sx={[campoSx, ...sxLista(sx)]} />
}

/** Escolha única em pílulas — mais rápida no polegar que um `select`. */
export function PesqSegmentado<T extends string>({ valor, opcoes, onChange, rotulo }: {
  valor: T
  opcoes: { valor: T; label: ReactNode }[]
  onChange: (v: T) => void
  rotulo: string
}) {
  return (
    <Box role="radiogroup" aria-label={rotulo} sx={{ display: 'flex', gap: 0.7, flexWrap: 'wrap' }}>
      {opcoes.map(o => {
        const ativo = o.valor === valor
        return (
          <Box
            key={o.valor}
            role="radio"
            aria-checked={ativo}
            tabIndex={0}
            onClick={() => onChange(o.valor)}
            onKeyDown={e => {
              if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onChange(o.valor) }
            }}
            sx={{
              px: 1.5, minHeight: 38, borderRadius: `${PESQ.r.pill}px`, cursor: 'pointer',
              fontSize: '0.76rem', fontWeight: 700, lineHeight: 1,
              display: 'inline-flex', alignItems: 'center', gap: 0.5,
              color: ativo ? PESQ.onAccent : PESQ.t2,
              background: ativo ? PESQ.gradientCta : 'rgba(234,247,241,0.05)',
              border: `1px solid ${ativo ? 'transparent' : PESQ.borderSoft}`,
              boxShadow: ativo ? PESQ.shadowGlow : 'none',
              transition: `all ${PESQ.base} ${PESQ.soft}`,
              '@media (hover: hover)': {
                '&:hover': { borderColor: ativo ? 'transparent' : PESQ.borderLive, color: ativo ? PESQ.onAccent : PESQ.t1 },
              },
            }}
          >
            {o.label}
          </Box>
        )
      })}
    </Box>
  )
}

/** Interruptor com explicação — o texto ao lado é clicável junto. */
export function PesqSwitch({ ligado, onChange, titulo, descricao }: {
  ligado: boolean; onChange: (v: boolean) => void; titulo: string; descricao?: string
}) {
  return (
    <Box
      role="switch"
      aria-checked={ligado}
      tabIndex={0}
      onClick={() => onChange(!ligado)}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onChange(!ligado) } }}
      sx={{
        display: 'flex', alignItems: 'center', gap: 1.2, cursor: 'pointer',
        p: 1.2, borderRadius: `${PESQ.r.field}px`,
        background: ligado ? `${PESQ.greenLum}12` : 'rgba(234,247,241,0.03)',
        border: `1px solid ${ligado ? `${PESQ.greenLum}38` : PESQ.borderSoft}`,
        transition: `all ${PESQ.base} ${PESQ.soft}`,
      }}
    >
      <Box aria-hidden sx={{
        width: 40, height: 23, borderRadius: 999, flexShrink: 0, position: 'relative',
        background: ligado ? PESQ.gradientCta : 'rgba(234,247,241,0.14)',
        transition: `background ${PESQ.base} ${PESQ.soft}`,
      }}>
        <Box sx={{
          position: 'absolute', top: 3, left: ligado ? 20 : 3, width: 17, height: 17,
          borderRadius: '50%', background: ligado ? PESQ.onAccent : PESQ.t2,
          transition: `left ${PESQ.base} ${PESQ.ease}`,
        }} />
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Box sx={{ fontSize: '0.8rem', fontWeight: 700, color: PESQ.t1 }}>{titulo}</Box>
        {descricao && <Box sx={{ fontSize: '0.68rem', color: PESQ.t3, mt: 0.2, lineHeight: 1.4 }}>{descricao}</Box>}
      </Box>
    </Box>
  )
}
