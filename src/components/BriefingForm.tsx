/**
 * Briefing público do cliente (/briefing/:token) — 2026-10-07.
 *
 * Mesma estética da página "Trabalhe conosco" do site da agência: preto, título
 * em Anton, "eyebrow" com o ponto laranja, campos de 14px de raio, botões em
 * pílula e a barra laranja→amarelo. As PERGUNTAS são as de sempre e vêm de
 * `lib/briefing.ts` (a mesma fonte da Central de Briefings).
 *
 * Esta rota não passa pelo tema do painel (main.tsx monta o componente solto):
 * sem o reset abaixo o navegador deixava a margem branca em volta da página e os
 * campos do MUI no visual claro — era a "borda branca" no celular.
 */
import { useEffect, useRef, useState } from 'react'
import { Box, CircularProgress, GlobalStyles, Typography } from '@mui/material'
import { DS } from '../theme'
import { BRIEFING_OBJECTIVES as OBJECTIVES, BRIEFING_SECTIONS as SECTIONS, type BriefingField } from '../lib/briefing'

interface Props { token: string }

/** Os títulos das seções começam com emoji colorido ("🏢 Dados Cadastrais"); no estilo do site o título é só texto. */
const semEmoji = (t: string) => t.replace(/^[^\p{L}\p{N}]+/u, '')

const RAIO = '14px'
const CAMPO = {
  width: '100%', boxSizing: 'border-box' as const, minHeight: 54, padding: '14px 18px',
  background: DS.surfaceAlt, color: DS.t1, border: `1px solid ${DS.border}`, borderRadius: RAIO,
  // 16px: abaixo disso o iPhone dá zoom ao tocar no campo.
  fontSize: 16, fontFamily: 'inherit', lineHeight: 1.5, outline: 'none',
  transition: 'border-color 0.2s, background 0.2s, box-shadow 0.2s',
  '&::placeholder': { color: DS.t4 },
  '&:focus': { borderColor: DS.accent, boxShadow: `0 0 0 4px ${DS.accent}24` },
} as const

