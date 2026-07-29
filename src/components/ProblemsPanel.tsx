import { useState } from 'react'
import { Box, Typography, Collapse, Tooltip } from '@mui/material'
import ReportProblemOutlinedIcon from '@mui/icons-material/ReportProblemOutlined'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import { DS } from '../theme'
import { clickable } from '../shared/a11y'
import type { IssueKind, ProductionIssue } from '../lib/productionIssues'

const KIND_TONE: Record<IssueKind, string> = {
  review_without_file: DS.amber,
  preview_failed:      DS.red,
  ambiguous:           DS.amber,
  scan_error:          DS.alert,
  linked_but_parked:   DS.cyan,
}

const KIND_LABEL: Record<IssueKind, string> = {
  review_without_file: 'Sem prévia',
  preview_failed:      'Não abre',
  ambiguous:           'Vários arquivos',
  scan_error:          'Pasta',
  linked_but_parked:   'Vídeo pronto',
}

/**
 * "Problemas para resolver" — os cards em que a automação parou e precisa de
 * alguém. Fica recolhido por padrão: quando não há nada, some da tela; quando
 * há, mostra a contagem no cabeçalho e a ação prática de cada caso.
 */
export default function ProblemsPanel({ issues, onAction, onOpenCard }: {
  issues: ProductionIssue[]
  onAction: (issue: ProductionIssue) => void
  onOpenCard?: (itemId: number) => void
}) {
  const [open, setOpen] = useState(false)

  if (issues.length === 0) return null

  return (
    <Box sx={{
      mb: 1.2, borderRadius: '12px', flexShrink: 0,
      bgcolor: DS.surface, border: `1px solid ${DS.amber}33`,
    }}>
      {/* Cabeçalho clicável */}
      <Box
        {...clickable(() => setOpen(v => !v))}
        sx={{
          display: 'flex', alignItems: 'center', gap: 1, px: 1.4, py: 1,
          cursor: 'pointer', borderRadius: '12px',
          '&:hover': { bgcolor: 'rgba(148,163,184,0.06)' },
          transition: 'background-color 0.18s ease',
        }}
      >
        <ReportProblemOutlinedIcon sx={{ fontSize: 16, color: DS.amber, flexShrink: 0 }} />
        <Typography sx={{ fontSize: '0.74rem', fontWeight: 800, color: DS.t1, flex: 1 }}>
          Problemas para resolver
        </Typography>
        <Box sx={{
          minWidth: 20, height: 18, px: 0.7, borderRadius: '6px',
          bgcolor: `${DS.amber}22`, border: `1px solid ${DS.amber}45`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Typography sx={{ fontSize: '0.62rem', fontWeight: 900, color: DS.amber, lineHeight: 1 }}>
            {issues.length}
          </Typography>
        </Box>
        <ExpandMoreIcon sx={{
          fontSize: 17, color: DS.t3, flexShrink: 0,
          transform: open ? 'rotate(180deg)' : 'none',
          transition: 'transform 0.2s ease',
        }} />
      </Box>

      <Collapse in={open}>
        <Box sx={{ px: 1, pb: 1, display: 'flex', flexDirection: 'column', gap: 0.6 }}>
          {issues.map(iss => {
            const tone = KIND_TONE[iss.kind]
            return (
              <Box
                key={`${iss.itemId}-${iss.kind}`}
                sx={{
                  display: 'flex', alignItems: 'center', gap: 1,
                  p: 0.9, borderRadius: '9px',
                  bgcolor: 'rgba(244,247,255,0.02)',
                  border: `1px solid ${tone}26`,
                }}
              >
                {/* Etiqueta do tipo */}
                <Box sx={{
                  px: 0.6, py: 0.2, borderRadius: '5px', flexShrink: 0,
                  bgcolor: `${tone}18`, border: `1px solid ${tone}3a`,
                }}>
                  <Typography sx={{
                    fontSize: '0.5rem', fontWeight: 800, color: tone,
                    textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap',
                  }}>
                    {KIND_LABEL[iss.kind]}
                  </Typography>
                </Box>

                {/* Card + motivo */}
                <Box
                  {...(onOpenCard ? clickable(() => onOpenCard(iss.itemId)) : {})}
                  sx={{ flex: 1, minWidth: 0, cursor: onOpenCard ? 'pointer' : 'default' }}
                >
                  <Typography sx={{ fontSize: '0.68rem', fontWeight: 700, color: DS.t1, lineHeight: 1.3 }} noWrap>
                    {iss.clientName} · {iss.title}
                  </Typography>
                  <Tooltip title={iss.detail ?? ''} placement="bottom-start">
                    <Typography sx={{ fontSize: '0.58rem', color: DS.t2, lineHeight: 1.35 }} noWrap>
                      {iss.message}
                    </Typography>
                  </Tooltip>
                </Box>

                {/* Ação prática */}
                <Box
                  {...clickable(() => onAction(iss))}
                  sx={{
                    px: 0.9, py: 0.4, borderRadius: '7px', flexShrink: 0, cursor: 'pointer',
                    fontSize: '0.58rem', fontWeight: 800, color: tone,
                    bgcolor: `${tone}16`, border: `1px solid ${tone}3d`,
                    whiteSpace: 'nowrap',
                    '&:hover': { bgcolor: `${tone}26` },
                    transition: 'background-color 0.15s ease',
                  }}
                >
                  {iss.actionLabel}
                </Box>
              </Box>
            )
          })}

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, px: 0.6, pt: 0.3 }}>
            <CheckCircleIcon sx={{ fontSize: 11, color: DS.t3 }} />
            <Typography sx={{ fontSize: '0.55rem', color: DS.t3 }}>
              Resolvidos somem daqui sozinhos.
            </Typography>
          </Box>
        </Box>
      </Collapse>
    </Box>
  )
}
