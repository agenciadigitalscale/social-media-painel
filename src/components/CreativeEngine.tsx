import { useState } from 'react'
import {
  Dialog, Box, Typography, IconButton, Button, TextField, MenuItem,
  Tooltip, useMediaQuery, CircularProgress,
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import CreativeResultCard from './CreativeResultCard'
import {
  BRIEF_VAZIO, NICHES, OBJETIVOS, FORMATOS, TONS, DURACOES,
  runEngine, hasAIKey, creativeToText, nicheByKey, guessNicho,
  saveCreative, loadCreatives, removeCreative,
  type CreativeBrief, type CreativeOutput, type GenOpts, type SavedCreative, type EngineSource,
} from '../lib/creativeEngine'

interface Props {
  open: boolean
  onClose: () => void
  currentUser?: string
  contexto?: Partial<CreativeBrief>      // prefill vindo do card do Editor
  onUsarRoteiro?: (texto: string) => void
}

const ORANGE = '#ff9039'

export default function CreativeEngine({ open, onClose, currentUser, contexto, onUsarRoteiro }: Props) {
  const isMobile = useMediaQuery('(max-width:599.95px)')
  const [brief, setBrief]     = useState<CreativeBrief>(() => {
    const base = { ...BRIEF_VAZIO, ...contexto }
    if (!contexto?.nicho && (contexto?.cliente || contexto?.produto)) {
      base.nicho = guessNicho(`${contexto?.cliente ?? ''} ${contexto?.produto ?? ''}`)
    }
    if (!base.objecao) base.objecao = ''   // mantém placeholder do nicho
    return base
  })
  const [output, setOutput]   = useState<CreativeOutput | null>(null)
  const [source, setSource]   = useState<EngineSource | null>(null)
  const [genOpts, setGenOpts] = useState<GenOpts>({ seed: 0 })
  const [loading, setLoading] = useState(false)
  const hasKey = hasAIKey()
  const [formOpen, setFormOpen] = useState(true)
  const [saved, setSaved]     = useState<SavedCreative[]>(() => loadCreatives())
  const [savedFlash, setSavedFlash] = useState(false)
  const [checks, setChecks]   = useState<Set<number>>(new Set())

  function set<K extends keyof CreativeBrief>(k: K, v: CreativeBrief[K]) {
    setBrief(b => ({ ...b, [k]: v }))
  }

  function onNichoChange(value: string) {
    setBrief(b => ({
      ...b, nicho: value,
      objecao: b.objecao.trim() ? b.objecao : nicheByKey(value).objecoesComuns[0],
    }))
  }

  async function run(extra: Partial<GenOpts> = {}, reset = false) {
    const next: GenOpts = reset ? { seed: 0, ...extra } : { ...genOpts, ...extra, current: undefined }
    const isRefine = !!(next.especifico || next.anuncio || next.edicaoDetalhada)
    const payload: GenOpts = isRefine && output ? { ...next, current: output } : next
    setGenOpts(next)
    setLoading(true)
    setChecks(new Set())
    try {
      const { output: out, source: src } = await runEngine(brief, payload)
      setOutput(out)
      setSource(src)
    } finally {
      setLoading(false)
      if (isMobile) setFormOpen(false)
    }
  }

  function doSave() {
    if (!output) return
    setSaved(saveCreative(brief, output, currentUser))
    setSavedFlash(true)
    setTimeout(() => setSavedFlash(false), 1600)
  }

  function loadSaved(s: SavedCreative) {
    setBrief(s.brief); setOutput(s.output); setSource(null); setGenOpts({ seed: 0 }); setChecks(new Set())
    if (isMobile) setFormOpen(false)
  }

  function toggleCheck(i: number) {
    setChecks(prev => { const n = new Set(prev); n.has(i) ? n.delete(i) : n.add(i); return n })
  }

  const niche = nicheByKey(brief.nicho)
  const showForm = !isMobile || formOpen

  // ── Estilos compartilhados dos campos ──
  const fieldSx = {
    '& .MuiInputBase-root': { fontSize: '0.82rem', bgcolor: 'rgba(255,255,255,0.03)' },
    '& .MuiInputLabel-root': { fontSize: '0.78rem' },
  } as const

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="lg" fullScreen={isMobile}
      PaperProps={{ sx: { bgcolor: '#0a0b0f', backgroundImage: 'none', height: isMobile ? '100%' : '92vh', maxHeight: isMobile ? '100%' : '92vh', display: 'flex', flexDirection: 'column' } }}>

      {/* ── Header ── */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2, py: 1.3, borderBottom: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 }}>
        <Typography sx={{ fontSize: '0.9rem' }}>⚡</Typography>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: '0.95rem', fontWeight: 900, color: '#fff', lineHeight: 1.1 }}>Creative Engine DS</Typography>
          <Typography noWrap sx={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.4)' }}>
            {brief.cliente ? `${brief.cliente} · ` : ''}copy · roteiro · edição · venda
          </Typography>
        </Box>
        <IconButton size="small" onClick={onClose} sx={{ color: 'rgba(255,255,255,0.5)' }}><CloseIcon fontSize="small" /></IconButton>
      </Box>

      {/* ── Corpo: form (sidebar) + resultado ── */}
      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, flex: 1, minHeight: 0, overflowY: { xs: 'auto', md: 'visible' } }}>

        {/* ── Sidebar / briefing ── */}
        {showForm && (
          <Box sx={{
            width: { xs: '100%', md: 332 }, flexShrink: 0, p: 2,
            borderRight: { md: '1px solid rgba(255,255,255,0.07)' },
            borderBottom: { xs: '1px solid rgba(255,255,255,0.07)', md: 'none' },
            overflowY: { md: 'auto' },
          }}>
            <Typography sx={{ fontSize: '0.6rem', letterSpacing: '0.12em', color: 'rgba(255,255,255,0.35)', mb: 1.2 }}>BRIEFING DO CRIATIVO</Typography>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.2 }}>
              <TextField size="small" label="Cliente" value={brief.cliente} onChange={e => set('cliente', e.target.value)} sx={fieldSx} />
              <TextField select size="small" label="Nicho" value={brief.nicho} onChange={e => onNichoChange(e.target.value)} sx={fieldSx}>
                {NICHES.map(n => <MenuItem key={n.key} value={n.key} sx={{ fontSize: '0.82rem' }}>{n.emoji} {n.label}</MenuItem>)}
              </TextField>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <TextField select size="small" label="Objetivo" value={brief.objetivo} onChange={e => set('objetivo', e.target.value as CreativeBrief['objetivo'])} sx={{ ...fieldSx, flex: 1 }}>
                  {OBJETIVOS.map(o => <MenuItem key={o.key} value={o.key} sx={{ fontSize: '0.82rem' }}>{o.label}</MenuItem>)}
                </TextField>
                <TextField select size="small" label="Formato" value={brief.formato} onChange={e => set('formato', e.target.value as CreativeBrief['formato'])} sx={{ ...fieldSx, flex: 1 }}>
                  {FORMATOS.map(f => <MenuItem key={f.key} value={f.key} sx={{ fontSize: '0.82rem' }}>{f.label}</MenuItem>)}
                </TextField>
              </Box>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <TextField select size="small" label="Duração" value={brief.duracao} onChange={e => set('duracao', e.target.value)} sx={{ ...fieldSx, flex: 1 }}>
                  {DURACOES.map(d => <MenuItem key={d} value={d} sx={{ fontSize: '0.82rem' }}>{d}</MenuItem>)}
                </TextField>
                <TextField select size="small" label="Tom" value={brief.tom} onChange={e => set('tom', e.target.value as CreativeBrief['tom'])} sx={{ ...fieldSx, flex: 1 }}>
                  {TONS.map(t => <MenuItem key={t.key} value={t.key} sx={{ fontSize: '0.82rem' }}>{t.label}</MenuItem>)}
                </TextField>
              </Box>
              <TextField size="small" label="Produto / serviço" value={brief.produto} onChange={e => set('produto', e.target.value)} sx={fieldSx} />
              <TextField size="small" label="Público-alvo" value={brief.publico} onChange={e => set('publico', e.target.value)} sx={fieldSx} />
              <TextField size="small" label="Objeção principal" value={brief.objecao} onChange={e => set('objecao', e.target.value)} placeholder={niche.objecoesComuns[0]} sx={fieldSx} />
              <TextField size="small" label="Oferta" value={brief.oferta} onChange={e => set('oferta', e.target.value)} sx={fieldSx} />
              <TextField size="small" label="CTA (ação final)" value={brief.cta} onChange={e => set('cta', e.target.value)} sx={fieldSx} />

              <Button fullWidth onClick={() => run({}, true)} startIcon={<AutoAwesomeIcon />} disabled={loading}
                sx={{ mt: 0.5, py: 1.1, borderRadius: 2.5, fontWeight: 800, color: '#2a1500',
                  background: `linear-gradient(135deg, ${ORANGE}, #ff5339)`,
                  '&:hover': { filter: 'brightness(1.06)' },
                  '&.Mui-disabled': { opacity: 0.5, color: 'rgba(0,0,0,0.5)' } }}>
                {output ? 'Gerar de novo' : 'Gerar criativo'}
              </Button>
            </Box>

            {/* Salvos */}
            {saved.length > 0 && (
              <Box sx={{ mt: 2 }}>
                <Typography sx={{ fontSize: '0.6rem', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.3)', mb: 0.8 }}>💾 SALVOS ({saved.length})</Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                  {saved.slice(0, 8).map(s => (
                    <Box key={s.id} sx={{ display: 'flex', alignItems: 'center', gap: 0.5, px: 1, py: 0.6, borderRadius: 1.5, bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <Typography onClick={() => loadSaved(s)} noWrap sx={{ flex: 1, fontSize: '0.72rem', color: 'rgba(255,255,255,0.75)', cursor: 'pointer', '&:hover': { color: ORANGE } }}>
                        {s.titulo}
                      </Typography>
                      <Typography onClick={() => setSaved(removeCreative(s.id))} sx={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.25)', cursor: 'pointer', '&:hover': { color: '#FF3B30' } }}>✕</Typography>
                    </Box>
                  ))}
                </Box>
              </Box>
            )}
          </Box>
        )}

        {/* ── Resultado ── */}
        <Box sx={{ flex: 1, minWidth: 0, p: 2, overflowY: { md: 'auto' } }}>

          {/* Toggle briefing no mobile */}
          {isMobile && !formOpen && (
            <Button size="small" onClick={() => setFormOpen(true)} sx={{ mb: 1.5, color: ORANGE, fontWeight: 700, fontSize: '0.74rem' }}>✏️ Editar briefing</Button>
          )}

          {loading && (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.5, py: 8 }}>
              <CircularProgress size={28} sx={{ color: ORANGE }} />
              <Typography sx={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.5)' }}>{hasKey ? 'A IA está criando o criativo…' : 'Montando o criativo…'}</Typography>
            </Box>
          )}

          {!loading && !output && (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', height: '100%', minHeight: 220, color: 'rgba(255,255,255,0.35)', gap: 1 }}>
              <Typography sx={{ fontSize: '2.2rem' }}>⚡</Typography>
              <Typography sx={{ fontSize: '0.85rem', fontWeight: 700, color: 'rgba(255,255,255,0.6)' }}>Preencha o briefing e clique em Gerar criativo</Typography>
              <Typography sx={{ fontSize: '0.72rem', maxWidth: 320 }}>Big idea, ganchos, roteiro por tempo, direção de edição, CTA e checklist — adaptados ao nicho.</Typography>
            </Box>
          )}

          {!loading && output && (
            <>
              {/* Origem do criativo */}
              {source && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.2, flexWrap: 'wrap' }}>
                  <Box sx={{
                    px: 0.9, py: 0.3, borderRadius: 1.2, fontSize: '0.6rem', fontWeight: 800, letterSpacing: '0.04em',
                    color: source === 'ia' ? '#00C47A' : 'rgba(255,255,255,0.55)',
                    border: `1px solid ${source === 'ia' ? 'rgba(0,196,122,0.4)' : 'rgba(255,255,255,0.18)'}`,
                  }}>
                    {source === 'ia' ? '✨ GERADO POR IA' : '⚙ MODELO PRONTO'}
                  </Box>
                  {source === 'template' && !hasKey && (
                    <Typography sx={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.4)' }}>
                      Configure a chave da IA na aba <b>IA</b> pra criativos únicos por briefing.
                    </Typography>
                  )}
                </Box>
              )}

              {/* Barra de ações */}
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.8, mb: 1.6 }}>
                <ActionBtn label="↻ Variação"            color={ORANGE}    onClick={() => run({ seed: (genOpts.seed ?? 0) + 1 })} />
                <ActionBtn label="⊕ Menos genérico"      color="#C084FC"   onClick={() => run({ especifico: true })} />
                <ActionBtn label="🎯 Virar anúncio"      color="#3B8EFF"   onClick={() => run({ anuncio: true })} />
                <ActionBtn label="✂️ Direção de edição"  color="#00C47A"   onClick={() => run({ edicaoDetalhada: true, seed: (genOpts.seed ?? 0) + 1 })} />
                <ActionBtn label="📋 Copiar tudo"        color="rgba(255,255,255,0.55)" onClick={() => navigator.clipboard?.writeText(creativeToText(brief, output)).catch(() => {})} />
                <ActionBtn label={savedFlash ? '✓ Salvo!' : '💾 Salvar'} color={savedFlash ? '#00C47A' : 'rgba(255,255,255,0.55)'} onClick={doSave} />
                {onUsarRoteiro && (
                  <ActionBtn label="📥 Mandar pro card" color="#FFD700" onClick={() => { onUsarRoteiro(creativeToText(brief, output)); }} />
                )}
              </Box>

              {/* Cards do resultado */}
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 1.2 }}>

                <CreativeResultCard emoji="💡" title="Big Idea" color={ORANGE} full copyText={output.bigIdea}>
                  <Typography sx={{ fontSize: '0.95rem', fontWeight: 700, color: '#fff', lineHeight: 1.35 }}>"{output.bigIdea}"</Typography>
                </CreativeResultCard>

                <CreativeResultCard emoji="🎣" title="Gancho principal" color="#FFD700" copyText={output.ganchoPrincipal}>
                  <Typography sx={{ fontSize: '0.86rem', color: '#fff', lineHeight: 1.4 }}>{output.ganchoPrincipal}</Typography>
                </CreativeResultCard>

                <CreativeResultCard emoji="🎣" title="5 variações de gancho" color="#FFD700" copyText={output.variacoesGancho.join('\n')}>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                    {output.variacoesGancho.map((g, i) => (
                      <Typography key={i} sx={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.8)', lineHeight: 1.4 }}>
                        <Box component="span" sx={{ color: '#FFD700', fontWeight: 800, mr: 0.6 }}>{i + 1}.</Box>{g}
                      </Typography>
                    ))}
                  </Box>
                </CreativeResultCard>

                <CreativeResultCard emoji="🎞️" title="Roteiro por tempo" color="#60A5FA" full
                  copyText={output.roteiro.map(r => `[${r.tempo}] ${r.acao}`).join('\n')}>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.8 }}>
                    {output.roteiro.map((r, i) => (
                      <Box key={i} sx={{ display: 'flex', gap: 1 }}>
                        <Typography sx={{ fontSize: '0.68rem', fontWeight: 800, color: '#60A5FA', minWidth: 56, fontFamily: 'monospace', pt: 0.1 }}>{r.tempo}</Typography>
                        <Typography sx={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.82)', lineHeight: 1.4 }}>{r.acao}</Typography>
                      </Box>
                    ))}
                  </Box>
                </CreativeResultCard>

                <CreativeResultCard emoji="✂️" title="Direção de edição" color="#00C47A" full
                  copyText={output.direcaoEdicao.map(e => `• ${e}`).join('\n')}>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.6 }}>
                    {output.direcaoEdicao.map((e, i) => (
                      <Typography key={i} sx={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.82)', lineHeight: 1.45 }}>
                        <Box component="span" sx={{ color: '#00C47A', mr: 0.6 }}>•</Box>{e}
                      </Typography>
                    ))}
                  </Box>
                </CreativeResultCard>

                <CreativeResultCard emoji="📣" title="CTA" color="#3B8EFF" full copyText={output.cta}>
                  <Typography sx={{ fontSize: '0.82rem', color: '#fff', lineHeight: 1.45 }}>{output.cta}</Typography>
                </CreativeResultCard>

                <CreativeResultCard emoji="✅" title="Checklist final" color="#FB7185" full
                  copyText={output.checklist.map(c => `☐ ${c}`).join('\n')}>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.4 }}>
                    {output.checklist.map((c, i) => (
                      <Box key={i} onClick={() => toggleCheck(i)} sx={{ display: 'flex', gap: 0.8, cursor: 'pointer', py: 0.2 }}>
                        <Typography sx={{ fontSize: '0.82rem', color: checks.has(i) ? '#00C47A' : 'rgba(255,255,255,0.4)', lineHeight: 1.4 }}>{checks.has(i) ? '☑' : '☐'}</Typography>
                        <Typography sx={{ fontSize: '0.78rem', lineHeight: 1.4, color: checks.has(i) ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.82)', textDecoration: checks.has(i) ? 'line-through' : 'none' }}>{c}</Typography>
                      </Box>
                    ))}
                  </Box>
                </CreativeResultCard>

              </Box>
            </>
          )}
        </Box>
      </Box>
    </Dialog>
  )
}

function ActionBtn({ label, color, onClick }: { label: string; color: string; onClick: () => void }) {
  return (
    <Tooltip title={label}>
      <Box onClick={onClick} sx={{
        px: 1.1, py: 0.5, borderRadius: 1.8, cursor: 'pointer',
        border: `1px solid ${color}55`, color,
        fontSize: '0.7rem', fontWeight: 700, whiteSpace: 'nowrap',
        transition: 'all 0.15s', '&:hover': { bgcolor: `${color}1a`, filter: 'brightness(1.1)' },
      }}>{label}</Box>
    </Tooltip>
  )
}