export default function BriefingForm({ token }: Props) {
  const [clientName, setClientName] = useState('')
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState('')
  const [submitted, setSubmitted]   = useState(false)
  const [saving, setSaving]         = useState(false)
  const [falhou, setFalhou]         = useState(false)
  const [step, setStep]             = useState(0)
  const [objectives, setObjectives] = useState<string[]>([])
  const [vals, setVals]             = useState<Record<string, string>>({})
  const topo = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch(`/api/briefing?token=${token}`)
      .then(r => r.json())
      .then((d: { ok: boolean; clientName?: string; data?: Record<string, unknown>; error?: string }) => {
        if (!d.ok) { setError(d.error ?? 'Link inválido'); return }
        setClientName(d.clientName ?? '')
        if (d.data) {
          const { _objectives, ...rest } = d.data as Record<string, unknown>
          setObjectives((_objectives as string[]) ?? [])
          const strVals: Record<string, string> = {}
          Object.entries(rest).forEach(([k, v]) => { if (typeof v === 'string') strVals[k] = v })
          setVals(strVals)
          setSubmitted(true)
        }
      })
      .catch(() => setError('Erro ao carregar formulário.'))
      .finally(() => setLoading(false))
  }, [token])

  // A fonte do texto do site (Archivo) — só nesta página, o painel segue em Inter.
  useEffect(() => {
    if (document.getElementById('fonte-archivo')) return
    const l = document.createElement('link')
    l.id = 'fonte-archivo'; l.rel = 'stylesheet'
    l.href = 'https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700&display=swap'
    document.head.appendChild(l)
  }, [])

  // Trocar de etapa leva ao início do formulário (no celular a etapa nova começava no meio da tela).
  useEffect(() => { topo.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }, [step])

  const set = (key: string, val: string) => setVals(prev => ({ ...prev, [key]: val }))
  const toggleObj = (obj: string) => setObjectives(prev => prev.includes(obj) ? prev.filter(o => o !== obj) : [...prev, obj])

  const total = SECTIONS.length
  const handleSubmit = async () => {
    setSaving(true); setFalhou(false)
    try {
      const res = await fetch('/api/briefing', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'submit', token, data: { ...vals, _objectives: objectives } }),
      })
      const d = await res.json() as { ok: boolean }
      if (d.ok) setSubmitted(true); else setFalhou(true)
    } catch { setFalhou(true) }
    finally { setSaving(false) }
  }

  const pagina = (conteudo: React.ReactNode) => (
    <>
      <GlobalStyles styles={{
        'html, body': { margin: 0, padding: 0, background: DS.bg, color: DS.t1, colorScheme: 'dark' },
        body: { fontFamily: '"Archivo", "Inter", "Helvetica Neue", Arial, sans-serif', WebkitFontSmoothing: 'antialiased' },
        '*, *::before, *::after': { boxSizing: 'border-box' },
      }} />
      <Box sx={{ minHeight: '100vh', bgcolor: DS.bg, color: DS.t1, overflowX: 'hidden' }}>
        {conteudo}
      </Box>
    </>
  )

  if (loading) return pagina(
    <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}><CircularProgress sx={{ color: DS.accent }} /></Box>,
  )

  if (error) return pagina(
    <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', px: 2 }}>
      <Box sx={{ textAlign: 'center', maxWidth: 420 }}>
        <Titulo tamanho={{ xs: 40, sm: 56 }}>Link <Box component="span" sx={{ color: DS.accent }}>inválido</Box></Titulo>
        <Typography sx={{ color: DS.t2, mt: 2, fontSize: 16, lineHeight: 1.6 }}>{error}</Typography>
      </Box>
    </Box>,
  )

  if (submitted) return pagina(
    <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', px: 2, py: 6 }}>
      <Box sx={{ maxWidth: 520 }}>
        <Eyebrow>Briefing</Eyebrow>
        <Titulo tamanho={{ xs: 46, sm: 72 }} cor={DS.accent} mt={2.5}>Briefing enviado!</Titulo>
        <Typography sx={{ color: DS.t2, fontSize: { xs: 17, sm: 19 }, lineHeight: 1.6, mt: 2.5 }}>
          Obrigado, <Box component="strong" sx={{ color: DS.t1 }}>{clientName}</Box>! Recebemos suas informações e a nossa equipe já pode começar o planejamento.
        </Typography>
        <Typography sx={{ color: DS.t3, fontSize: 13, mt: 5 }}>Digital Scale · Agência de Marketing Digital</Typography>
      </Box>
    </Box>,
  )

  const secao = SECTIONS[step]
  const ultimo = step === total - 1

  return pagina(
    <Box sx={{ width: '100%', maxWidth: 760, mx: 'auto', px: { xs: 2, sm: 4 }, pt: { xs: 4, sm: 8 }, pb: { xs: 5, sm: 10 } }}>
      {/* Cabeçalho, como o lado esquerdo da candidatura */}
      {/* A arte tem muita margem transparente: recorta para a marca ficar do tamanho do site. */}
      <Box sx={{ width: 148, height: 50, overflow: 'hidden', position: 'relative', mb: { xs: 3, sm: 4 } }}>
        <Box component="img" src="/logotipo.png" alt="Digital Scale" sx={{ position: 'absolute', width: 297, height: 167, left: -73, top: -50 }} />
      </Box>
      <Eyebrow>Briefing</Eyebrow>
      <Titulo tamanho={{ xs: 44, sm: 68 }} mt={2}>
        Vamos conhecer <Box component="span" sx={{ color: DS.accent }}>{clientName || 'você'}</Box>
      </Titulo>
      {step === 0 && (
        <Box sx={{ mt: 3, px: 2.5, py: 2.2, borderLeft: `3px solid ${DS.accent}`, bgcolor: `${DS.accent}0f`, borderRadius: '0 12px 12px 0' }}>
          <Typography sx={{ fontSize: 15, lineHeight: 1.6, color: DS.t2 }}>
            Que bom ter você com a <Box component="strong" sx={{ color: DS.t1 }}>Digital Scale</Box>. Estas respostas nos ajudam a montar a estratégia de conteúdo certa para o seu negócio. Leva uns 5 minutos.
          </Typography>
        </Box>
      )}

      {/* O formulário, no mesmo cartão da candidatura */}
      <Box ref={topo} sx={{
        mt: { xs: 4, sm: 5 }, scrollMarginTop: 16,
        border: `1px solid ${DS.border}`, borderRadius: { xs: '20px', sm: '24px' },
        p: { xs: 2.5, sm: 5 }, background: `linear-gradient(160deg, ${DS.surface}, ${DS.bg})`,
      }}>
        <Box sx={{ height: 4, bgcolor: DS.border, borderRadius: 4, overflow: 'hidden' }}>
          <Box sx={{ height: '100%', width: `${((step + 1) / total) * 100}%`, background: `linear-gradient(90deg, ${DS.accent}, ${DS.cyan})`, transition: 'width 0.6s cubic-bezier(0.2,0.7,0.2,1)' }} />
        </Box>
        <Box component="ol" sx={{ listStyle: 'none', display: 'flex', gap: '6px', m: 0, mt: '14px', p: 0, overflowX: 'auto', scrollbarWidth: 'none', '&::-webkit-scrollbar': { display: 'none' } }}>
          {SECTIONS.map((s, i) => {
            const on = i === step, feito = i < step
            return (
              <Box component="li" key={s.title} sx={{
                display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0, whiteSpace: 'nowrap',
                fontSize: 12, color: on ? DS.t1 : DS.t3, p: '4px 10px 4px 4px', borderRadius: 999,
                bgcolor: on ? `${DS.accent}1a` : 'transparent',
              }}>
                <Box component="span" sx={{
                  width: 24, height: 24, borderRadius: '50%', display: 'grid', placeItems: 'center', fontWeight: 600,
                  border: `1px solid ${on ? DS.accent : DS.border}`,
                  bgcolor: on ? DS.accent : feito ? DS.border : 'transparent', color: on ? DS.onAccent : feito ? DS.t1 : DS.t3,
                }}>{i + 1}</Box>
                <Box component="span" sx={{ display: { xs: on ? 'inline' : 'none', sm: 'inline' } }}>{semEmoji(s.title)}</Box>
              </Box>
            )
          })}
        </Box>
        <Typography sx={{ fontSize: 13, color: DS.t2, mt: 2.5, mb: 1 }}>Etapa {step + 1} de {total}</Typography>

        <Box key={step} sx={{ display: 'grid', gap: { xs: '22px', sm: '26px' }, animation: 'briefIn 0.5s cubic-bezier(0.2,0.7,0.2,1)', '@keyframes briefIn': { from: { opacity: 0, transform: 'translateY(14px)' } } }}>
          <Titulo tamanho={{ xs: 30, sm: 42 }}>{semEmoji(secao.title)}</Titulo>

          {secao.hasObjectives && (
            <Box sx={{ display: 'grid', gap: 1 }}>
              <Rotulo obrigatorio ajuda="Marque quantos quiser.">Principais objetivos</Rotulo>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1 }}>
                {OBJECTIVES.map(obj => <Opcao key={obj} marcada={objectives.includes(obj)} multipla onClick={() => toggleObj(obj)}>{obj}</Opcao>)}
              </Box>
            </Box>
          )}

          {secao.fields.map(f => <Campo key={f.key} f={f} valor={vals[f.key] ?? ''} onChange={v => set(f.key, v)} />)}
        </Box>

        {falhou && (
          <Typography sx={{ mt: 3, color: DS.redSoft, fontSize: 14 }}>Não deu para enviar agora. Confira a internet e tente de novo — nada do que você escreveu foi perdido.</Typography>
        )}

        <Box sx={{ display: 'flex', gap: 1.5, mt: { xs: 4, sm: 4.5 }, flexWrap: 'wrap' }}>
          {step > 0 && (
            <Botao fantasma onClick={() => setStep(s => s - 1)}>← Voltar</Botao>
          )}
          <Box sx={{ flex: 1, display: { xs: 'none', sm: 'block' } }} />
          {ultimo ? (
            <Botao onClick={handleSubmit} disabled={saving}>
              {saving ? <CircularProgress size={18} sx={{ color: DS.onAccent }} /> : <>Enviar briefing <span>→</span></>}
            </Botao>
          ) : (
            <Botao onClick={() => setStep(s => s + 1)}>Continuar <span>→</span></Botao>
          )}
        </Box>
      </Box>

      <Typography sx={{ textAlign: 'center', fontSize: 13, color: DS.t3, mt: 4 }}>
        Digital Scale · Suas respostas são tratadas com sigilo
      </Typography>
    </Box>,
  )
}

