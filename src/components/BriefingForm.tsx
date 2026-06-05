import { useState, useEffect } from 'react'
import {
  Box, Typography, TextField, Button, Chip, CircularProgress,
  LinearProgress, Divider, FormControlLabel, Checkbox,
} from '@mui/material'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'

interface Props { token: string }

const OBJECTIVES = [
  'Fortalecer marca', 'Atrair clientes', 'Aumentar faturamento',
  'Vender produtos', 'Vender serviços', 'Gerar autoridade',
  'Posicionar profissionalmente', 'Criar estratégia de conteúdo',
  'Ser mais conhecido',
]

const SECTIONS = [
  {
    title: '🏗️ Sobre a Empresa',
    fields: [
      { key: 'repName',     label: 'Nome do Representante Legal',    required: true },
      { key: 'razaoSocial', label: 'Razão Social da Empresa',        required: true },
      { key: 'cpf',         label: 'CPF do Representante Legal',     required: true },
      { key: 'cnpj',        label: 'CNPJ da Empresa',                required: false },
      { key: 'endereco',    label: 'Endereço Completo',              required: false },
      { key: 'telefone',    label: 'Telefone para Contato',          required: true },
      { key: 'email',       label: 'E-mail para Contato',            required: true },
      { key: 'nomeEmpresa', label: 'Nome da Empresa (marca)',        required: true },
      { key: 'servPrincipal', label: 'Principal Serviço/Produto',    required: true },
      { key: 'outrosServ',  label: 'Outros Serviços ou Produtos',    required: false },
      { key: 'tempoMercado', label: 'Tempo de Atuação no Mercado',   required: false },
      { key: 'diferencial', label: 'Diferencial em Relação aos Concorrentes', required: false, multiline: true },
    ],
  },
  {
    title: '🎯 Objetivos com o Projeto',
    fields: [
      { key: 'expectativas',  label: 'Expectativas com o Projeto',         required: false, multiline: true },
      { key: 'referencias',   label: 'Referências de Empresas que Admira', required: false, multiline: true },
    ],
  },
  {
    title: '🎥 Conteúdo e Acesso às Redes',
    fields: [
      { key: 'igLogin',   label: 'Login do Instagram',         required: false },
      { key: 'igSenha',   label: 'Senha do Instagram',         required: false },
      { key: 'fbLogin',   label: 'Login do Facebook',          required: false },
      { key: 'fbSenha',   label: 'Senha do Facebook',          required: false },
      { key: 'gmEmail',   label: 'E-mail do Google Meu Negócio', required: false },
      { key: 'gmSenha',   label: 'Senha do Google Meu Negócio', required: false },
    ],
  },
  {
    title: '📍 Público-Alvo e Região',
    fields: [
      { key: 'publicoAlvo',   label: 'Descreva seu Público-Alvo',          required: false, multiline: true },
      { key: 'regioes',       label: 'Cidades/Regiões Atendidas',          required: false },
      { key: 'naoClientes',   label: 'Tipos de Clientes que NÃO Deseja',   required: false, multiline: true },
    ],
  },
  {
    title: '📝 Considerações Finais',
    fields: [
      { key: 'particularidades', label: 'Particularidades Importantes',    required: false, multiline: true },
      { key: 'infoAdicionais',   label: 'Informações Adicionais',          required: false, multiline: true },
    ],
  },
]

