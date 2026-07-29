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
  runEngine, creativeToText, creativeToWhatsApp, nicheByKey, guessNicho, legendaFromOutput,
  saveCreative, loadCreatives, removeCreative, getCreativePreset, saveCreativePreset,
  type CreativeBrief, type CreativeOutput, type GenOpts, type SavedCreative, type EngineSource,
} from '../lib/creativeEngine'
import { legendaProUrl } from '../lib/assets'
import { DS } from '../theme'

interface Props {
  open: boolean
  onClose: () => void
  currentUser?: string
  contexto?: Partial<CreativeBrief>      // prefill vindo do card do Editor
  marcaContexto?: string                 // roteiro/caption do cliente (referência de tom pra IA)
  inicial?: SavedCreative                // abre um criativo salvo (Biblioteca) já pronto
  onUsarRoteiro?: (texto: string) => void
}

const ACCENT = DS.accent

export default function CreativeEngine({ open, onClose, currentUser, contexto, marcaContexto, inicial, onUsarRoteiro }: Props) {
  const isMobile = useMediaQuery('(max-width:599.95px)')
  const [brief, setBrief]     = useState<CreativeBrief>(() => {
    if (inicial) return { ...inicial.brief }
    const preset = getCreativePreset(contexto?.cliente ?? '') ?? {}
    const base = { ...BRIEF_VAZIO, ...preset, ...contexto }
    if (!preset.nicho && !contexto?.nicho && (contexto?.cliente || contexto?.produto)) {
      base.nicho = guessNicho(`${contexto?.cliente ?? ''} ${contexto?.produto ?? ''}`)
    }
    if (!base.objecao) base.objecao = nicheByKey(base.nicho).objecoesComuns[0] ?? ''
    return base
  })
  const [output, setOutput]   = useState<CreativeOutput | null>(inicial?.output ?? null)
  const [source, setSource]   = useState<EngineSource | null>(null)
  const [genOpts, setGenOpts] = useState<GenOpts>({ seed: 0 })
  const [loading, setLoading] = useState(false)
  const [formOpen, setFormOpen] = useState(!(isMobile && inicial))
  const [saved, setSaved]     = useState<SavedCreative[]>(() => loadCreatives())
  const [waFlash, setWaFlash] = useState(false)
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
    const payload: GenOpts = { ...(isRefine && output ? { ...next, current: output } : next), marca: marcaContexto }
    setGenOpts(next)
    setLoading(true)
    setChecks(new Set())
    try {
      const { output: out, source: src } = await runEngine(brief, payload)
      setOutput(out)
      setSource(src)
      setSaved(saveCreative(brief, out, currentUser))   // auto-salva no histórico do cliente (upsert)
      saveCreativePreset(brief.cliente, brief)           // aprende a cara do cliente pro próximo briefing
    } finally {
      setLoading(false)
      if (isMobile) setFormOpen(false)
    }
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
    '& .MuiInputBase-root': { fontSize: '0.82rem', bgcolor: 'rgba(244,247,255,0.03)' },
    '& .MuiInputLabel-root': { fontSize: '0.78rem' },
  } as const

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="lg" fullScreen={isMobile}
      PaperProps={{ sx: { bgcolor: '#0a0b0f', backgroundImage: 'none', height: isMobile ? '100%' : '92vh', maxHeight: isMobile ? '100%' : '92vh', display: 'flex', flexDirection: 'column' } }}>

      {/* ── Header ── */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2, py: 1.3, borderBottom: '1px solid rgba(244,247,255,0.07)', flexShrink: 0 }}>
        <Typography sx={{ fontSize: '0.9rem' }}>⚡</Typography>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: '0.95rem', fontWeight: 900, color: '#fff', lineHeight: 1.1 }}>Creative Engine DS</Typography>
          <Typography noWrap sx={{ fontSize: '0.6rem', color: 'rgba(244,247,255,0.4)' }}>
            {brief.cliente ? `${brief.cliente} · ` : ''}copy · roteiro · edição · venda
          </Typography>
        </Box>
        <IconButton size="small" onClick={onClose} sx={{ color: 'rgba(244,247,255,0.5)' }}><CloseIcon fontSize="small" /></IconButton>
      </Box>

      {/* ── Corpo: form (sidebar) + resultado ── */}
      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, flex: 1, minHeight: 0, overflowY: { xs: 'auto', md: 'visible' } }}>

        {/* ── Sidebar / briefing ── */}
        {showForm && (
          <Box sx={{
            width: { xs: '100%', md: 332 }, flexShrink: 0, p: 2,
            borderRight: { md: '1px solid rgba(244,247,255,0.07)' },
            borderBottom: { xs: '1px solid rgba(244,247,255,0.07)', md: 'none' },
            overflowY: { md: 'auto' },
          }}>
            <Typography sx={{ fontSize: '0.6rem', letterSpacing: '0.12em', color: 'rgba(244,247,255,0.35)', mb: 1.2 }}>BRIEFING DO CRIATIVO</Typography>

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
                sx={{ mt: 0.5, py: 1.1, borderRadius: 2.5, fontWeight: 800, color: '#ffffff',
                  background: `linear-gradient(135deg, ${ACCENT}, DS.cyan)`,
                  '&:hover': { filter: 'brightness(1.06)' },
                  '&.Mui-disabled': { opacity: 0.5, color: 'rgba(0,0,0,0.5)' } }}>
                {output ? 'Gerar de novo' : 'Gerar criativo'}
              </Button>
            </Box>

            {/* Salvos */}
            {saved.length > 0 && (
              <Box sx={{ mt: 2 }}>
                <Typography sx={{ fontSize: '0.6rem', letterSpacing: '0.1em', color: 'rgba(244,247,255,0.3)', mb: 0.8 }}>💾 SALVOS ({saved.length})</Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                  {saved.slice(0, 8).map(s => (
                    <Box key={s.id} sx={{ display: 'flex', alignItems: 'center', gap: 0.5, px: 1, py: 0.6, borderRadius: 1.5, bgcolor: 'rgba(244,247,255,0.03)', border: '1px solid rgba(244,247,255,0.06)' }}>
                      <Typography onClick={() => loadSaved(s)} noWrap sx={{ flex: 1, fontSize: '0.72rem', color: 'rgba(244,247,255,0.75)', cursor: 'pointer', '&:hover': { color: ACCENT } }}>
                        {s.titulo}
                      </Typography>
                      <Typography onClick={() => setSaved(removeCreative(s.id))} sx={{ fontSize: '0.7rem', color: 'rgba(244,247,255,0.25)', cursor: 'pointer', '&:hover': { color: DS.red } }}>✕</Typography>
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
            <Button size="small" onClick={() => setFormOpen(true)} sx={{ mb: 1.5, color: ACCENT, fontWeight: 700, fontSize: '0.74rem' }}>✏️ Editar briefing</Button>
          )}

          {loading && (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.5, py: 8 }}>
              <CircularProgress size={28} sx={{ color: ACCENT }} />
              <Typography sx={{ fontSize: '0.78rem', color: 'rgba(244,247,255,0.5)' }}>Gerando o criativo…</Typography>
            </Box>
          )}

          {!loading && !output && (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', height: '100%', minHeight: 220, color: 'rgba(244,247,255,0.35)', gap: 1 }}>
              <Typography sx={{ fontSize: '2.2rem' }}>⚡</Typography>
              <Typography sx={{ fontSize: '0.85rem', fontWeight: 700, color: 'rgba(244,247,255,0.6)' }}>Preencha o briefing e clique em Gerar criativo</Typography>
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
                    color: source === 'ia' ? DS.green : 'rgba(244,247,255,0.55)',
                    border: `1px solid ${source === 'ia' ? 'rgba(49,209,124,0.4)' : 'rgba(244,247,255,0.18)'}`,
                  }}>
                    {source === 'ia' ? '✨ GERADO POR IA' : '⚙ MODELO PRONTO'}
                  </Box>
                  {source === 'template' && (
                    <Typography sx={{ fontSize: '0.62rem', color: 'rgba(244,247,255,0.4)' }}>
                      Saiu do modelo pronto. Pra criativos únicos por IA, configure a chave na aba <b>IA</b>.
                    </Typography>
                  )}
                </Box>
              )}

              {/* Barra de ações */}
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.8, mb: 1.6 }}>
                <ActionBtn label="↻ Variação"            color={ACCENT}    onClick={() => run({ seed: (genOpts.seed ?? 0) + 1 })} />
                <ActionBtn label="⊕ Menos genérico"      color="#C084FC"   onClick={() => run({ especifico: true })} />
                <ActionBtn label="🎯 Virar anúncio"      color={DS.accent}   onClick={() => run({ anuncio: true })} />
                <ActionBtn label="✂️ Direção de edição"  color={DS.green}   onClick={() => run({ edicaoDetalhada: true, seed: (genOpts.seed ?? 0) + 1 })} />
                <ActionBtn label="🎬 Gerar legenda"      color="#00d9ff"   onClick={() => window.open(legendaProUrl({ cliente: brief.cliente, roteiro: legendaFromOutput(output) }), '_blank', 'noopener')} />
                <ActionBtn label={waFlash ? '✓ Copiado!' : '💬 WhatsApp'} color={waFlash ? DS.green : '#25D366'}
                  onClick={() => { navigator.clipboard?.writeText(creativeToWhatsApp(brief, output)).then(() => { setWaFlash(true); setTimeout(() => setWaFlash(false), 1600) }).catch(() => {}) }} />
                <ActionBtn label="📋 Copiar tudo"        color="rgba(244,247,255,0.55)" onClick={() => navigator.clipboard?.writeText(creativeToText(brief, output)).catch(() => {})} />
                {onUsarRoteiro && (
                  <ActionBtn label="📥 Salvar no card" color={DS.amber} onClick={() => { onUsarRoteiro(creativeToText(brief, output)); }} />
                )}
              </Box>

              {/* Cards do resultado */}
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 1.2 }}>

                <CreativeResultCard emoji="💡" title="Big Idea" color={ACCENT} full copyText={output.bigIdea}>
                  <Typography sx={{ fontSize: '0.95rem', fontWeight: 700, color: '#fff', lineHeight: 1.35 }}>"{output.bigIdea}"</Typography>
                </CreativeResultCard>

                <CreativeResultCard emoji="🎣" title="Gancho principal" color={DS.amber} copyText={output.ganchoPrincipal}>
                  <Typography sx={{ fontSize: '0.86rem', color: '#fff', lineHeight: 1.4 }}>{output.ganchoPrincipal}</Typography>
                </CreativeResultCard>

                <CreativeResultCard emoji="🎣" title="5 variações de gancho" color={DS.amber} copyText={output.variacoesGancho.join('\n')}>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                    {output.variacoesGancho.map((g, i) => (
                      <Typography key={i} sx={{ fontSize: '0.78rem', color: 'rgba(244,247,255,0.8)', lineHeight: 1.4 }}>
                        <Box component="span" sx={{ color: DS.amber, fontWeight: 800, mr: 0.6 }}>{i + 1}.</Box>{g}
                      </Typography>
                    ))}
                  </Box>
                </CreativeResultCard>

                {output.copy && (
                  <CreativeResultCard emoji="📄" title="Copy / legenda do post" color={DS.neutral} full copyText={output.copy}>
                    <Typography sx={{ fontSize: '0.78rem', color: 'rgba(244,247,255,0.85)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{output.copy}</Typography>
                  </CreativeResultCard>
                )}

                <CreativeResultCard emoji="🎞️" title="Roteiro por tempo" color="#60A5FA" full
                  copyText={output.roteiro.map(r => `[${r.tempo}] ${r.acao}`).join('\n')}>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.8 }}>
                    {output.roteiro.map((r, i) => (
                      <Box key={i} sx={{ display: 'flex', gap: 1 }}>
                        <Typography sx={{ fontSize: '0.68rem', fontWeight: 800, color: '#60A5FA', minWidth: 56, fontFamily: 'monospace', pt: 0.1 }}>{r.tempo}</Typography>
                        <Typography sx={{ fontSize: '0.78rem', color: 'rgba(244,247,255,0.82)', lineHeight: 1.4 }}>{r.acao}</Typography>
                      </Box>
                    ))}
                  </Box>
                </CreativeResultCard>

                {output.cenas?.length > 0 && (
                  <CreativeResultCard emoji="🎥" title="Cenas pra gravar" color={DS.accent} full copyText={output.cenas.map(c => `• ${c}`).join('\n')}>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                      {output.cenas.map((c, i) => (
                        <Typography key={i} sx={{ fontSize: '0.78rem', color: 'rgba(244,247,255,0.82)', lineHeight: 1.45 }}>
                          <Box component="span" sx={{ color: DS.accent, mr: 0.6 }}>•</Box>{c}
                        </Typography>
                      ))}
                    </Box>
                  </CreativeResultCard>
                )}

                <CreativeResultCard emoji="✂️" title="Direção de edição" color={DS.green} full
                  copyText={output.direcaoEdicao.map(e => `• ${e}`).join('\n')}>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.6 }}>
                    {output.direcaoEdicao.map((e, i) => (
                      <Typography key={i} sx={{ fontSize: '0.78rem', color: 'rgba(244,247,255,0.82)', lineHeight: 1.45 }}>
                        <Box component="span" sx={{ color: DS.green, mr: 0.6 }}>•</Box>{e}
                      </Typography>
                    ))}
                  </Box>
                </CreativeResultCard>

                {output.ritmoCorte && (
                  <CreativeResultCard emoji="✂️" title="Ritmo de corte" color={DS.green} copyText={output.ritmoCorte}>
                    <Typography sx={{ fontSize: '0.78rem', color: 'rgba(244,247,255,0.82)', lineHeight: 1.45 }}>{output.ritmoCorte}</Typography>
                  </CreativeResultCard>
                )}

                {output.textoNaTela?.length > 0 && (
                  <CreativeResultCard emoji="📝" title="Texto na tela" color="#C084FC"
                    copyText={output.textoNaTela.join('\n')}>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                      {output.textoNaTela.map((t, i) => (
                        <Typography key={i} sx={{ fontSize: '0.8rem', fontWeight: 700, color: '#fff', lineHeight: 1.35, letterSpacing: '0.01em' }}>
                          <Box component="span" sx={{ color: '#C084FC', mr: 0.6 }}>▸</Box>{t}
                        </Typography>
                      ))}
                    </Box>
                  </CreativeResultCard>
                )}

                <CreativeResultCard emoji="📣" title="CTA" color={DS.accent} copyText={output.cta}>
                  <Typography sx={{ fontSize: '0.82rem', color: '#fff', lineHeight: 1.45 }}>{output.cta}</Typography>
                </CreativeResultCard>

                {output.estiloLegenda && (
                  <CreativeResultCard emoji="🔤" title="Estilo de legenda" color="#C084FC" copyText={output.estiloLegenda}>
                    <Typography sx={{ fontSize: '0.78rem', color: 'rgba(244,247,255,0.82)', lineHeight: 1.45 }}>{output.estiloLegenda}</Typography>
                  </CreativeResultCard>
                )}

                {output.musica && (
                  <CreativeResultCard emoji="🎵" title="Música" color={DS.accent} copyText={output.musica}>
                    <Typography sx={{ fontSize: '0.78rem', color: 'rgba(244,247,255,0.82)', lineHeight: 1.45 }}>{output.musica}</Typography>
                  </CreativeResultCard>
                )}

                {output.sfx?.length > 0 && (
                  <CreativeResultCard emoji="🔊" title="Efeitos sonoros" color={DS.amber} copyText={output.sfx.map(s => `• ${s}`).join('\n')}>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.4 }}>
                      {output.sfx.map((s, i) => (
                        <Typography key={i} sx={{ fontSize: '0.78rem', color: 'rgba(244,247,255,0.82)', lineHeight: 1.4 }}>
                          <Box component="span" sx={{ color: DS.amber, mr: 0.6 }}>•</Box>{s}
                        </Typography>
                      ))}
                    </Box>
                  </CreativeResultCard>
                )}

                {output.versaoOusada && (
                  <CreativeResultCard emoji="🔥" title="Versão ousada" color={DS.cyan} full copyText={output.versaoOusada}>
                    <Typography sx={{ fontSize: '0.8rem', color: 'rgba(244,247,255,0.88)', lineHeight: 1.5 }}>{output.versaoOusada}</Typography>
                  </CreativeResultCard>
                )}

                <CreativeResultCard emoji="✅" title="Checklist final" color="#FB7185" full
                  copyText={output.checklist.map(c => `☐ ${c}`).join('\n')}>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.4 }}>
                    {output.checklist.map((c, i) => (
                      <Box key={i} onClick={() => toggleCheck(i)} sx={{ display: 'flex', gap: 0.8, cursor: 'pointer', py: 0.2 }}>
                        <Typography sx={{ fontSize: '0.82rem', color: checks.has(i) ? DS.green : 'rgba(244,247,255,0.4)', lineHeight: 1.4 }}>{checks.has(i) ? '☑' : '☐'}</Typography>
                        <Typography sx={{ fontSize: '0.78rem', lineHeight: 1.4, color: checks.has(i) ? 'rgba(244,247,255,0.4)' : 'rgba(244,247,255,0.82)', textDecoration: checks.has(i) ? 'line-through' : 'none' }}>{c}</Typography>
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