// ── Peças ────────────────────────────────────────────────────────────────────

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: '10px', width: 'fit-content', fontSize: 13, fontWeight: 600, letterSpacing: '0.16em', textTransform: 'uppercase', color: DS.t2 }}>
      <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: DS.accent, boxShadow: `0 0 12px ${DS.accent}` }} />
      {children}
    </Box>
  )
}

function Titulo({ children, tamanho, cor, mt }: { children: React.ReactNode; tamanho: { xs: number; sm: number }; cor?: string; mt?: number }) {
  return (
    <Typography component="h1" sx={{
      fontFamily: DS.fontDisplay, fontWeight: 400, textTransform: 'uppercase', lineHeight: 1.02,
      fontSize: { xs: tamanho.xs, sm: tamanho.sm }, color: cor ?? DS.t1, mt, overflowWrap: 'anywhere',
    }}>{children}</Typography>
  )
}

function Rotulo({ children, obrigatorio, ajuda, htmlFor }: { children: React.ReactNode; obrigatorio?: boolean; ajuda?: string; htmlFor?: string }) {
  return (
    <Box sx={{ display: 'grid', gap: '4px' }}>
      <Box component="label" htmlFor={htmlFor} sx={{ fontSize: 15, fontWeight: 600, lineHeight: 1.4, color: DS.t1 }}>
        {children}{obrigatorio && <Box component="span" sx={{ color: DS.accent }}> *</Box>}
      </Box>
      {ajuda && <Box component="span" sx={{ fontSize: 13, color: DS.t3, lineHeight: 1.45 }}>{ajuda}</Box>}
    </Box>
  )
}