export default function BriefingForm({ token }: Props) {
  const [clientName, setClientName] = useState('')
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState('')
  const [submitted, setSubmitted]   = useState(false)
  const [saving, setSaving]         = useState(false)
  const [step, setStep]             = useState(0)

  const [objectives, setObjectives] = useState<string[]>([])
  const [hasMedia, setHasMedia]     = useState<boolean | null>(null)
  const [vals, setVals]             = useState<Record<string, string>>({})

  useEffect(() => {
    fetch(`/api/briefing?token=${token}`)
      .then(r => r.json())
      .then((d: { ok: boolean; clientName?: string; data?: Record<string, unknown>; error?: string }) => {
        if (!d.ok) { setError(d.error ?? 'Link inválido'); return }
        setClientName(d.clientName ?? '')
        if (d.data) {
          const { _objectives, _hasMedia, ...rest } = d.data as Record<string, unknown>
          setObjectives((_objectives as string[]) ?? [])
          setHasMedia((_hasMedia as boolean | null) ?? null)
          const strVals: Record<string, string> = {}
          Object.entries(rest).forEach(([k, v]) => { if (typeof v === 'string') strVals[k] = v })
          setVals(strVals)
          setSubmitted(true)
        }
      })
      .catch(() => setError('Erro ao carregar formulário.'))
      .finally(() => setLoading(false))
  }, [token])

  const set = (key: string, val: string) => setVals(prev => ({ ...prev, [key]: val }))

  const toggleObj = (obj: string) =>
    setObjectives(prev => prev.includes(obj) ? prev.filter(o => o !== obj) : [...prev, obj])

  const totalSteps = SECTIONS.length
  const progress   = ((step) / totalSteps) * 100

  const handleSubmit = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/briefing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'submit', token,
          data: { ...vals, _objectives: objectives, _hasMedia: hasMedia },
        }),
      })
      const d = await res.json() as { ok: boolean }
      if (d.ok) setSubmitted(true)
    } catch { /* silent */ }
    finally { setSaving(false) }
  }

  if (loading) return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#080808', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <CircularProgress sx={{ color: '#ff9039' }} />
    </Box>
  )

  if (error) return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#080808', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 3 }}>
      <Box sx={{ textAlign: 'center' }}>
        <Typography sx={{ color: '#FF4545', fontSize: '1.1rem', fontWeight: 700 }}>Link inválido</Typography>
        <Typography sx={{ color: 'rgba(255,255,255,0.4)', mt: 1, fontSize: '0.85rem' }}>{error}</Typography>
      </Box>
    </Box>
  )

  if (submitted) return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#080808', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 3 }}>
      <Box sx={{ textAlign: 'center', maxWidth: 440 }}>
        <CheckCircleIcon sx={{ fontSize: 56, color: '#00C47A', mb: 2 }} />
        <Typography sx={{ color: '#fff', fontSize: '1.4rem', fontWeight: 800, mb: 1 }}>
          Briefing enviado!
        </Typography>
        <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.9rem', lineHeight: 1.6 }}>
          Obrigado, <strong style={{ color: '#ff9039' }}>{clientName}</strong>! Recebemos suas informações e nossa equipe já pode iniciar o planejamento.
        </Typography>
        <Typography sx={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.75rem', mt: 3 }}>
          Digital Scale · Agência de Marketing Digital
        </Typography>
      </Box>
    </Box>
  )

  const currentSection = SECTIONS[step]

  return (
    <Box sx={{
      minHeight: '100vh', bgcolor: '#080808',
      fontFamily: '"Inter", system-ui, sans-serif',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
    }}>
      {/* Header */}
      <Box sx={{
        width: '100%', px: 3, py: 2,
        background: 'linear-gradient(135deg, rgba(255,144,57,0.12), rgba(255,83,57,0.08))',
        borderBottom: '1px solid rgba(255,144,57,0.15)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        position: 'sticky', top: 0, zIndex: 10, backdropFilter: 'blur(20px)',
      }}>
        <Box>
          <Typography sx={{ fontSize: '0.58rem', color: '#ff9039', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            Digital Scale
          </Typography>
          <Typography sx={{ fontSize: '0.85rem', fontWeight: 700, color: '#fff', lineHeight: 1.2 }}>
            Briefing Estratégico
          </Typography>
        </Box>
        <Typography sx={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.4)' }}>
          {step + 1} / {totalSteps}
        </Typography>
      </Box>

      {/* Progress */}
      <LinearProgress
        variant="determinate" value={progress}
        sx={{ width: '100%', height: 3, bgcolor: 'rgba(255,255,255,0.05)', '& .MuiLinearProgress-bar': { bgcolor: '#ff9039' } }}
      />

      {/* Content */}
      <Box sx={{ width: '100%', maxWidth: 560, px: 3, py: 4, flex: 1 }}>

        {/* Welcome on first step */}
        {step === 0 && (
          <Box sx={{ mb: 3, p: 2.5, borderRadius: 2.5, bgcolor: 'rgba(255,144,57,0.07)', border: '1px solid rgba(255,144,57,0.2)' }}>
            <Typography sx={{ color: '#ff9039', fontWeight: 800, fontSize: '0.82rem', mb: 0.5 }}>
              Olá! Bem-vindo(a) à Digital Scale 👋
            </Typography>
            <Typography sx={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.76rem', lineHeight: 1.6 }}>
              Este briefing nos ajuda a entender melhor o seu negócio para criarmos a estratégia de conteúdo ideal. Leva cerca de 5 minutos.
            </Typography>
          </Box>
        )}

        <Typography sx={{ fontSize: '1rem', fontWeight: 800, color: '#fff', mb: 2.5 }}>
          {currentSection.title}
        </Typography>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>

          {/* Objectives section (step 1 only) */}
          {step === 1 && (
            <Box>
              <Typography sx={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.5)', mb: 1.2, fontWeight: 600 }}>
                Principais objetivos *
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.8 }}>
                {OBJECTIVES.map(obj => (
                  <Chip
                    key={obj} label={obj} size="small"
                    onClick={() => toggleObj(obj)}
                    sx={{
                      fontSize: '0.68rem', cursor: 'pointer', height: 28,
                      bgcolor: objectives.includes(obj) ? 'rgba(255,144,57,0.2)' : 'rgba(255,255,255,0.05)',
                      color: objectives.includes(obj) ? '#ff9039' : 'rgba(255,255,255,0.5)',
                      border: `1px solid ${objectives.includes(obj) ? 'rgba(255,144,57,0.5)' : 'rgba(255,255,255,0.1)'}`,
                      '&:hover': { bgcolor: 'rgba(255,144,57,0.12)' },
                    }}
                  />
                ))}
              </Box>
            </Box>
          )}

          {/* Media section (step 2 only) */}
          {step === 2 && (
            <Box>
              <Typography sx={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.5)', mb: 1, fontWeight: 600 }}>
                Possui banco de imagens/vídeos profissionais?
              </Typography>
              <Box sx={{ display: 'flex', gap: 1 }}>
                {['Sim', 'Não'].map(opt => (
                  <Box key={opt} onClick={() => setHasMedia(opt === 'Sim')} sx={{
                    px: 2, py: 1, borderRadius: 2, cursor: 'pointer', fontSize: '0.78rem', fontWeight: 700,
                    bgcolor: hasMedia === (opt === 'Sim') ? 'rgba(255,144,57,0.18)' : 'rgba(255,255,255,0.05)',
                    color: hasMedia === (opt === 'Sim') ? '#ff9039' : 'rgba(255,255,255,0.4)',
                    border: `1px solid ${hasMedia === (opt === 'Sim') ? 'rgba(255,144,57,0.45)' : 'rgba(255,255,255,0.1)'}`,
                    transition: 'all 0.15s',
                  }}>
                    {opt}
                  </Box>
                ))}
              </Box>
            </Box>
          )}

          {/* Text fields */}
          {currentSection.fields.map(f => (
            <TextField
              key={f.key}
              label={f.label + (f.required ? ' *' : '')}
              size="small" fullWidth
              value={vals[f.key] ?? ''}
              onChange={e => set(f.key, e.target.value)}
              multiline={f.multiline}
              rows={f.multiline ? 3 : undefined}
              sx={{
                '& .MuiOutlinedInput-root': {
                  bgcolor: 'rgba(255,255,255,0.04)',
                  color: '#fff', fontSize: '0.82rem',
                  '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' },
                  '&:hover fieldset': { borderColor: 'rgba(255,144,57,0.3)' },
                  '&.Mui-focused fieldset': { borderColor: '#ff9039' },
                },
                '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.4)', fontSize: '0.78rem' },
                '& .MuiInputLabel-root.Mui-focused': { color: '#ff9039' },
              }}
            />
          ))}
        </Box>

        {/* Navigation */}
        <Box sx={{ display: 'flex', gap: 1.5, mt: 4, justifyContent: 'space-between' }}>
          {step > 0 ? (
            <Button onClick={() => setStep(s => s - 1)}
              sx={{ color: 'rgba(255,255,255,0.4)', fontWeight: 600, fontSize: '0.78rem' }}>
              ← Voltar
            </Button>
          ) : <Box />}

          {step < totalSteps - 1 ? (
            <Button variant="contained" onClick={() => setStep(s => s + 1)}
              sx={{ background: 'linear-gradient(135deg, #ff9039, #ff5339)', color: '#000', fontWeight: 800, px: 3, borderRadius: 2 }}>
              Continuar →
            </Button>
          ) : (
            <Button variant="contained" onClick={handleSubmit} disabled={saving}
              sx={{ background: 'linear-gradient(135deg, #00C47A, #00a06a)', color: '#000', fontWeight: 800, px: 3, borderRadius: 2 }}>
              {saving ? <CircularProgress size={16} sx={{ color: '#000' }} /> : 'Enviar Briefing ✓'}
            </Button>
          )}
        </Box>

      </Box>

      {/* Footer */}
      <Box sx={{ py: 2, textAlign: 'center' }}>
        <Typography sx={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.2)' }}>
          Digital Scale · Seus dados são tratados com total sigilo
        </Typography>
      </Box>
    </Box>
  )
}