function Campo({ f, valor, onChange }: { f: BriefingField; valor: string; onChange: (v: string) => void }) {
  const id = `brief-${f.key}`
  if (f.type === 'choice') {
    return (
      <Box sx={{ display: 'grid', gap: 1 }}>
        <Rotulo obrigatorio={f.required} ajuda={f.hint}>{f.label}</Rotulo>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1 }}>
          {(f.options ?? []).map(opt => (
            <Opcao key={opt} marcada={valor === opt} onClick={() => onChange(valor === opt ? '' : opt)}>{opt}</Opcao>
          ))}
        </Box>
      </Box>
    )
  }
  return (
    <Box sx={{ display: 'grid', gap: 1 }}>
      <Rotulo obrigatorio={f.required} ajuda={f.hint} htmlFor={id}>{f.label}</Rotulo>
      {f.multiline
        ? <Box component="textarea" id={id} value={valor} onChange={e => onChange((e.target as HTMLTextAreaElement).value)}
            sx={{ ...CAMPO, minHeight: 130, resize: 'vertical' }} />
        : <Box component="input" id={id} value={valor} onChange={e => onChange((e.target as HTMLInputElement).value)}
            autoComplete="off" sx={CAMPO} />}
    </Box>
  )
}

function Opcao({ children, marcada, multipla, onClick }: { children: React.ReactNode; marcada: boolean; multipla?: boolean; onClick: () => void }) {
  return (
    <Box component="button" type="button" onClick={onClick} aria-pressed={marcada} sx={{
      display: 'flex', alignItems: 'center', gap: 1.5, width: '100%', textAlign: 'left', cursor: 'pointer',
      minHeight: 52, p: '14px 16px', borderRadius: RAIO, font: 'inherit', fontSize: 15, fontWeight: 600,
      color: DS.t1, border: `1px solid ${marcada ? DS.accent : DS.border}`,
      bgcolor: marcada ? `${DS.accent}14` : DS.surfaceAlt, transition: 'border-color 0.2s, background 0.2s',
      '&:hover': { borderColor: marcada ? DS.accent : `${DS.accent}66` },
      '&:focus-visible': { outline: `2px solid ${DS.accent}`, outlineOffset: 2 },
    }}>
      <Box component="span" sx={{
        width: 20, height: 20, flexShrink: 0, borderRadius: multipla ? '6px' : '50%', display: 'grid', placeItems: 'center',
        border: `1.5px solid ${marcada ? DS.accent : DS.t4}`, bgcolor: marcada ? DS.accent : 'transparent',
        color: DS.onAccent, fontSize: 13, fontWeight: 900, lineHeight: 1,
      }}>
        {marcada && (multipla ? '✓' : <Box component="span" sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: DS.onAccent }} />)}
      </Box>
      <span>{children}</span>
    </Box>
  )
}

function Botao({ children, onClick, fantasma, disabled }: { children: React.ReactNode; onClick: () => void; fantasma?: boolean; disabled?: boolean }) {
  return (
    <Box component="button" type="button" onClick={onClick} disabled={disabled} sx={{
      flex: { xs: 1, sm: 'none' }, minHeight: 56, px: { xs: 2.5, sm: 3.5 }, borderRadius: 999, cursor: 'pointer',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 1.5,
      font: 'inherit', fontWeight: 700, fontSize: 15, letterSpacing: '0.06em', textTransform: 'uppercase',
      border: `1px solid ${fantasma ? DS.border : 'transparent'}`,
      bgcolor: fantasma ? 'transparent' : DS.accent, color: fantasma ? DS.t1 : DS.onAccent,
      transition: 'transform 0.3s, box-shadow 0.3s, background 0.3s',
      '&:hover': fantasma ? { borderColor: DS.t2 } : { transform: 'translateY(-2px)', bgcolor: DS.cyan },
      '&:disabled': { opacity: 0.6, cursor: 'default', transform: 'none' },
      '&:focus-visible': { outline: `2px solid ${DS.accent}`, outlineOffset: 3 },
    }}>{children}</Box>
  )
}
